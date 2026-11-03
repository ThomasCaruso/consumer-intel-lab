import { useState, type ReactNode } from 'react'
import { ExternalLink, Plug } from 'lucide-react'
import type { Confidence, Evidence } from '../lib/types'
import { useStore } from '../lib/store'
import { categoryColor, categoryLabel } from '../lib/taxonomy'

export const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
export const fmtDateTime = (t: number) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
export const fmtN = (n: number) => n.toLocaleString()
export const pct = (x: number) => `${Math.round(x * 100)}%`

export function Conf({ c }: { c: Confidence }) {
  return <span className={`conf ${c === 'INSUFFICIENT DATA' ? 'INSUFFICIENT' : c}`} title="Confidence, based on how many records and distinct days support this">{c === 'INSUFFICIENT DATA' ? 'INSUFFICIENT DATA' : `${c} confidence`}</span>
}

export function CatChip({ id, onClick, on }: { id: string; onClick?: () => void; on?: boolean }) {
  const content = <><i className="sw" style={{ background: categoryColor(id) }} />{categoryLabel(id)}</>
  return onClick ? <button className={`chip ${on === false ? 'off' : on ? 'on' : ''}`} onClick={onClick}>{content}</button> : <span className="chip">{content}</span>
}

export function Panel({ title, sub, right, children, className = '' }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel fade-in ${className}`}>
      {(title || right) && (
        <div className="panel-h">
          <div>{title && <h2>{title}</h2>}{sub && <p>{sub}</p>}</div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function EvidenceList({ items, max = 6 }: { items: Evidence[]; max?: number }) {
  const [all, setAll] = useState(false)
  if (!items.length) return <p className="muted small">No individual records to show.</p>
  const shown = all ? items : items.slice(0, max)
  return (
    <>
      <ul className="evidence">
        {shown.map((e, i) => (
          <li key={e.recordId + i}>
            <div className="t">{e.title}</div>
            <div className="w">
              {e.time ? fmtDateTime(e.time) + ' · ' : ''}{e.why}
              {e.url && <> · <a href={e.url} target="_blank" rel="noreferrer noopener">open <ExternalLink size={10} /></a></>}
            </div>
          </li>
        ))}
      </ul>
      {items.length > max && <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${items.length}`}</button>}
    </>
  )
}

export function Meter({ value, color }: { value: number; color?: string }) {
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>
}

/** Shown in every section until real, authorized records exist. Never substitutes demo data. */
export function NeedsData({ what }: { what: string }) {
  const { analyzing } = useStore()
  if (analyzing) return <Panel><div className="empty"><h2>Analyzing your records…</h2><p>This runs entirely in your browser.</p></div></Panel>
  return (
    <Panel>
      <div className="empty">
        <Plug size={28} style={{ color: 'var(--accent)' }} />
        <h2 style={{ marginTop: 10 }}>INSUFFICIENT DATA</h2>
        <p>{what} appears once you connect Chrome or import your own records. No sample profiles are ever shown here.</p>
        <a className="btn primary" href="#/overview" style={{ marginTop: 10 }}>Connect my data</a>
      </div>
    </Panel>
  )
}

export function ObsInf({ observed, inferred }: { observed: string; inferred: string }) {
  return (
    <div className="stack small">
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><span className="tag-obs">Observed</span><span className="ink2">{observed}</span></div>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><span className="tag-inf">Inferred</span><span className="ink2">{inferred}</span></div>
    </div>
  )
}

export function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null)
  const el = tip ? <div className="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 310), top: tip.y + 14 }}>{tip.content}</div> : null
  return { show: (ev: { clientX: number; clientY: number }, content: ReactNode) => setTip({ x: ev.clientX, y: ev.clientY, content }), hide: () => setTip(null), el }
}
