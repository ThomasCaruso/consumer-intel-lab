import type {
  ActivityRecord, Confidence, DomainStat, Evidence, Feedback, GraphEdge, GraphNode, Product, Profile, ScoredItem, Segment, ShoppingStats, Tendency,
} from './types'
import {
  BRANDS, CATEGORIES, CONVENIENCE_WORDS, DEAL_DOMAINS, DEAL_WORDS, PREMIUM_WORDS, RETAILERS, RETAIL_ENGINES, REVIEW_WORDS,
  categoryLabel, classify, extractSearch, findBrands, isCartPage, isNoise, isProductPage, isSensitive, rootDomain, type Brand,
} from './taxonomy'

const DAY = 86_400_000
/** Utility categories describe tools you use, not things you want to buy — they count at reduced weight. */
export const UTILITY_WEIGHT: Record<string, number> = { productivity: 0.35, social: 0.6, learning: 0.8 }
export const KIND_WEIGHT = { visit: 1, search: 2, order: 3, chat: 1.5 } as const

interface Enriched {
  r: ActivityRecord
  cat: string
  rule: string
  brands: Brand[]
  root?: string
  retail: boolean
  product: boolean
  cart: boolean
  search?: { query: string; engine: string }
  text: string
}

export const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function confidenceFor(count: number, days: number): Confidence {
  if (count >= 30 && days >= 5) return 'High'
  if (count >= 10 && days >= 3) return 'Medium'
  if (count >= 3) return 'Low'
  return 'INSUFFICIENT DATA'
}

function ev(e: Enriched, why: string): Evidence {
  return { recordId: e.r.id, time: e.r.time, title: e.r.kind === 'chat' ? `You asked: “${(e.r.text ?? '').slice(0, 120)}”` : e.r.kind === 'search' && e.search ? `Searched ${e.search.engine}: “${e.search.query}”` : e.r.title, url: e.r.url, why }
}

/** Most recent records with distinct titles — evidence should show variety, not 20 reloads of one page. */
function sampleEvidence(list: Enriched[], why: (e: Enriched) => string, n = 8): Evidence[] {
  const seen = new Set<string>()
  const out: Evidence[] = []
  for (let i = list.length - 1; i >= 0 && out.length < n; i--) {
    const e = list[i]
    const key = (e.search?.query ?? e.r.title).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ev(e, why(e)))
  }
  return out
}

const STOP = new Set('the a an and or for of to in on with by at from is are was be this that it your you my our new best top review reviews vs buy shop online free sale deal deals price cheap amazon com walmart target ebay etsy best buy store official site page home how what why when where which who'.split(' '))
export function tokens(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
}

function cleanProductTitle(title: string, domain: string) {
  return title
    .replace(/^Amazon\.com\s*:\s*/i, '')
    .replace(/\s*:\s*[A-Z][\w &,'-]+$/i, (m) => (domain === 'amazon.com' ? '' : m))
    .replace(/\s*[|–-]\s*(Walmart\.com|Target|Best Buy|eBay|Etsy|Newegg\.com|Costco|Nike\.com|Apple)\s*$/i, '')
    .replace(/\s*-\s*Walmart\.com\s*$/i, '')
    .trim()
}

export function analyze(all: ActivityRecord[], feedback?: Feedback): Profile {
  const sorted = [...all].sort((a, b) => a.time - b.time)
  let excludedSensitive = 0
  let excludedOther = 0
  const cache = new Map<string, { cat: string; rule: string }>()
  const kept: Enriched[] = []
  const lastUrlTime = new Map<string, number>()

  for (const r of sorted) {
    if (isNoise(r.url)) { excludedOther++; continue }
    // Collapse reloads: the same URL within 60 s counts once.
    if (r.url && r.kind === 'visit') {
      const prev = lastUrlTime.get(r.url)
      lastUrlTime.set(r.url, r.time)
      if (prev != null && r.time - prev < 60_000) { excludedOther++; continue }
    }
    const text = [r.title, r.text].filter(Boolean).join(' ')
    if (isSensitive(r.url, text)) { excludedSensitive++; continue }
    const key = `${r.url ?? ''}|${text}`
    let c = cache.get(key)
    if (!c) {
      const cl = classify(r.url, r.kind === 'chat' ? r.text ?? '' : text)
      c = { cat: cl.category, rule: cl.rule }
      cache.set(key, c)
    }
    const root = r.domain ? rootDomain(r.domain) : undefined
    const search = r.url ? extractSearch(r.url) ?? undefined : r.kind === 'search' && r.text ? { query: r.text, engine: 'Google' } : undefined
    kept.push({
      r, cat: c.cat, rule: c.rule, root, search, text,
      brands: findBrands(r.url, r.kind === 'chat' ? r.text ?? '' : text),
      retail: !!root && (!!RETAILERS[root] || r.kind === 'order'),
      product: !!root && !!r.url && isProductPage(root, r.url),
      cart: !!r.url && !!root && !!RETAILERS[root] && isCartPage(r.url),
    })
  }

  const start = kept.length ? kept[0].r.time : Date.now()
  const end = kept.length ? kept[kept.length - 1].r.time : Date.now()
  const spanDays = Math.max(1, Math.round((end - start) / DAY))
  const halfLife = Math.max(14, spanDays / 3) * DAY
  const recency = (t: number) => Math.pow(0.5, (end - t) / halfLife)
  const activeDays = new Set(kept.map((e) => dayKey(e.r.time))).size

  const verdict = (k: string) => feedback?.verdicts[k]

  // ---------------- domains ----------------
  const domMap = new Map<string, { list: Enriched[]; days: Set<string> }>()
  for (const e of kept) {
    if (!e.root) continue
    let d = domMap.get(e.root)
    if (!d) domMap.set(e.root, (d = { list: [], days: new Set() }))
    d.list.push(e)
    d.days.add(dayKey(e.r.time))
  }
  const domains: DomainStat[] = [...domMap.entries()].map(([domain, d]) => {
    const cats = new Map<string, number>()
    d.list.forEach((e) => cats.set(e.cat, (cats.get(e.cat) ?? 0) + 1))
    const category = [...cats.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return {
      domain, visits: d.list.length, days: d.days.size, firstSeen: d.list[0].r.time, lastSeen: d.list[d.list.length - 1].r.time,
      category, recency: recency(d.list[d.list.length - 1].r.time), repeat: d.days.size >= 3,
    }
  }).sort((a, b) => b.visits - a.visits)

  // ---------------- interests ----------------
  const byCat = new Map<string, Enriched[]>()
  for (const e of kept) {
    if (e.cat === 'other') continue
    let l = byCat.get(e.cat)
    if (!l) byCat.set(e.cat, (l = []))
    l.push(e)
  }
  const rawInterest = new Map<string, number>()
  for (const [cat, list] of byCat) {
    let s = 0
    for (const e of list) s += recency(e.r.time) * KIND_WEIGHT[e.r.kind]
    let w = s * (UTILITY_WEIGHT[cat] ?? 1)
    const v = verdict(`interest:${cat}`)
    if (v === 'inaccurate') w *= 0.25
    if (v === 'accurate') w *= 1.15
    rawInterest.set(cat, w)
  }
  const maxInterest = Math.max(1e-9, ...rawInterest.values())
  const interests: ScoredItem[] = [...byCat.entries()].map(([cat, list]) => {
    const days = new Set(list.map((e) => dayKey(e.r.time))).size
    const searches = list.filter((e) => e.r.kind === 'search').length
    const orders = list.filter((e) => e.r.kind === 'order').length
    const chats = list.filter((e) => e.r.kind === 'chat').length
    const domCounts = new Map<string, number>()
    list.forEach((e) => e.root && domCounts.set(e.root, (domCounts.get(e.root) ?? 0) + 1))
    const topD = [...domCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, n]) => `${d} (${n})`)
    return {
      id: cat,
      label: categoryLabel(cat),
      score: Math.round((100 * rawInterest.get(cat)!) / maxInterest),
      count: list.length,
      days,
      firstSeen: list[0].r.time,
      lastSeen: list[list.length - 1].r.time,
      confidence: confidenceFor(list.length, days),
      evidence: sampleEvidence(list, (e) => `Classified by ${e.rule}`),
      observed: `${list.length} records on ${days} different days: ${list.length - searches - orders - chats} page visits, ${searches} searches${orders ? `, ${orders} orders` : ''}${chats ? `, ${chats} of your own chat messages` : ''}. Top sites: ${topD.join(', ') || '—'}.`,
      inferred: `Interest strength ${Math.round((100 * rawInterest.get(cat)!) / maxInterest)}/100 relative to your strongest category, weighting recent activity more (half-life ${Math.round(halfLife / DAY)} days) and searches/orders above passive visits.${UTILITY_WEIGHT[cat] ? ` Counted at ${UTILITY_WEIGHT[cat] * 100}% because it is mostly tool use rather than consumer interest.` : ''}`,
    }
  }).sort((a, b) => b.score - a.score)

  // ---------------- brands ----------------
  const byBrand = new Map<string, Enriched[]>()
  for (const e of kept) for (const b of e.brands) {
    let l = byBrand.get(b.name)
    if (!l) byBrand.set(b.name, (l = []))
    l.push(e)
  }
  const rawBrand = new Map<string, number>()
  for (const [b, list] of byBrand) {
    let s = list.reduce((acc, e) => acc + recency(e.r.time) * KIND_WEIGHT[e.r.kind], 0)
    if (verdict(`brand:${b}`) === 'inaccurate') s *= 0.25
    rawBrand.set(b, s)
  }
  const maxBrand = Math.max(1e-9, ...rawBrand.values())
  const brands: ScoredItem[] = [...byBrand.entries()].map(([name, list]) => {
    const days = new Set(list.map((e) => dayKey(e.r.time))).size
    const own = BRANDS.find((b) => b.name === name)!
    const onOwnSite = list.filter((e) => e.root && own.domains.some((d) => e.r.domain?.endsWith(d))).length
    return {
      id: name, label: name, score: Math.round((100 * rawBrand.get(name)!) / maxBrand), count: list.length, days,
      firstSeen: list[0].r.time, lastSeen: list[list.length - 1].r.time, confidence: confidenceFor(list.length, days),
      evidence: sampleEvidence(list, (e) => (e.r.domain && own.domains.some((d) => e.r.domain!.endsWith(d)) ? `Visited ${name}'s own site` : `“${name}” mentioned in title or query`)),
      observed: `${list.length} records mention or visit ${name} (${onOwnSite} on its own site) across ${days} days.`,
      inferred: `Brand affinity ${Math.round((100 * rawBrand.get(name)!) / maxBrand)}/100 relative to your most-engaged brand. Mentions are not purchases — this measures attention, not loyalty.`,
    }
  }).sort((a, b) => b.score - a.score)

  // ---------------- searches ----------------
  const searches = kept.filter((e) => e.search || (e.r.kind === 'search' && e.r.text)).map((e) => ({
    text: e.search?.query ?? e.r.text!, engine: e.search?.engine ?? 'Google', time: e.r.time, category: e.cat, recordId: e.r.id,
  }))

  // ---------------- shopping ----------------
  const retailRecs = kept.filter((e) => e.retail)
  const productSearches = kept.filter((e) => e.search && RETAIL_ENGINES.has(e.search.engine))
  const retailerCounts = new Map<string, number>()
  retailRecs.forEach((e) => e.root && retailerCounts.set(e.root, (retailerCounts.get(e.root) ?? 0) + 1))

  // Price comparison: the same product terms looked up on two or more retailers within 14 days.
  const lookups = kept.filter((e) => (e.search && RETAIL_ENGINES.has(e.search.engine)) || e.product).map((e) => ({
    e, root: e.root!, toks: new Set(tokens(e.search ? e.search.query : cleanProductTitle(e.r.title, e.root!)).slice(0, 6)),
  })).filter((x) => x.toks.size >= 1)
  const comparisons: ShoppingStats['comparisons'] = []
  const used = new Set<number>()
  for (let i = 0; i < lookups.length; i++) {
    if (used.has(i)) continue
    const group = [i]
    for (let j = i + 1; j < lookups.length; j++) {
      if (lookups[j].e.r.time - lookups[i].e.r.time > 14 * DAY) break
      if (lookups[j].root === lookups[i].root || used.has(j)) continue
      const a = lookups[i].toks, b = lookups[j].toks
      const inter = [...a].filter((t) => b.has(t)).length
      if (inter >= Math.max(1, Math.min(2, Math.min(a.size, b.size)))) group.push(j)
    }
    const retailers = [...new Set(group.map((g) => lookups[g].root))]
    if (retailers.length >= 2) {
      group.forEach((g) => used.add(g))
      comparisons.push({
        term: [...lookups[i].toks].slice(0, 4).join(' '),
        retailers: retailers.map((r) => RETAILERS[r]?.name ?? r),
        evidence: group.slice(0, 5).map((g) => ev(lookups[g].e, `Looked up on ${RETAILERS[lookups[g].root]?.name ?? lookups[g].root}`)),
      })
    }
  }
  const dealRecs = kept.filter((e) => (e.root && DEAL_DOMAINS.includes(e.root)) || ((e.retail || e.search) && DEAL_WORDS.test(e.search?.query ?? e.r.title)))
  const reviewRecs = kept.filter((e) => e.search && REVIEW_WORDS.test(e.search.query) && e.cat !== 'other' && e.cat !== 'learning' && e.cat !== 'dev')
  const shopping: ShoppingStats = {
    retailerVisits: retailRecs.filter((e) => e.r.kind !== 'order').length,
    productViews: kept.filter((e) => e.product).length,
    cartEvents: kept.filter((e) => e.cart).length,
    orders: kept.filter((e) => e.r.kind === 'order').length,
    productSearches: productSearches.length,
    comparisons: comparisons.slice(0, 30),
    retailers: [...retailerCounts.entries()].map(([domain, visits]) => ({ domain, visits })).sort((a, b) => b.visits - a.visits),
    dealSignals: dealRecs.length,
    reviewSignals: reviewRecs.length,
  }

  // ---------------- time ----------------
  const hourByWeekday = Array.from({ length: 7 }, () => new Array(24).fill(0))
  const daily: Record<string, number> = {}
  for (const e of kept) {
    const d = new Date(e.r.time)
    hourByWeekday[d.getDay()][d.getHours()]++
    const k = dayKey(e.r.time)
    daily[k] = (daily[k] ?? 0) + 1
  }

  // ---------------- flows (category → next category within a session) ----------------
  const flowMap = new Map<string, number>()
  const coMap = new Map<string, { n: number; ev: Enriched[] }>()
  let sessionCats = new Set<string>()
  let sessionEv: Enriched[] = []
  const closeSession = () => {
    const cats = [...sessionCats].filter((c) => c !== 'other').sort()
    for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) {
      const k = `${cats[i]}|${cats[j]}`
      let v = coMap.get(k)
      if (!v) coMap.set(k, (v = { n: 0, ev: [] }))
      v.n++
      if (v.ev.length < 4) {
        const a = sessionEv.find((e) => e.cat === cats[i])
        const b = sessionEv.find((e) => e.cat === cats[j])
        if (a) v.ev.push(a)
        if (b) v.ev.push(b)
      }
    }
    sessionCats = new Set()
    sessionEv = []
  }
  let prev: Enriched | null = null
  for (const e of kept) {
    if (prev && e.r.time - prev.r.time > 30 * 60_000) closeSession()
    if (prev && e.r.time - prev.r.time <= 30 * 60_000 && prev.cat !== e.cat && prev.cat !== 'other' && e.cat !== 'other') {
      const k = `${prev.cat}|${e.cat}`
      flowMap.set(k, (flowMap.get(k) ?? 0) + 1)
    }
    sessionCats.add(e.cat)
    sessionEv.push(e)
    prev = e
  }
  closeSession()
  const categoryFlows = [...flowMap.entries()].map(([k, count]) => { const [from, to] = k.split('|'); return { from, to, count } })
    .sort((a, b) => b.count - a.count).slice(0, 28)

  // ---------------- repeat vs exploratory ----------------
  const totalDomVisits = domains.reduce((a, d) => a + d.visits, 0) || 1
  const repeatShare = domains.filter((d) => d.repeat).reduce((a, d) => a + d.visits, 0) / totalDomVisits
  const exploratoryShare = domains.filter((d) => d.days === 1).reduce((a, d) => a + d.visits, 0) / totalDomVisits

  // ---------------- trends ----------------
  const mid = start + (end - start) / 2
  const firstHalf = kept.filter((e) => e.r.time < mid)
  const secondHalf = kept.filter((e) => e.r.time >= mid)
  const share = (list: Enriched[], cat: string) => (list.length ? list.filter((e) => e.cat === cat).length / list.length : 0)
  const interestTrend = interests.filter((i) => i.count >= 5).map((i) => {
    const f = share(firstHalf, i.id), s = share(secondHalf, i.id)
    return { id: i.id, label: i.label, first: f, second: s, change: s - f }
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  const weeklyMap = new Map<string, Record<string, number>>()
  for (const e of kept) {
    if (e.cat === 'other') continue
    const d = new Date(e.r.time)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay())
    const wk = dayKey(d.getTime())
    let m = weeklyMap.get(wk)
    if (!m) weeklyMap.set(wk, (m = {}))
    m[e.cat] = (m[e.cat] ?? 0) + 1
  }
  const weekly = [...weeklyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, byCategory]) => ({ week, byCategory }))

  // ---------------- tendencies ----------------
  const tendencies = computeTendencies(kept, shopping, domains, spanDays, brands, feedback)

  // ---------------- segments ----------------
  const segments = computeSegments(interests, tendencies, shopping, feedback)

  // ---------------- history products ----------------
  const prodMap = new Map<string, { e: Enriched; n: number }>()
  for (const e of kept) {
    if (!e.product || !e.r.url) continue
    const u = new URL(e.r.url)
    const key = e.root + u.pathname
    const p = prodMap.get(key)
    if (p) { p.n++; p.e = e } else prodMap.set(key, { e, n: 1 })
  }
  const historyProducts: Product[] = [...prodMap.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 80).map(([key, { e, n }]) => ({
    id: 'h-' + key,
    name: cleanProductTitle(e.r.title, e.root!) || e.r.title,
    url: e.r.url!.split('?')[0],
    retailer: RETAILERS[e.root!]?.name ?? e.root!,
    brand: e.brands[0]?.name,
    category: e.cat,
    origin: 'history',
    capturedAt: e.r.time,
    priceSource: `viewed ${n}× — price not recorded in browsing history`,
  }))

  // ---------------- graph ----------------
  const graph = buildGraph(kept, interests, brands, domains, historyProducts, coMap)

  return {
    generatedAt: Date.now(),
    totalRecords: all.length,
    analyzedRecords: kept.length,
    excludedSensitive,
    excludedOther,
    span: { start, end, days: spanDays, activeDays },
    domains, interests, brands, searches, shopping, hourByWeekday, daily, categoryFlows,
    repeatShare, exploratoryShare, interestTrend, weekly, tendencies, segments, graph, historyProducts,
  }
}

// ---------------------------------------------------------------------------
// Tendencies — each is a weighted sum of named, normalized signals. A minimum
// amount of relevant evidence is required, otherwise the result is INSUFFICIENT DATA.
// ---------------------------------------------------------------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function tendency(
  id: string, label: string, low: string, high: string, enough: boolean, evidenceCount: number,
  signals: Tendency['signals'], evidence: Evidence[], method: string, limitations: string, feedback?: Feedback,
): Tendency {
  if (!enough) {
    return { id, label, low, high, score: null, confidence: 'INSUFFICIENT DATA', signals, evidence, method, limitations }
  }
  const wsum = signals.reduce((a, s) => a + s.weight, 0) || 1
  let score = Math.round((100 * signals.reduce((a, s) => a + s.value * s.weight, 0)) / wsum)
  const v = feedback?.verdicts[`tendency:${id}`]
  if (v === 'inaccurate') score = 100 - score // you told us we got the direction wrong
  const confidence: Confidence = evidenceCount >= 60 ? 'High' : evidenceCount >= 20 ? 'Medium' : 'Low'
  return { id, label, low, high, score, confidence, signals, evidence, method, limitations }
}

function computeTendencies(kept: Enriched[], shop: ShoppingStats, domains: DomainStat[], spanDays: number, brands: ScoredItem[], feedback?: Feedback): Tendency[] {
  const out: Tendency[] = []
  const shopRecs = kept.filter((e) => e.retail || (e.search && RETAIL_ENGINES.has(e.search.engine)))
  const nShop = shopRecs.length

  // Price sensitivity
  const dealRecs = kept.filter((e) => (e.root && DEAL_DOMAINS.includes(e.root)) || ((e.retail || e.search) && DEAL_WORDS.test(e.search?.query ?? e.r.title)))
  const valueVisits = shopRecs.filter((e) => e.root && RETAILERS[e.root]?.tier === 'value').length
  out.push(tendency('price', 'Price sensitivity', 'Price-indifferent', 'Price-sensitive', nShop >= 15, nShop, [
    { label: 'Deal / discount language', value: clamp01((dealRecs.length / Math.max(1, nShop)) / 0.25), weight: 0.4, detail: `${dealRecs.length} deal-related records ÷ ${nShop} shopping records (25% = max)` },
    { label: 'Cross-retailer price comparison', value: clamp01(shop.comparisons.length / 6), weight: 0.35, detail: `${shop.comparisons.length} products looked up on 2+ retailers within 14 days (6 = max)` },
    { label: 'Value-retailer share', value: clamp01((valueVisits / Math.max(1, nShop)) / 0.6), weight: 0.25, detail: `${valueVisits} of ${nShop} shopping records on value retailers (Walmart, Costco, Temu…)` },
  ], sampleEvidence(dealRecs, () => 'Deal/discount signal'), 'Weighted average of deal-language rate (40%), cross-retailer comparisons (35%) and value-retailer share (25%).', 'Looking at deals is not the same as only buying on price. Browsing history cannot see what you actually paid unless you import orders.', feedback))

  // Novelty seeking
  const distinct = domains.length
  const oneOff = domains.filter((d) => d.days === 1).length
  const catCounts = new Map<string, number>()
  kept.forEach((e) => e.cat !== 'other' && catCounts.set(e.cat, (catCounts.get(e.cat) ?? 0) + 1))
  const tot = [...catCounts.values()].reduce((a, b) => a + b, 0) || 1
  const entropy = -[...catCounts.values()].reduce((a, n) => a + (n / tot) * Math.log(n / tot), 0) / Math.log(Math.max(2, CATEGORIES.length))
  const newPerWeek = distinct / Math.max(1, spanDays / 7)
  out.push(tendency('novelty', 'Novelty seeking', 'Routine-oriented', 'Novelty-seeking', kept.length >= 100 && distinct >= 10, kept.length / 10, [
    { label: 'One-off sites', value: clamp01((oneOff / Math.max(1, distinct)) / 0.7), weight: 0.4, detail: `${oneOff} of ${distinct} sites visited on only one day` },
    { label: 'Category spread (entropy)', value: clamp01(entropy / 0.75), weight: 0.35, detail: `normalized entropy ${entropy.toFixed(2)} across interest categories` },
    { label: 'New sites per week', value: clamp01(newPerWeek / 40), weight: 0.25, detail: `${newPerWeek.toFixed(1)} distinct sites per week (40 = max)` },
  ], sampleEvidence(kept.filter((e) => e.root && domains.find((d) => d.domain === e.root)?.days === 1), () => 'Site visited on a single day'), 'Weighted average of one-off site share (40%), category entropy (35%) and new-site rate (25%).', 'High novelty can reflect school or work research rather than personal taste. Not a validated personality measure.', feedback))

  // Brand exploration
  const mentions = brands.reduce((a, b) => a + b.count, 0)
  const topShare = brands.length ? brands[0].count / Math.max(1, mentions) : 0
  out.push(tendency('brand', 'Brand exploration', 'Brand-loyal', 'Brand-exploring', mentions >= 10 && brands.length >= 2, mentions, [
    { label: 'Distinct brands engaged', value: clamp01(brands.length / 20), weight: 0.5, detail: `${brands.length} distinct brands (20 = max)` },
    { label: 'Not dominated by one brand', value: clamp01(1 - topShare), weight: 0.5, detail: `top brand (${brands[0]?.label ?? '—'}) = ${(topShare * 100).toFixed(0)}% of brand mentions` },
  ], brands.slice(0, 6).map((b) => ({ recordId: b.evidence[0]?.recordId ?? b.id, time: b.lastSeen, title: `${b.label}: ${b.count} mentions`, why: 'Brand engagement count' })), 'Equal blend of number of distinct brands and (1 − share of the most-mentioned brand).', 'Only brands in the built-in dictionary (~75) are detected; niche brands are invisible to this method.', feedback))

  // Convenience orientation
  const oneStop = shopRecs.filter((e) => e.root && RETAILERS[e.root]?.oneStop).length
  const convRecs = kept.filter((e) => CONVENIENCE_WORDS.test(e.search?.query ?? e.r.title) || ['doordash.com', 'ubereats.com', 'instacart.com', 'grubhub.com'].includes(e.root ?? ''))
  out.push(tendency('convenience', 'Convenience orientation', 'Effort-tolerant', 'Convenience-first', nShop + convRecs.length >= 15, nShop + convRecs.length, [
    { label: 'One-stop retailer share', value: clamp01((oneStop / Math.max(1, nShop)) / 0.8), weight: 0.55, detail: `${oneStop} of ${nShop} shopping records on one-stop retailers (Amazon, Walmart, Target, delivery apps)` },
    { label: 'Delivery / speed language & apps', value: clamp01(convRecs.length / Math.max(1, nShop) / 0.3), weight: 0.45, detail: `${convRecs.length} delivery/same-day/pickup signals` },
  ], sampleEvidence(convRecs.length ? convRecs : shopRecs.filter((e) => e.root && RETAILERS[e.root]?.oneStop), () => 'Convenience signal'), 'Weighted blend of one-stop retailer share (55%) and delivery/speed signals (45%).', 'Using Amazon is close to a default for many people, so a high score is common and weakly discriminating.', feedback))

  // Research intensity
  const reviewSearches = kept.filter((e) => e.search && REVIEW_WORDS.test(e.search.query))
  const productLookups = shop.productViews + shop.productSearches
  const prodRepeat = (() => {
    const m = new Map<string, number>()
    kept.filter((e) => e.product && e.r.url).forEach((e) => { const k = new URL(e.r.url!).pathname; m.set(k, (m.get(k) ?? 0) + 1) })
    const vals = [...m.values()]
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })()
  out.push(tendency('research', 'Research intensity', 'Impulsive', 'Deliberate researcher', productLookups + reviewSearches.length >= 10, productLookups + reviewSearches.length, [
    { label: 'Review / comparison searches', value: clamp01(reviewSearches.length / 25), weight: 0.4, detail: `${reviewSearches.length} searches containing review, vs, best, compare… (25 = max)` },
    { label: 'Repeat views of the same product', value: clamp01((prodRepeat - 1) / 2), weight: 0.3, detail: `${prodRepeat.toFixed(2)} views per distinct product page` },
    { label: 'Cross-retailer comparisons', value: clamp01(shop.comparisons.length / 6), weight: 0.3, detail: `${shop.comparisons.length} comparisons` },
  ], sampleEvidence(reviewSearches, () => 'Review / comparison search'), 'Weighted blend of review-style searches (40%), repeat product views (30%) and cross-retailer comparisons (30%).', 'Review searches about software or school topics also count; the classifier cannot always tell purchase research from homework.', feedback))

  // Premium vs value
  let prem = 0, val = 0
  const tierEv: Enriched[] = []
  for (const e of kept) {
    let hit = false
    for (const b of e.brands) { if (b.tier === 'premium') { prem++; hit = true } else if (b.tier === 'value') { val++; hit = true } }
    const rt = e.root ? RETAILERS[e.root]?.tier : undefined
    if (rt === 'premium') { prem++; hit = true } else if (rt === 'value') { val++; hit = true }
    if (e.retail && PREMIUM_WORDS.test(e.r.title)) { prem += 0.5; hit = true }
    if (hit) tierEv.push(e)
  }
  out.push(tendency('premium', 'Premium vs. value', 'Value-oriented', 'Premium-oriented', prem + val >= 8, prem + val, [
    { label: 'Premium share of tiered brand/retailer signals', value: prem / Math.max(1, prem + val), weight: 1, detail: `${prem.toFixed(1)} premium vs ${val.toFixed(1)} value signals` },
  ], sampleEvidence(tierEv, (e) => (e.brands.some((b) => b.tier === 'premium') || (e.root && RETAILERS[e.root]?.tier === 'premium') ? 'Premium-tier brand or retailer' : 'Value-tier brand or retailer')), 'Premium signals ÷ (premium + value signals), using a hand-labeled tier for each brand and retailer.', 'Tier labels are coarse and US-centric; "mid" brands such as Nike or Samsung are ignored.', feedback))

  return out
}

// ---------------------------------------------------------------------------
// Segments — transparent weighted criteria; overlapping membership allowed.
// ---------------------------------------------------------------------------
const SEGMENT_DEFS: { id: string; label: string; description: string; criteria: { key: string; weight: number; invert?: boolean }[] }[] = [
  { id: 'tech', label: 'Tech Enthusiast', description: 'Follows devices, software and the tools behind them.', criteria: [{ key: 'i:tech', weight: 0.45 }, { key: 'i:dev', weight: 0.25 }, { key: 'i:ai', weight: 0.2 }, { key: 'i:gaming', weight: 0.1 }] },
  { id: 'ai', label: 'AI Early Adopter', description: 'Uses and reads about AI products ahead of the mainstream.', criteria: [{ key: 'i:ai', weight: 0.75 }, { key: 'i:dev', weight: 0.25 }] },
  { id: 'deal', label: 'Deal Hunter', description: 'Compares prices and gravitates to discounts and value retailers.', criteria: [{ key: 't:price', weight: 0.7 }, { key: 't:premium', weight: 0.3, invert: true }] },
  { id: 'research', label: 'Deliberate Researcher', description: 'Reads reviews and compares before buying.', criteria: [{ key: 't:research', weight: 0.8 }, { key: 'x:comparisons', weight: 0.2 }] },
  { id: 'convenience', label: 'Convenience Seeker', description: 'Prefers one-stop shops and fast delivery.', criteria: [{ key: 't:convenience', weight: 0.75 }, { key: 'i:food', weight: 0.25 }] },
  { id: 'premium', label: 'Premium Brand Buyer', description: 'Leans toward premium brands and stores.', criteria: [{ key: 't:premium', weight: 0.7 }, { key: 't:brand', weight: 0.3, invert: true }] },
  { id: 'career', label: 'Career Builder', description: 'Actively job-hunting, networking and upskilling.', criteria: [{ key: 'i:careers', weight: 0.6 }, { key: 'i:learning', weight: 0.2 }, { key: 'i:productivity', weight: 0.2 }] },
  { id: 'finance', label: 'Finance-Minded', description: 'Follows markets, investing and personal finance.', criteria: [{ key: 'i:finance', weight: 1 }] },
  { id: 'entertainment', label: 'Streaming & Entertainment Fan', description: 'Heavy video, music and pop-culture consumption.', criteria: [{ key: 'i:entertainment', weight: 0.6 }, { key: 'i:music', weight: 0.2 }, { key: 'i:gaming', weight: 0.2 }] },
  { id: 'style', label: 'Style Seeker', description: 'Browses fashion, sneakers and grooming.', criteria: [{ key: 'i:fashion', weight: 0.7 }, { key: 'i:beauty', weight: 0.3 }] },
  { id: 'home', label: 'Home & Food Focused', description: 'Spends attention on home, cooking and dining.', criteria: [{ key: 'i:home', weight: 0.5 }, { key: 'i:food', weight: 0.5 }] },
  { id: 'explorer', label: 'Explorer', description: 'Seeks out travel and new experiences.', criteria: [{ key: 'i:travel', weight: 0.55 }, { key: 't:novelty', weight: 0.45 }] },
  { id: 'sports', label: 'Sports & Active', description: 'Follows sports or outdoor activity.', criteria: [{ key: 'i:sports', weight: 1 }] },
  { id: 'creator', label: 'Creator', description: 'Makes things — design, media, code.', criteria: [{ key: 'i:design', weight: 0.6 }, { key: 'i:ai', weight: 0.2 }, { key: 'i:dev', weight: 0.2 }] },
  { id: 'learner', label: 'Lifelong Learner', description: 'Constantly studying, reading and taking courses.', criteria: [{ key: 'i:learning', weight: 0.7 }, { key: 'i:books', weight: 0.3 }] },
]

const segmentFeatureLabel = (key: string) => {
  const [kind, id] = key.split(':')
  if (kind === 'i') return `${categoryLabel(id)} interest`
  if (kind === 't') return ({ price: 'Price sensitivity', novelty: 'Novelty seeking', brand: 'Brand exploration', convenience: 'Convenience orientation', research: 'Research intensity', premium: 'Premium orientation' } as Record<string, string>)[id] ?? id
  return 'Cross-retailer comparisons'
}

function computeSegments(interests: ScoredItem[], tendencies: Tendency[], shop: ShoppingStats, feedback?: Feedback): Segment[] {
  const get = (key: string): number | null => {
    const [kind, id] = key.split(':')
    if (kind === 'i') { const it = interests.find((i) => i.id === id); return it ? (it.confidence === 'INSUFFICIENT DATA' ? 0 : it.score / 100) : 0 }
    if (kind === 't') { const t = tendencies.find((x) => x.id === id); return t && t.score != null ? t.score / 100 : null }
    return clamp01(shop.comparisons.length / 6)
  }
  return SEGMENT_DEFS.map((d) => {
    const criteria = d.criteria.map((c) => {
      const v = get(c.key)
      return { label: segmentFeatureLabel(c.key) + (c.invert ? ' (inverted)' : ''), value: v == null ? NaN : c.invert ? 1 - v : v, weight: c.weight }
    })
    const valid = criteria.filter((c) => !Number.isNaN(c.value))
    const wsum = valid.reduce((a, c) => a + c.weight, 0)
    if (!valid.length || wsum < 0.5) {
      return { id: d.id, label: d.label, description: d.description, score: 0, member: false, confidence: 'INSUFFICIENT DATA' as Confidence, criteria }
    }
    let score = Math.round((100 * valid.reduce((a, c) => a + c.value * c.weight, 0)) / wsum)
    const v = feedback?.verdicts[`segment:${d.id}`]
    if (v === 'inaccurate') score = Math.min(score, 20)
    const confidence: Confidence = wsum >= 0.99 ? (score >= 70 ? 'High' : 'Medium') : 'Low'
    return { id: d.id, label: d.label, description: d.description, score, member: score >= 50, confidence, criteria }
  }).sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// Interest Universe graph
// ---------------------------------------------------------------------------
function buildGraph(kept: Enriched[], interests: ScoredItem[], brands: ScoredItem[], domains: DomainStat[], products: Product[], coMap: Map<string, { n: number; ev: Enriched[] }>) {
  const nodes: GraphNode[] = []
  const edges = new Map<string, GraphEdge>()
  const nodeIds = new Set<string>()
  const addEdge = (a: string, b: string, w: number, method: string, evid: Evidence[]) => {
    if (!nodeIds.has(a) || !nodeIds.has(b) || a === b) return
    const id = a < b ? `${a}~${b}` : `${b}~${a}`
    const ex = edges.get(id)
    if (ex) { ex.weight += w; if (ex.evidence.length < 6) ex.evidence.push(...evid.slice(0, 6 - ex.evidence.length)) } else edges.set(id, { id, source: a, target: b, weight: w, method, evidence: evid.slice(0, 6) })
  }

  for (const i of interests.filter((x) => x.count >= 3)) {
    nodes.push({ id: `interest:${i.id}`, label: i.label, type: 'interest', weight: i.score, category: i.id, evidence: i.evidence, method: i.inferred })
    nodeIds.add(`interest:${i.id}`)
  }
  const topDomains = domains.filter((d) => d.visits >= 2).slice(0, 70)
  for (const d of topDomains) {
    nodes.push({ id: `domain:${d.domain}`, label: d.domain, type: 'domain', weight: d.visits, category: d.category, evidence: [], method: `${d.visits} visits on ${d.days} days; dominant category ${categoryLabel(d.category)}` })
    nodeIds.add(`domain:${d.domain}`)
  }
  for (const b of brands.filter((x) => x.count >= 2).slice(0, 40)) {
    const own = BRANDS.find((x) => x.name === b.id)
    nodes.push({ id: `brand:${b.id}`, label: b.label, type: 'brand', weight: b.count, category: own?.category, evidence: b.evidence, method: b.observed })
    nodeIds.add(`brand:${b.id}`)
  }
  // searches: group by normalized query
  const sq = new Map<string, Enriched[]>()
  for (const e of kept) {
    const q = e.search?.query ?? (e.r.kind === 'search' ? e.r.text : undefined)
    if (!q) continue
    const k = q.toLowerCase().trim()
    let l = sq.get(k)
    if (!l) sq.set(k, (l = []))
    l.push(e)
  }
  const topSearches = [...sq.entries()].filter(([, l]) => l[0].cat !== 'other').sort((a, b) => b[1].length - a[1].length).slice(0, 45)
  for (const [q, l] of topSearches) {
    nodes.push({ id: `search:${q}`, label: `“${q.length > 38 ? q.slice(0, 36) + '…' : q}”`, type: 'search', weight: l.length, category: l[0].cat, evidence: sampleEvidence(l, () => 'Search you made'), method: `Searched ${l.length}× via ${[...new Set(l.map((e) => e.search?.engine ?? 'Google'))].join(', ')}` })
    nodeIds.add(`search:${q}`)
  }
  for (const p of products.slice(0, 25)) {
    nodes.push({ id: `product:${p.id}`, label: p.name.length > 40 ? p.name.slice(0, 38) + '…' : p.name, type: 'product', weight: 2, category: p.category, evidence: [{ recordId: p.id, time: p.capturedAt ?? 0, title: p.name, url: p.url, why: p.priceSource ?? 'Product page you visited' }], method: `Product page on ${p.retailer}; ${p.priceSource}` })
    nodeIds.add(`product:${p.id}`)
  }

  // domain → interest
  const domEv = new Map<string, Enriched[]>()
  for (const e of kept) if (e.root) { let l = domEv.get(e.root); if (!l) domEv.set(e.root, (l = [])); l.push(e) }
  for (const d of topDomains) {
    const list = domEv.get(d.domain) ?? []
    const perCat = new Map<string, Enriched[]>()
    list.forEach((e) => { if (e.cat === 'other') return; let l = perCat.get(e.cat); if (!l) perCat.set(e.cat, (l = [])); l.push(e) })
    for (const [cat, l] of perCat) {
      if (l.length < Math.max(2, list.length * 0.08)) continue
      addEdge(`domain:${d.domain}`, `interest:${cat}`, l.length, `${l.length} of ${list.length} records on ${d.domain} were classified as ${categoryLabel(cat)}`, sampleEvidence(l, (e) => `Classified by ${e.rule}`, 5))
    }
    const n = nodes.find((x) => x.id === `domain:${d.domain}`)
    if (n) n.evidence = sampleEvidence(list, () => `Visit to ${d.domain}`, 6)
  }
  // brand → interest, brand → domain
  for (const b of brands.filter((x) => x.count >= 2).slice(0, 40)) {
    const list = kept.filter((e) => e.brands.some((x) => x.name === b.id))
    const perCat = new Map<string, Enriched[]>()
    const perDom = new Map<string, Enriched[]>()
    list.forEach((e) => {
      if (e.cat !== 'other') { let l = perCat.get(e.cat); if (!l) perCat.set(e.cat, (l = [])); l.push(e) }
      if (e.root) { let l = perDom.get(e.root); if (!l) perDom.set(e.root, (l = [])); l.push(e) }
    })
    for (const [cat, l] of perCat) addEdge(`brand:${b.id}`, `interest:${cat}`, l.length, `${b.label} appeared in ${l.length} ${categoryLabel(cat)} records`, sampleEvidence(l, () => `Mentions ${b.label}`, 5))
    for (const [dom, l] of perDom) addEdge(`brand:${b.id}`, `domain:${dom}`, l.length, `${b.label} seen ${l.length}× on ${dom}`, sampleEvidence(l, () => `Mentions ${b.label}`, 5))
  }
  // search → interest / brand
  for (const [q, l] of topSearches) {
    addEdge(`search:${q}`, `interest:${l[0].cat}`, l.length, `Query classified as ${categoryLabel(l[0].cat)} (${l[0].rule})`, sampleEvidence(l, () => 'Search', 3))
    for (const b of l[0].brands) addEdge(`search:${q}`, `brand:${b.name}`, l.length, `Query mentions ${b.name}`, sampleEvidence(l, () => 'Search', 3))
    const engine = l[0].search?.engine
    const engineRoot = l[0].root
    if (engine && RETAIL_ENGINES.has(engine) && engineRoot) addEdge(`search:${q}`, `domain:${engineRoot}`, l.length, `Searched on ${engine}`, sampleEvidence(l, () => 'Search', 3))
  }
  // product → retailer / interest / brand
  for (const p of products.slice(0, 25)) {
    const root = Object.entries(RETAILERS).find(([, r]) => r.name === p.retailer)?.[0] ?? p.retailer
    const evd = [{ recordId: p.id, time: p.capturedAt ?? 0, title: p.name, url: p.url, why: 'Product page you visited' }]
    addEdge(`product:${p.id}`, `domain:${root}`, 2, `Viewed on ${p.retailer}`, evd)
    if (p.category) addEdge(`product:${p.id}`, `interest:${p.category}`, 2, `Product title classified as ${categoryLabel(p.category)}`, evd)
    if (p.brand) addEdge(`product:${p.id}`, `brand:${p.brand}`, 2, `Product title mentions ${p.brand}`, evd)
  }
  // interest ↔ interest co-occurrence in sessions
  for (const [k, v] of coMap) {
    if (v.n < 3) continue
    const [a, b] = k.split('|')
    addEdge(`interest:${a}`, `interest:${b}`, v.n, `Both appeared in the same browsing session (≤30 min gaps) ${v.n} times`, v.ev.slice(0, 4).map((e) => ev(e, `Session record (${categoryLabel(e.cat)})`)))
  }

  // drop isolated nodes
  const connected = new Set<string>()
  for (const e of edges.values()) { connected.add(e.source); connected.add(e.target) }
  return { nodes: nodes.filter((n) => connected.has(n.id) || n.type === 'interest'), edges: [...edges.values()] }
}
