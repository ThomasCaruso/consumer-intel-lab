import { describe, expect, it } from 'vitest'
import { analyze } from '../lib/analyze'
import { importChromeHistory, importCsvText, importJsonText, importTakeoutActivityHtml, stripQuoted } from '../lib/importers'
import { recommend } from '../lib/recommend'
import { classify, extractSearch, isProductPage, isSensitive } from '../lib/taxonomy'
import { insights } from '../lib/insights'
import type { Product } from '../lib/types'
// @ts-expect-error plain JS module shared with the extension
import { isAllowedPage, scrubUrl } from '../../../extension/config.js'
import { syntheticHistory } from './fixtures'

const profileFromFixture = () => analyze(importChromeHistory(syntheticHistory(), 60).records)

describe('taxonomy', () => {
  it('classifies by domain and by search query', () => {
    expect(classify('https://github.com/x/y', 'repo').category).toBe('dev')
    expect(classify('https://www.amazon.com/s?k=gaming+laptop', 'Amazon').category).toBe('tech')
    expect(classify('https://www.youtube.com/watch?v=1', 'NBA playoffs highlights').category).toBe('sports')
  })
  it('extracts searches from engines and retailers', () => {
    expect(extractSearch('https://www.google.com/search?q=best+headphones')).toEqual({ query: 'best headphones', engine: 'Google' })
    expect(extractSearch('https://www.target.com/s?searchTerm=desk+lamp')?.engine).toBe('Target')
    expect(extractSearch('https://www.google.com/maps')).toBeNull()
  })
  it('recognizes retailer product pages by URL shape only', () => {
    expect(isProductPage('amazon.com', 'https://www.amazon.com/Foo/dp/B07QBPDWLS')).toBe(true)
    expect(isProductPage('walmart.com', 'https://www.walmart.com/ip/12345')).toBe(true)
    expect(isProductPage('amazon.com', 'https://www.amazon.com/gp/cart')).toBe(false)
  })
  it('flags sensitive health, religion, politics and sexuality records', () => {
    expect(isSensitive('https://www.webmd.com/a', 'x')).toBe(true)
    expect(isSensitive(undefined, 'church near me')).toBe(true)
    expect(isSensitive(undefined, 'election results')).toBe(true)
    expect(isSensitive('https://tinder.com', 'Tinder')).toBe(true)
    expect(isSensitive('https://github.com', 'my repo')).toBe(false)
  })
})

describe('importers', () => {
  it('parses Google Takeout BrowserHistory.json', () => {
    const json = JSON.stringify({ 'Browser History': [{ title: 'GitHub', url: 'https://github.com', time_usec: 1730000000000000 }, { title: 'bad' }] })
    const r = importJsonText(json, 'BrowserHistory.json')
    expect(r.source.kind).toBe('takeout-browser')
    expect(r.records).toHaveLength(1)
    expect(r.records[0].time).toBe(1730000000000)
    expect(r.source.skipped).toBe(1)
  })
  it('parses Google My Activity JSON searches', () => {
    const json = JSON.stringify([{ header: 'Search', title: 'Searched for running shoes', titleUrl: 'https://www.google.com/search?q=running+shoes', time: '2026-10-01T12:00:00Z' }])
    const r = importJsonText(json, 'MyActivity.json')
    expect(r.records[0].kind).toBe('search')
    expect(r.records[0].text).toBe('running shoes')
  })
  it('parses Google My Activity HTML', () => {
    const html = `<div class="outer-cell"><div class="header-cell">Search</div><div class="content-cell">Searched for <a href="https://www.google.com/search?q=desk">desk</a><br>Oct 1, 2026, 3:04:05 PM EDT</div></div>`
    const r = importTakeoutActivityHtml(html, 'MyActivity.html')
    expect(r.records).toHaveLength(1)
    expect(r.records[0].kind).toBe('search')
  })
  it('keeps only the user’s own ChatGPT messages and strips quoted material', () => {
    const conv = [{
      title: 'Laptop help', create_time: 1730000000,
      mapping: {
        a: { message: { author: { role: 'user' }, content: { parts: ['Which laptop should I buy for coding?\n> quoted review text about gaming chairs'] }, create_time: 1730000000 } },
        b: { message: { author: { role: 'assistant' }, content: { parts: ['You should consider a MacBook Air.'] }, create_time: 1730000001 } },
        c: { message: { author: { role: 'system' }, content: { parts: [''] } } },
      },
    }]
    const r = importJsonText(JSON.stringify(conv), 'conversations.json')
    expect(r.source.kind).toBe('chatgpt')
    expect(r.records).toHaveLength(1)
    expect(r.records[0].text).toContain('Which laptop')
    expect(r.records[0].text).not.toContain('gaming chairs')
    expect(r.records.some((x) => x.text?.includes('MacBook Air'))).toBe(false)
    expect(stripQuoted('mine\n```\npasted code\n```').own).toBe('mine')
  })
  it('detects order history CSVs', () => {
    const csv = 'Order Date,Product Name,Unit Price,Website\n2026-09-02,Anker USB C Charger,19.99,Amazon.com\n'
    const r = importCsvText(csv, 'Retail.OrderHistory.1.csv')
    expect(r.source.kind).toBe('orders')
    expect(r.records[0]).toMatchObject({ kind: 'order', amount: 19.99, domain: 'amazon.com' })
  })
  it('detects product catalogs and never invents missing prices', () => {
    const csv = 'name,url,price\nKeychron K2,https://www.keychron.com/products/k2,\nLogitech MX Keys,https://www.bestbuy.com/site/mx-keys/123.p,99.99\n'
    const r = importCsvText(csv, 'catalog.csv')
    expect(r.records).toHaveLength(0)
    expect(r.products).toHaveLength(2)
    expect(r.products[0].price).toBeUndefined()
    expect(r.products[1].price).toBe(99.99)
  })
})

describe('analysis', () => {
  const p = profileFromFixture()
  it('excludes sensitive and noise records from analysis', () => {
    expect(p.excludedSensitive).toBe(3)
    expect(p.excludedOther).toBeGreaterThanOrEqual(2)
    const everything = JSON.stringify(p)
    expect(everything).not.toMatch(/webmd|diabetes|church|politico|election/i)
    expect(everything).not.toMatch(/accounts\.google|localhost/i)
  })
  it('ranks interests with evidence and confidence', () => {
    const ids = p.interests.map((i) => i.id)
    expect(ids).toContain('dev')
    expect(ids).toContain('tech')
    const dev = p.interests.find((i) => i.id === 'dev')!
    expect(dev.confidence).toBe('High')
    expect(dev.evidence.length).toBeGreaterThan(0)
    expect(p.interests[0].score).toBe(100)
  })
  it('detects cross-retailer price comparison', () => {
    expect(p.shopping.comparisons.length).toBeGreaterThanOrEqual(1)
    expect(p.shopping.comparisons[0].retailers).toEqual(expect.arrayContaining(['Amazon', 'Best Buy']))
  })
  it('reports INSUFFICIENT DATA instead of guessing', () => {
    const tiny = analyze(importChromeHistory(syntheticHistory().slice(0, 3), 7).records)
    expect(tiny.tendencies.every((t) => t.score === null && t.confidence === 'INSUFFICIENT DATA')).toBe(true)
    expect(insights(tiny).some((i) => i.headline.includes('INSUFFICIENT DATA'))).toBe(true)
  })
  it('builds a connected graph whose edges carry methods and evidence', () => {
    expect(p.graph.nodes.length).toBeGreaterThan(5)
    for (const e of p.graph.edges) {
      expect(e.method.length).toBeGreaterThan(0)
      expect(p.graph.nodes.some((n) => n.id === e.source)).toBe(true)
      expect(p.graph.nodes.some((n) => n.id === e.target)).toBe(true)
    }
  })
  it('feedback re-weights the profile', () => {
    const records = importChromeHistory(syntheticHistory(), 60).records
    const before = analyze(records).interests.find((i) => i.id === 'dev')!.score
    const after = analyze(records, { verdicts: { 'interest:dev': 'inaccurate' }, selfRated: {} }).interests.find((i) => i.id === 'dev')!.score
    expect(after).toBeLessThan(before)
  })
  it('finds product pages from history without inventing prices', () => {
    expect(p.historyProducts.length).toBeGreaterThanOrEqual(1)
    expect(p.historyProducts.every((x) => x.price === undefined)).toBe(true)
  })
})

describe('recommendations', () => {
  it('ranks matching products higher and passes product fields through untouched', () => {
    const p = profileFromFixture()
    const products: Product[] = [
      { id: '1', name: 'Keychron K2 Mechanical Keyboard', url: 'https://www.amazon.com/dp/B07QBPDWLS', retailer: 'Amazon', origin: 'catalog' },
      { id: '2', name: 'Floral Summer Dress', url: 'https://www.target.com/p/dress', retailer: 'Target', origin: 'catalog', price: 25 },
    ]
    const recs = recommend(products, p)
    expect(recs[0].product.id).toBe('1')
    expect(recs[0].product.price).toBeUndefined()
    expect(recs[1].product.price).toBe(25)
    expect(recs[0].explanation).toMatch(/Recommended because/)
  })
})

describe('extension helpers', () => {
  it('only allows the dashboard origins', () => {
    expect(isAllowedPage('https://thomascaruso.github.io/consumer-intel-lab/#/overview')).toBe(true)
    expect(isAllowedPage('https://thomascaruso.github.io/other-repo/')).toBe(false)
    expect(isAllowedPage('https://evil.example/consumer-intel-lab/')).toBe(false)
    expect(isAllowedPage('http://localhost:5173/')).toBe(true)
  })
  it('scrubs credentials from URLs but keeps search terms', () => {
    const out = scrubUrl('https://user:pw@shop.example/cb?code=abc&state=xyz&access_token=t&k=keyboard&q=desk#frag')
    expect(out).toBe('https://shop.example/cb?k=keyboard&q=desk')
  })
})
