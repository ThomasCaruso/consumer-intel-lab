import { isAllowedPage, scrubUrl, MAX_DAYS, MAX_URLS, MAX_VISITS, DASHBOARD_URL } from './config.js'

const DAY = 86400000

const hasHistory = () => chrome.permissions.contains({ permissions: ['history'] })

async function getProducts() {
  const { products = [] } = await chrome.storage.local.get('products')
  return products
}

async function readHistory(days) {
  if (!(await hasHistory())) throw new Error('History permission has not been granted yet.')
  const d = Math.max(1, Math.min(MAX_DAYS, Math.round(Number(days) || 30)))
  const startTime = Date.now() - d * DAY
  const items = await chrome.history.search({ text: '', startTime, maxResults: MAX_URLS })
  const visits = []
  let truncated = items.length >= MAX_URLS
  // Fetch individual visit times (needed for time-of-day and calendar views), 40 URLs at a time.
  for (let i = 0; i < items.length; i += 40) {
    const batch = items.slice(i, i + 40)
    const results = await Promise.all(batch.map((it) => chrome.history.getVisits({ url: it.url }).catch(() => [])))
    batch.forEach((it, j) => {
      const url = scrubUrl(it.url)
      if (!url) return
      const title = (it.title || '').slice(0, 300)
      for (const v of results[j]) {
        if (v.visitTime >= startTime) visits.push({ url, title, visitTime: Math.round(v.visitTime), transition: v.transition })
      }
    })
    if (visits.length >= MAX_VISITS) { truncated = true; break }
  }
  return { visits: visits.slice(0, MAX_VISITS), truncated, scannedUrls: items.length }
}

async function openConnectPage(senderTabId) {
  await chrome.storage.session.set({ returnTabId: senderTabId ?? null })
  await chrome.tabs.create({ url: chrome.runtime.getURL('connect.html') })
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const fromExtensionPage = sender.id === chrome.runtime.id && !sender.tab
  const fromDashboard = sender.id === chrome.runtime.id && sender.tab && isAllowedPage(sender.url)
  if (!fromExtensionPage && !fromDashboard) {
    sendResponse({ ok: false, error: 'Not an authorized dashboard origin.' })
    return false
  }
  ;(async () => {
    switch (msg?.type) {
      case 'status':
        return { installed: true, version: chrome.runtime.getManifest().version, historyGranted: await hasHistory(), capturedProducts: (await getProducts()).length }
      case 'connect': {
        if (await hasHistory()) return { granted: true }
        await openConnectPage(sender.tab?.id)
        return { granted: false, opened: true }
      }
      case 'history':
        return readHistory(msg.payload?.days)
      case 'disconnect':
        await chrome.permissions.remove({ permissions: ['history'] })
        return { granted: await hasHistory() }
      case 'products':
        return getProducts()
      case 'removeProduct': {
        const next = (await getProducts()).filter((p) => p.id !== msg.payload?.id)
        await chrome.storage.local.set({ products: next })
        return next
      }
      case 'clearProducts':
        await chrome.storage.local.set({ products: [] })
        return []
      case 'granted': {
        // sent by connect.html after the user approves — return them to the dashboard tab
        const { returnTabId } = await chrome.storage.session.get('returnTabId')
        if (returnTabId != null) {
          try {
            const tab = await chrome.tabs.update(returnTabId, { active: true })
            await chrome.windows.update(tab.windowId, { focused: true })
            return { returned: true }
          } catch { /* tab was closed */ }
        }
        await chrome.tabs.create({ url: DASHBOARD_URL })
        return { returned: false }
      }
      default:
        throw new Error('Unknown request')
    }
  })().then(
    (data) => sendResponse({ ok: true, data }),
    (e) => sendResponse({ ok: false, error: String(e?.message ?? e) }),
  )
  return true // async response
})

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    // Reload any open dashboard tabs so the bridge content script attaches immediately.
    const tabs = await chrome.tabs.query({})
    for (const t of tabs) if (t.url && isAllowedPage(t.url)) chrome.tabs.reload(t.id)
  }
})
