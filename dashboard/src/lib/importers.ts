import Papa from 'papaparse'
import type { ActivityRecord, DataSource, Product, SourceKind } from './types'
import { domainOf, extractSearch, RETAILERS, rootDomain } from './taxonomy'

let counter = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`

export interface ImportResult {
  source: DataSource
  records: ActivityRecord[]
  products: Product[]
}

function makeSource(kind: SourceKind, label: string): DataSource {
  return { id: uid('src'), kind, label, importedAt: Date.now(), recordCount: 0, skipped: 0, notes: [] }
}

function visitRecord(sourceId: string, source: SourceKind, url: string, title: string, time: number, transition?: string): ActivityRecord {
  const s = extractSearch(url)
  const domain = domainOf(url)
  return {
    id: uid('r'),
    sourceId,
    source,
    kind: s ? 'search' : 'visit',
    time,
    url,
    title: title || url,
    domain: domain ? domain : undefined,
    text: s?.query,
    transition,
  }
}

function parseTime(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    // seconds, ms, or µs since epoch
    if (v > 1e15) return Math.round(v / 1000)
    if (v > 1e12) return v
    if (v > 1e9) return v * 1000
    return null
  }
  const s = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return parseTime(Number(s))
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

// ---------------------------------------------------------------------------
// Chrome extension payload
// ---------------------------------------------------------------------------
export interface ChromeVisit { url: string; title: string; visitTime: number; transition?: string }

export function importChromeHistory(visits: ChromeVisit[], days: number): ImportResult {
  const source = makeSource('chrome', `Chrome history (last ${days} days)`)
  const records: ActivityRecord[] = []
  for (const v of visits) {
    if (!v.url || !v.visitTime) { source.skipped++; continue }
    records.push(visitRecord(source.id, 'chrome', v.url, v.title, v.visitTime, v.transition))
  }
  source.recordCount = records.length
  return { source, records, products: [] }
}

// ---------------------------------------------------------------------------
// File imports — format is auto-detected from content, not just filename.
// ---------------------------------------------------------------------------
export async function importFile(file: File): Promise<ImportResult> {
  const text = await file.text()
  const name = file.name
  const lower = name.toLowerCase()
  if (lower.endsWith('.json')) return importJsonText(text, name)
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return importCsvText(text, name)
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return importTakeoutActivityHtml(text, name)
  // Try JSON then CSV
  try {
    return importJsonText(text, name)
  } catch {
    return importCsvText(text, name)
  }
}

export function importJsonText(text: string, name: string): ImportResult {
  const data = JSON.parse(text)
  // Google Takeout: Chrome/BrowserHistory.json
  if (data && Array.isArray(data['Browser History'])) return importTakeoutBrowser(data['Browser History'], name)
  if (Array.isArray(data) && data.length && isChatGptConversation(data[0])) return importChatGpt(data, name)
  if (Array.isArray(data) && data.length && 'header' in data[0] && 'time' in data[0]) return importTakeoutActivity(data, name)
  const arr: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : Array.isArray(data?.items) ? data.items : Array.isArray(data?.records) ? data.records : []
  if (!arr.length) throw new Error(`${name}: no recognizable records (expected Takeout, ChatGPT export, or an array of records)`)
  return importRows(arr as Record<string, unknown>[], name, 'json')
}

export function importCsvText(text: string, name: string): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true })
  if (!parsed.data.length) throw new Error(`${name}: CSV has no rows`)
  return importRows(parsed.data, name, 'csv')
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]))
  for (const k of keys) {
    const real = lowerMap.get(k)
    if (real != null && row[real] != null && row[real] !== '') return row[real]
  }
  return undefined
}

const NAME_KEYS = ['product name', 'product', 'name', 'item', 'item name', 'title', 'product title', 'description']
const URL_KEYS = ['url', 'link', 'product url', 'href', 'website', 'page url', 'titleurl']
const TIME_KEYS = ['time', 'timestamp', 'date', 'visit time', 'visittime', 'order date', 'orderdate', 'last visit time', 'time_usec', 'datetime', 'visited']
const PRICE_KEYS = ['price', 'unit price', 'item total', 'total owed', 'total', 'amount', 'cost', 'sale price']
const IMAGE_KEYS = ['image', 'image url', 'imageurl', 'img', 'thumbnail', 'image_link']

/** Generic tabular rows → browsing records, order records, or product catalog — decided by which columns exist. */
function importRows(rows: Record<string, unknown>[], name: string, kind: 'csv' | 'json'): ImportResult {
  const first = rows[0] ?? {}
  const keys = Object.keys(first).map((k) => k.toLowerCase().trim())
  const has = (list: string[]) => list.some((k) => keys.includes(k))
  const isOrders = keys.some((k) => k.includes('order')) && has(NAME_KEYS)
  const isCatalog = !has(TIME_KEYS) && has(NAME_KEYS) && has(URL_KEYS)
  if (isCatalog) return importCatalogRows(rows, name)
  if (isOrders) return importOrderRows(rows, name)

  const source = makeSource(kind, name)
  const records: ActivityRecord[] = []
  for (const row of rows) {
    const url = pick(row, URL_KEYS) as string | undefined
    const title = String(pick(row, ['title', 'page title', 'name']) ?? '')
    const time = parseTime(pick(row, TIME_KEYS))
    if (!time || (!url && !title)) { source.skipped++; continue }
    if (url) records.push(visitRecord(source.id, kind, String(url), title, time))
    else records.push({ id: uid('r'), sourceId: source.id, source: kind, kind: 'visit', time, title })
  }
  if (!records.length) throw new Error(`${name}: rows need a time/date column plus a url or title column`)
  source.recordCount = records.length
  if (source.skipped) source.notes.push(`${source.skipped} rows skipped (missing time or url/title)`)
  return { source, records, products: [] }
}

function importOrderRows(rows: Record<string, unknown>[], name: string): ImportResult {
  const source = makeSource('orders', name)
  const records: ActivityRecord[] = []
  for (const row of rows) {
    const title = String(pick(row, NAME_KEYS) ?? '').trim()
    const time = parseTime(pick(row, TIME_KEYS))
    if (!title || !time) { source.skipped++; continue }
    const priceRaw = pick(row, PRICE_KEYS)
    const amount = priceRaw != null ? Number(String(priceRaw).replace(/[^0-9.]/g, '')) : undefined
    const rawUrl = String(pick(row, URL_KEYS) ?? '')
    const url = /^https?:\/\//.test(rawUrl) ? rawUrl : undefined
    const website = String(pick(row, ['website', 'marketplace', 'retailer', 'store']) ?? '').toLowerCase()
    const siteDomain = website.match(/([a-z0-9-]+\.)+[a-z]{2,}/)?.[0]
    records.push({
      id: uid('r'), sourceId: source.id, source: 'orders', kind: 'order', time, title,
      url,
      domain: url ? domainOf(url) : siteDomain ? rootDomain(siteDomain.replace(/^www\./, '')) : undefined,
      amount: amount && Number.isFinite(amount) ? amount : undefined,
    })
  }
  source.recordCount = records.length
  if (source.skipped) source.notes.push(`${source.skipped} rows skipped (missing product name or date)`)
  return { source, records, products: [] }
}

function importCatalogRows(rows: Record<string, unknown>[], name: string): ImportResult {
  const source = makeSource('csv', `${name} (product catalog)`)
  const products: Product[] = []
  for (const row of rows) {
    const pname = String(pick(row, NAME_KEYS) ?? '').trim()
    const url = String(pick(row, URL_KEYS) ?? '').trim()
    if (!pname || !/^https?:\/\//.test(url)) { source.skipped++; continue }
    const priceRaw = pick(row, PRICE_KEYS)
    const price = priceRaw != null ? Number(String(priceRaw).replace(/[^0-9.]/g, '')) : undefined
    const image = pick(row, IMAGE_KEYS) as string | undefined
    const d = domainOf(url) ?? ''
    products.push({
      id: uid('p'),
      sourceId: source.id,
      name: pname,
      url,
      retailer: RETAILERS[rootDomain(d)]?.name ?? rootDomain(d),
      price: price && Number.isFinite(price) ? price : undefined,
      currency: String(pick(row, ['currency']) ?? 'USD'),
      image: image && /^https?:\/\//.test(String(image)) ? String(image) : undefined,
      brand: (pick(row, ['brand', 'manufacturer']) as string | undefined) ?? undefined,
      category: (pick(row, ['category', 'department']) as string | undefined) ?? undefined,
      origin: 'catalog',
      priceSource: price ? `from your file ${name}` : undefined,
    })
  }
  source.recordCount = products.length
  source.notes.push('Product catalog: used only for recommendations, not for profiling.')
  return { source, records: [], products }
}

// ---------------------------------------------------------------------------
// Google Takeout
// ---------------------------------------------------------------------------
function importTakeoutBrowser(items: Record<string, unknown>[], name: string): ImportResult {
  const source = makeSource('takeout-browser', `Google Takeout · ${name}`)
  const records: ActivityRecord[] = []
  for (const it of items) {
    const url = it.url as string
    const time = parseTime(it.time_usec)
    if (!url || !time) { source.skipped++; continue }
    records.push(visitRecord(source.id, 'takeout-browser', url, String(it.title ?? ''), time, it.page_transition as string | undefined))
  }
  source.recordCount = records.length
  return { source, records, products: [] }
}

/** My Activity JSON: [{header, title: "Searched for x" | "Visited x", titleUrl, time}] */
function importTakeoutActivity(items: Record<string, unknown>[], name: string): ImportResult {
  const source = makeSource('takeout-activity', `Google My Activity · ${name}`)
  const records: ActivityRecord[] = []
  for (const it of items) {
    const time = parseTime(it.time)
    const title = String(it.title ?? '')
    const url = it.titleUrl as string | undefined
    if (!time || !title) { source.skipped++; continue }
    records.push(activityRecord(source.id, title, url, time, String(it.header ?? '')))
  }
  source.recordCount = records.length
  return { source, records, products: [] }
}

function activityRecord(sourceId: string, title: string, url: string | undefined, time: number, header: string): ActivityRecord {
  const searched = title.match(/^Searched for (.+)$/)
  if (searched) {
    return { id: uid('r'), sourceId, source: 'takeout-activity', kind: 'search', time, title, text: searched[1], url, domain: url ? domainOf(url) : undefined }
  }
  const visited = title.match(/^(Visited|Viewed|Watched) (.+)$/)
  const cleanTitle = visited ? visited[2] : title
  if (url) {
    // My Activity often wraps the real URL in a google redirect
    let real = url
    try {
      const u = new URL(url)
      if (u.hostname.endsWith('google.com') && u.pathname === '/url' && u.searchParams.get('q')) real = u.searchParams.get('q')!
    } catch { /* keep */ }
    const r = visitRecord(sourceId, 'takeout-activity', real, cleanTitle, time)
    return r
  }
  return { id: uid('r'), sourceId, source: 'takeout-activity', kind: 'visit', time, title: cleanTitle + (header ? ` (${header})` : '') }
}

/** My Activity HTML (Takeout's default format). */
export function importTakeoutActivityHtml(html: string, name: string): ImportResult {
  const source = makeSource('takeout-activity', `Google My Activity · ${name}`)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const cells = Array.from(doc.querySelectorAll('.outer-cell'))
  const records: ActivityRecord[] = []
  for (const cell of cells) {
    const header = cell.querySelector('.header-cell')?.textContent?.trim() ?? ''
    const content = cell.querySelector('.content-cell')
    if (!content) { source.skipped++; continue }
    const a = content.querySelector('a')
    const lines = (content as HTMLElement).innerHTML.split(/<br\s*\/?>/i).map((s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()).filter(Boolean)
    const action = lines[0] ?? ''
    const time = parseTime(lines[lines.length - 1]?.replace(/ /g, ' ').replace(/ [A-Z]{2,4}$/, ''))
    if (!time) { source.skipped++; continue }
    records.push(activityRecord(source.id, action, a?.getAttribute('href') ?? undefined, time, header))
  }
  if (!cells.length) throw new Error(`${name}: not a Google My Activity HTML export`)
  source.recordCount = records.length
  if (source.skipped) source.notes.push(`${source.skipped} entries skipped (unreadable date)`)
  return { source, records, products: [] }
}

// ---------------------------------------------------------------------------
// ChatGPT export (conversations.json). Only the USER's own messages become
// records. Assistant and tool text is never analyzed; quoted blocks inside the
// user's message (lines starting with ">" or fenced code/pastes) are removed.
// ---------------------------------------------------------------------------
function isChatGptConversation(x: unknown): boolean {
  return !!x && typeof x === 'object' && 'mapping' in (x as object) && 'title' in (x as object)
}

export function stripQuoted(text: string): { own: string; removed: number } {
  let removed = 0
  let t = text.replace(/```[\s\S]*?```/g, () => { removed++; return ' ' })
  t = t.replace(/"""[\s\S]*?"""/g, () => { removed++; return ' ' })
  const lines = t.split('\n').filter((l) => {
    if (/^\s*>/.test(l)) { removed++; return false }
    return true
  })
  t = lines.join('\n')
  // very long messages are almost always pasted documents — keep only the first 400 chars typed by the user
  if (t.length > 1500) { removed++; t = t.slice(0, 400) }
  return { own: t.trim(), removed }
}

interface ChatNode { message?: { author?: { role?: string }; content?: { content_type?: string; parts?: unknown[] }; create_time?: number } }

function importChatGpt(convs: { title?: string; create_time?: number; mapping?: Record<string, ChatNode> }[], name: string): ImportResult {
  const source = makeSource('chatgpt', `ChatGPT export · ${name}`)
  const records: ActivityRecord[] = []
  let assistantSkipped = 0
  let quotedRemoved = 0
  for (const c of convs) {
    for (const node of Object.values(c.mapping ?? {})) {
      const m = node.message
      if (!m) continue
      const role = m.author?.role
      if (role !== 'user') { if (role === 'assistant' || role === 'tool') assistantSkipped++; continue }
      const parts = (m.content?.parts ?? []).filter((p): p is string => typeof p === 'string')
      const raw = parts.join('\n').trim()
      if (!raw) continue
      const { own, removed } = stripQuoted(raw)
      quotedRemoved += removed
      if (own.length < 3) continue
      const time = parseTime(m.create_time ?? c.create_time)
      if (!time) { source.skipped++; continue }
      records.push({ id: uid('r'), sourceId: source.id, source: 'chatgpt', kind: 'chat', time, title: c.title ?? 'Conversation', text: own.slice(0, 600) })
    }
  }
  source.recordCount = records.length
  source.notes.push(`${assistantSkipped} assistant/tool messages ignored — only your own words are analyzed`)
  if (quotedRemoved) source.notes.push(`${quotedRemoved} quoted or pasted blocks removed from your messages`)
  return { source, records, products: [] }
}
