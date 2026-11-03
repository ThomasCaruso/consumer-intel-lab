import { useMemo, useState } from 'react'
import { ExternalLink, ImageOff } from 'lucide-react'
import { useStore } from '../lib/store'
import { recommend } from '../lib/recommend'
import { NeedsData, Panel, fmtDate } from '../components/ui'

export default function Recommendations() {
  const { profile, captured, catalog, feedback } = useStore()
  const [includeHistory, setIncludeHistory] = useState(true)
  const recs = useMemo(() => {
    if (!profile) return []
    const pool = [...captured, ...catalog, ...(includeHistory ? profile.historyProducts : [])]
    return diversify(recommend(pool, profile, feedback), 3)
  }, [profile, captured, catalog, feedback, includeHistory])

  if (!profile) return <NeedsData what="Personalized recommendations" />

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <div className="callout small" style={{ flex: 1, minWidth: 280 }}>
          Every product below is real: captured from a retailer page you opened, imported from your own catalog, or a product page you visited. <b>Prices are shown only when they were read from the retailer page or your file</b> — never estimated. Ratings and availability are not shown because they were not verified.
        </div>
        <label className="row small"><input type="checkbox" checked={includeHistory} onChange={(e) => setIncludeHistory(e.target.checked)} /> Include products from my history ({profile.historyProducts.length})</label>
      </div>

      {recs.length === 0 ? (
        <Panel>
          <div className="empty">
            <h2>No products to rank yet</h2>
            <p>Capture products with the extension or import a catalog on the Product Discovery page.</p>
            <a className="btn primary" href="#/discovery">Go to Product Discovery</a>
          </div>
        </Panel>
      ) : (
        <div className="grid g3">
          {recs.slice(0, 30).map((r, i) => (
            <Panel key={r.product.id} className="product-card">
              <div className="product-card">
                <div className="img">
                  {r.product.image ? <img src={r.product.image} alt={r.product.name} loading="lazy" referrerPolicy="no-referrer" /> : <span className="muted small row"><ImageOff size={14} /> no image available</span>}
                </div>
                <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="tiny">#{i + 1} · {r.product.retailer}</div>
                    <h3 style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{r.product.name}</h3>
                  </div>
                  <ScoreRing v={r.score} />
                </div>
                <div className="row between">
                  <span style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 600 }}>{r.product.price != null ? `${r.product.currency && r.product.currency !== 'USD' ? r.product.currency + ' ' : '$'}${r.product.price.toFixed(2)}` : <span className="muted small">Price not verified</span>}</span>
                  <a className="btn sm" href={r.product.url} target="_blank" rel="noreferrer noopener">View at {r.product.retailer} <ExternalLink size={11} /></a>
                </div>
                {r.product.priceSource && <div className="small muted">{r.product.origin === 'history' ? `From your history: ${r.product.priceSource}` : `Price source: ${r.product.priceSource}`}{r.product.origin === 'history' && r.product.capturedAt ? ` · last viewed ${fmtDate(r.product.capturedAt)}` : ''}</div>}
                <p className="small ink2" style={{ margin: 0 }}>{r.explanation}</p>
                <details>
                  <summary className="small" style={{ cursor: 'pointer' }}>Score breakdown</summary>
                  <div className="stack small" style={{ marginTop: 6 }}>
                    {r.parts.map((p) => (
                      <div key={p.label}>
                        <div className="row between"><span>{p.label}</span><span className="mono">{p.weight === 1 ? (p.value >= 0 ? '+' : '') + Math.round(p.value * 100) : `${Math.round(p.value * 100)} × ${p.weight * 100}%`}</span></div>
                        <div className="muted">{p.detail}</div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreRing({ v }: { v: number }) {
  const r = 19, c = 2 * Math.PI * r
  return (
    <svg className="score-ring" viewBox="0 0 46 46" aria-label={`Match score ${v}`}>
      <circle cx={23} cy={23} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
      <circle cx={23} cy={23} r={r} fill="none" stroke="var(--accent)" strokeWidth={4} strokeDasharray={`${(v / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 23 23)" style={{ transition: 'stroke-dasharray .6s' }} />
      <text x={23} y={27} textAnchor="middle" style={{ fill: 'var(--ink)', fontSize: 12, fontFamily: 'JetBrains Mono' }}>{v}</text>
    </svg>
  )
}

/** Keep the ranking but cap each brand/retailer group at `cap` before the rest, so one brand cannot fill the page. */
function diversify<T extends { product: { brand?: string; retailer?: string } }>(recs: T[], cap: number): T[] {
  const seen = new Map<string, number>(), head: T[] = [], tail: T[] = []
  for (const r of recs) {
    const k = (r.product.brand ?? r.product.retailer ?? '').toLowerCase()
    const n = seen.get(k) ?? 0
    seen.set(k, n + 1)
    ;(k && n >= cap ? tail : head).push(r)
  }
  return [...head, ...tail]
}
