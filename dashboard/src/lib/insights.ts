import type { Confidence, Evidence, Profile } from './types'
import { RETAILERS } from './taxonomy'

export interface Insight {
  kind: 'observed' | 'inferred'
  headline: string
  detail: string
  confidence: Confidence
  evidence: Evidence[]
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`

/** Plain-language findings, each traceable to the profile numbers that produced it. */
export function insights(p: Profile): Insight[] {
  const out: Insight[] = []
  const top = p.interests.filter((i) => i.confidence !== 'INSUFFICIENT DATA')
  if (top[0]) {
    out.push({
      kind: 'inferred',
      headline: `Your strongest interest signal is ${top[0].label}`,
      detail: `${top[0].count.toLocaleString()} records over ${top[0].days} day${top[0].days === 1 ? '' : 's'}${top[1] ? `, ahead of ${top[1].label} (${top[1].score}/100)` : ''}. ${top[0].inferred}`,
      confidence: top[0].confidence,
      evidence: top[0].evidence,
    })
  }
  const rising = p.interestTrend.find((t) => t.change > 0.02)
  if (rising) {
    const it = p.interests.find((i) => i.id === rising.id)!
    out.push({
      kind: 'observed',
      headline: `${rising.label} is rising`,
      detail: `Share of your activity went from ${(rising.first * 100).toFixed(1)}% in the first half of the period to ${(rising.second * 100).toFixed(1)}% in the second half.`,
      confidence: it.confidence,
      evidence: it.evidence.slice(0, 4),
    })
  }
  const s = p.shopping
  if (s.retailerVisits + s.orders >= 5) {
    const r = s.retailers[0]
    out.push({
      kind: 'observed',
      headline: `${s.productViews.toLocaleString()} product pages viewed across ${s.retailers.length} retailers`,
      detail: `${s.retailerVisits.toLocaleString()} retailer visits, ${s.productSearches} on-site product searches, ${s.cartEvents} cart/checkout pages${s.orders ? `, ${s.orders} imported orders` : ''}. Most-used retailer: ${r ? `${RETAILERS[r.domain]?.name ?? r.domain} (${r.visits})` : '—'}.`,
      confidence: s.retailerVisits >= 30 ? 'High' : s.retailerVisits >= 10 ? 'Medium' : 'Low',
      evidence: [],
    })
  } else {
    out.push({ kind: 'observed', headline: 'Shopping behavior: INSUFFICIENT DATA', detail: `Only ${s.retailerVisits} retailer visits found. Import an order history or browse a longer period to measure shopping behavior.`, confidence: 'INSUFFICIENT DATA', evidence: [] })
  }
  if (s.comparisons.length) {
    out.push({
      kind: 'inferred',
      headline: `You price-compare: ${s.comparisons.length} product${s.comparisons.length > 1 ? 's' : ''} checked on multiple retailers`,
      detail: `e.g. “${s.comparisons[0].term}” on ${s.comparisons[0].retailers.join(' and ')} within 14 days.`,
      confidence: s.comparisons.length >= 4 ? 'Medium' : 'Low',
      evidence: s.comparisons.flatMap((c) => c.evidence).slice(0, 6),
    })
  }
  // peak time
  let best = { d: 0, h: 0, n: -1 }
  p.hourByWeekday.forEach((row, d) => row.forEach((n, h) => { if (n > best.n) best = { d, h, n } }))
  const hourTotals = Array.from({ length: 24 }, (_, h) => p.hourByWeekday.reduce((a, row) => a + row[h], 0))
  const night = hourTotals.slice(22).concat(hourTotals.slice(0, 4)).reduce((a, b) => a + b, 0) / Math.max(1, p.analyzedRecords)
  if (best.n > 0) {
    out.push({
      kind: 'observed',
      headline: `Peak activity: ${DAYS[best.d]}s around ${hourLabel(best.h)}`,
      detail: `${(night * 100).toFixed(0)}% of your activity happens between 10pm and 4am — ${night > 0.2 ? 'a night-owl pattern advertisers schedule for' : 'mostly a daytime pattern'}.`,
      confidence: p.analyzedRecords > 500 ? 'High' : p.analyzedRecords > 100 ? 'Medium' : 'Low',
      evidence: [],
    })
  }
  out.push({
    kind: 'observed',
    headline: `${Math.round(p.repeatShare * 100)}% habitual, ${Math.round(p.exploratoryShare * 100)}% one-off browsing`,
    detail: `Habitual = visits to sites you returned to on 3+ days. One-off = sites seen on a single day. ${p.domains.length.toLocaleString()} distinct sites in total.`,
    confidence: p.domains.length >= 30 ? 'High' : 'Medium',
    evidence: [],
  })
  const b = p.brands[0]
  if (b && b.count >= 3) out.push({ kind: 'inferred', headline: `Most-engaged brand: ${b.label}`, detail: b.observed + ' ' + b.inferred, confidence: b.confidence, evidence: b.evidence })
  const members = p.segments.filter((x) => x.member)
  if (members.length) out.push({ kind: 'inferred', headline: `Targetable as: ${members.slice(0, 3).map((m) => m.label).join(', ')}`, detail: `${members.length} segment memberships at score ≥ 50. See Consumer Segments for the formula behind each.`, confidence: members[0].confidence, evidence: [] })
  return out
}
