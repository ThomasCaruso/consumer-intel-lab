import { DASHBOARD_URL } from './config.js'

const $ = (id) => document.getElementById(id)

async function render() {
  const granted = await chrome.permissions.contains({ permissions: ['history'] })
  const { products = [] } = await chrome.storage.local.get('products')
  $('hist').textContent = granted ? 'Granted' : 'Not granted'
  $('hist').className = granted ? 'ok' : 'off'
  $('count').textContent = String(products.length)
  $('toggle').textContent = granted ? 'Disconnect history access' : 'Allow history access…'
}

$('toggle').addEventListener('click', async () => {
  const granted = await chrome.permissions.contains({ permissions: ['history'] })
  if (granted) await chrome.permissions.remove({ permissions: ['history'] })
  else await chrome.permissions.request({ permissions: ['history'] })
  render()
})

$('open').addEventListener('click', () => chrome.tabs.create({ url: DASHBOARD_URL }))

// Runs inside the retailer page (activeTab, on click only). Reads public structured data.
function extractProducts() {
  const found = []
  const walk = (n) => {
    if (!n) return
    if (Array.isArray(n)) return n.forEach(walk)
    if (typeof n !== 'object') return
    const t = n['@type']
    const types = Array.isArray(t) ? t : [t]
    if (types.includes('Product') || types.includes('ProductGroup')) found.push(n)
    if (n['@graph']) walk(n['@graph'])
    if (n.itemListElement) walk(n.itemListElement)
    if (n.item) walk(n.item)
    if (n.mainEntity) walk(n.mainEntity)
  }
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { walk(JSON.parse(s.textContent)) } catch { /* malformed */ }
  }
  const str = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? str(v[0]) : v && typeof v === 'object' ? str(v.url ?? v.name ?? v.contentUrl) : undefined)
  const out = found.map((p) => {
    let offers = p.offers ?? p.hasVariant?.[0]?.offers
    if (Array.isArray(offers)) offers = offers[0]
    if (offers?.offers) offers = Array.isArray(offers.offers) ? offers.offers[0] : offers.offers
    const priceRaw = offers?.price ?? offers?.lowPrice ?? offers?.priceSpecification?.price
    return {
      name: str(p.name),
      url: str(p.url) ? new URL(str(p.url), location.href).href : location.href,
      price: priceRaw != null && !Number.isNaN(Number(priceRaw)) ? Number(priceRaw) : undefined,
      currency: offers?.priceCurrency,
      image: str(p.image),
      brand: str(p.brand),
      category: str(p.category),
      how: 'schema.org Product data published by the page',
    }
  }).filter((p) => p.name)
  if (!out.length) {
    const meta = (k) => document.querySelector(`meta[property="${k}"],meta[name="${k}"]`)?.content
    // Amazon publishes no schema.org Product; read the visible title/price elements instead.
    const amazonTitle = document.querySelector('#productTitle')?.textContent?.trim()
    const amazonPrice = document.querySelector('#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, .priceToPay .a-offscreen')?.textContent
    const amazonImg = document.querySelector('#landingImage')?.getAttribute('src')
    const ogPrice = meta('product:price:amount') ?? meta('og:price:amount')
    const name = amazonTitle ?? (meta('og:type') === 'product' || ogPrice ? meta('og:title') : undefined)
    const priceText = amazonPrice ?? ogPrice
    if (name) {
      const price = priceText ? Number(String(priceText).replace(/[^0-9.]/g, '')) : undefined
      out.push({
        name, url: location.href.split('#')[0], price: price && !Number.isNaN(price) ? price : undefined,
        currency: meta('product:price:currency') ?? (amazonPrice ? 'USD' : undefined),
        image: amazonImg ?? meta('og:image'), brand: meta('product:brand') ?? undefined,
        how: amazonTitle ? 'price and title shown on the Amazon page' : 'Open Graph product tags published by the page',
      })
    }
  }
  return { products: out.slice(0, 50), host: location.hostname.replace(/^www\./, '') }
}

$('capture').addEventListener('click', async () => {
  const cap = $('cap')
  cap.textContent = 'Reading this page…'
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !/^https?:/.test(tab.url ?? '')) throw new Error('Open a retailer product page first.')
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractProducts })
    if (!result?.products?.length) {
      cap.textContent = 'No product data found on this page. Try a single product page.'
      return
    }
    const now = Date.now()
    const { products = [] } = await chrome.storage.local.get('products')
    const byUrl = new Map(products.map((p) => [p.url, p]))
    for (const p of result.products) {
      byUrl.set(p.url, {
        id: 'cap-' + now.toString(36) + Math.random().toString(36).slice(2, 6),
        name: p.name.slice(0, 200), url: p.url, retailer: result.host, price: p.price, currency: p.currency,
        image: p.image && /^https?:/.test(p.image) ? p.image : undefined, brand: p.brand, category: p.category,
        origin: 'capture', capturedAt: now,
        priceSource: p.price != null ? `${p.how}, captured ${new Date(now).toLocaleString()}` : undefined,
      })
    }
    await chrome.storage.local.set({ products: [...byUrl.values()].slice(-500) })
    cap.textContent = `Captured ${result.products.length} product${result.products.length > 1 ? 's' : ''}: ${result.products[0].name.slice(0, 60)}`
    render()
  } catch (e) {
    cap.textContent = String(e?.message ?? e)
  }
})

render()
