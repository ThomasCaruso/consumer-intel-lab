import type { Feedback, Product, Profile } from './types'
import { categoryLabel, classify, findBrands } from './taxonomy'
import { tokens } from './analyze'

export interface Recommendation {
  product: Product
  score: number
  parts: { label: string; value: number; weight: number; detail: string }[]
  explanation: string
}

/**
 * Match score = 50% category affinity + 25% brand affinity + 25% overlap with your own search terms,
 * then nudged by the price-sensitivity tendency when a verified price exists.
 * Nothing about the product is invented: fields that are missing stay missing.
 */
export function recommend(products: Product[], profile: Profile, feedback?: Feedback): Recommendation[] {
  const interest = new Map(profile.interests.map((i) => [i.id, i]))
  const brand = new Map(profile.brands.map((b) => [b.id, b]))
  const searchTokens = new Map<string, number>()
  for (const s of profile.searches) for (const t of tokens(s.text)) searchTokens.set(t, (searchTokens.get(t) ?? 0) + 1)
  const price = profile.tendencies.find((t) => t.id === 'price')
  const priceSens = price?.score != null ? price.score / 100 : null

  // median verified price per category for the price nudge
  const byCat = new Map<string, number[]>()
  const catOf = (p: Product) => p.category && interest.has(p.category) ? p.category : classify(p.url, p.name).category
  for (const p of products) if (p.price != null) { const c = catOf(p); byCat.set(c, [...(byCat.get(c) ?? []), p.price]) }
  const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

  return products.map((p) => {
    const cat = catOf(p)
    const it = interest.get(cat)
    const selfRated = feedback?.selfRated[cat]
    const verdict = feedback?.verdicts[`interest:${cat}`]
    let catAff = it && it.confidence !== 'INSUFFICIENT DATA' ? it.score / 100 : 0
    if (verdict === 'inaccurate') catAff *= 0.25
    if (selfRated != null) catAff = 0.5 * catAff + 0.5 * (selfRated / 5)

    const pb = p.brand ? [{ name: p.brand }] : findBrands(p.url, p.name)
    const bAff = pb.reduce((m, b) => Math.max(m, (brand.get(b.name)?.score ?? 0) / 100), 0)

    const ptoks = tokens(p.name)
    const hits = ptoks.filter((t) => searchTokens.has(t))
    const sAff = Math.min(1, hits.length / 3)

    const parts: Recommendation['parts'] = [
      { label: 'Category affinity', value: catAff, weight: 0.5, detail: it ? `${categoryLabel(cat)} interest ${it.score}/100${selfRated != null ? `, your self-rating ${selfRated}/5` : ''}` : `${categoryLabel(cat)} — no measured interest` },
      { label: 'Brand affinity', value: bAff, weight: 0.25, detail: pb.length ? `${pb.map((b) => b.name).join(', ')}: ${Math.round(bAff * 100)}/100` : 'No known brand detected' },
      { label: 'Matches your searches', value: sAff, weight: 0.25, detail: hits.length ? `Shares terms with your searches: ${hits.slice(0, 5).join(', ')}` : 'No overlap with your search terms' },
    ]
    let score = parts.reduce((a, x) => a + x.value * x.weight, 0)
    if (priceSens != null && p.price != null) {
      const med = median(byCat.get(cat) ?? [p.price])
      const rel = med > 0 ? p.price / med : 1
      const nudge = (priceSens - 0.5) * (1 - Math.min(2, rel)) * 0.15
      parts.push({ label: 'Price fit', value: nudge, weight: 1, detail: `$${p.price.toFixed(2)} vs. median $${med.toFixed(2)} among your ${categoryLabel(cat)} products; price-sensitivity ${Math.round(priceSens * 100)}/100` })
      score += nudge
    }
    score = Math.max(0, Math.min(1, score))

    const why: string[] = []
    if (it && catAff > 0.2) why.push(`you show ${it.confidence === 'High' ? 'strong' : 'some'} interest in ${categoryLabel(cat)} (${it.count} records)`)
    if (bAff > 0.15) why.push(`you engage with ${pb.map((b) => b.name).join('/')}`)
    if (hits.length) why.push(`it matches things you searched for (“${hits.slice(0, 3).join('”, “')}”)`)
    const explanation = why.length ? `Recommended because ${why.join(', and ')}.` : 'Weak match: little connects this product to your measured profile.'
    return { product: p, score: Math.round(score * 100), parts, explanation }
  }).sort((a, b) => b.score - a.score)
}

/** Real retailer search links (no products invented) for a term. */
export function retailerSearchLinks(term: string) {
  const q = encodeURIComponent(term)
  return [
    { name: 'Amazon', url: `https://www.amazon.com/s?k=${q}` },
    { name: 'Walmart', url: `https://www.walmart.com/search?q=${q}` },
    { name: 'Target', url: `https://www.target.com/s?searchTerm=${q}` },
    { name: 'Best Buy', url: `https://www.bestbuy.com/site/searchpage.jsp?st=${q}` },
  ]
}
