import { useState } from 'react'
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { ImportDrop } from '../components/Connect'
import { Panel, fmtDateTime } from '../components/ui'
import { RETAILERS, domainOf, rootDomain } from '../lib/taxonomy'
import { retailerSearchLinks } from '../lib/recommend'
import type { Product } from '../lib/types'

export default function Discovery() {
  const { profile, captured, catalog, extension, syncCaptured, removeProduct } = useStore()
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const open = () => {
    setMsg(null)
    let u: URL
    try { u = new URL(url.trim()) } catch { setMsg('Enter a full retailer URL starting with https://'); return }
    if (u.protocol !== 'https:') { setMsg('Only https retailer links are opened.'); return }
    const root = rootDomain(domainOf(u.href) ?? '')
    window.open(u.href, '_blank', 'noopener')
    setMsg(`${RETAILERS[root]?.name ?? root} opened in a new tab. On a product page, click the CI Lab extension icon → “Capture product on this page”, then press “Sync captured products” here.`)
  }

  const topTerms = profile
    ? [...new Map(profile.searches.filter((s) => ['Amazon', 'Walmart', 'Target', 'Best Buy', 'eBay', 'Etsy'].includes(s.engine)).reverse().map((s) => [s.text.toLowerCase(), s])).values()].slice(0, 6).map((s) => s.text)
    : []
  const interestTerms = profile?.interests.filter((i) => i.confidence !== 'INSUFFICIENT DATA' && !['productivity', 'social', 'learning', 'news', 'dev', 'careers', 'shopping'].includes(i.id)).slice(0, 4) ?? []

  const all: Product[] = [...captured, ...catalog]

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g2">
        <Panel title="Open a retailer page" sub="Paste an Amazon, Walmart, Target, Best Buy (or any store) link. The page opens in your browser like normal — this dashboard never fetches or scrapes it.">
          <div className="stack">
            <div className="row">
              <input className="input" style={{ flex: 1 }} placeholder="https://www.bestbuy.com/site/…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && open()} aria-label="Retailer URL" />
              <button className="btn primary" onClick={open}>Open</button>
            </div>
            {msg && <div className="callout small">{msg}</div>}
            <div className="callout small">
              <b>How capture works.</b> When you click <i>Capture</i> in the extension, it reads the product data the retailer itself publishes for search engines (schema.org / Open Graph) from the page you are already looking at. No background requests, no crawling, no anti-bot circumvention. If a store publishes no structured data, nothing is captured — import a catalog file instead.
            </div>
            <div className="row">
              <button className="btn" onClick={syncCaptured} disabled={!extension.installed}><RefreshCw size={14} /> Sync captured products</button>
              <span className="small muted">{extension.installed ? `${captured.length} captured in the extension` : 'Extension not detected — capture unavailable; catalog import still works.'}</span>
            </div>
          </div>
        </Panel>
        <Panel title="Start from your profile" sub="Real retailer search links for your own product searches and top interests. Open one, then capture products you like.">
          <div className="stack small">
            {topTerms.length === 0 && interestTerms.length === 0 && <p className="muted">INSUFFICIENT DATA — connect your history to get starting points.</p>}
            {topTerms.map((t) => <SearchRow key={t} term={t} why="you searched this on a retailer" />)}
            {interestTerms.map((i) => <SearchRow key={i.id} term={i.label.replace(/ & .*/, '').toLowerCase()} why={`top interest (${i.score}/100)`} />)}
          </div>
        </Panel>
      </div>

      <Panel title="Import a product catalog" sub="CSV or JSON with at least name + url columns (optional: price, image, brand, category). Prices from your file are labeled as such.">
        <ImportDrop />
      </Panel>

      <Panel title={`Product pool · ${all.length} real products`} sub="Everything here came from a page you opened or a file you supplied. Products seen in your history (without prices) are added automatically on the Recommendations page.">
        {all.length === 0 ? <p className="muted small">No products yet.</p> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Product</th><th>Retailer</th><th>Price</th><th>Source</th><th></th></tr></thead>
              <tbody>
                {all.map((p) => (
                  <tr key={p.id}>
                    <td className="clip"><a href={p.url} target="_blank" rel="noreferrer noopener">{p.name}</a></td>
                    <td>{p.retailer}</td>
                    <td className="mono">{p.price != null ? `${p.currency && p.currency !== 'USD' ? p.currency + ' ' : '$'}${p.price.toFixed(2)}` : <span className="muted">not listed</span>}</td>
                    <td className="small muted">{p.origin === 'capture' ? `captured ${p.capturedAt ? fmtDateTime(p.capturedAt) : ''}` : 'catalog file'}</td>
                    <td><button className="icon-btn" aria-label="Remove product" onClick={() => removeProduct(p)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

function SearchRow({ term, why }: { term: string; why: string }) {
  return (
    <div className="row between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
      <div><b>“{term}”</b><div className="muted">{why}</div></div>
      <div className="row">{retailerSearchLinks(term).map((l) => <a key={l.name} className="btn sm" href={l.url} target="_blank" rel="noreferrer noopener">{l.name} <ExternalLink size={11} /></a>)}</div>
    </div>
  )
}
