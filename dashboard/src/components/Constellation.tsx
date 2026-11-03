import { useMemo } from 'react'
import type { ScoredItem } from '../lib/types'
import { categoryColor } from '../lib/taxonomy'
import { useTooltip } from './ui'

const W = 720, H = 440, CX = W / 2, CY = H / 2

export default function Constellation({ items, selected, onSelect }: { items: ScoredItem[]; selected?: string; onSelect: (i: ScoredItem) => void }) {
  const tip = useTooltip()
  const placed = useMemo(() => {
    const maxCount = Math.max(1, ...items.map((i) => i.count))
    return items.map((it, i) => {
      const angle = i * 2.39996 - Math.PI / 2 // golden angle spreads planets evenly
      const rr = 92 + (1 - it.score / 100) * 118
      const size = 9 + Math.sqrt(it.count / maxCount) * 26
      return { it, x: CX + Math.cos(angle) * rr * 1.45, y: CY + Math.sin(angle) * rr, size, delay: i * 60 }
    })
  }, [items])

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Interest constellation">
        <defs>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        {[92, 151, 210].map((r, i) => (
          <ellipse key={r} cx={CX} cy={CY} rx={r * 1.45} ry={r} fill="none" stroke="var(--line-2)" strokeDasharray={i === 2 ? '2 6' : '4 6'} opacity={0.8} />
        ))}
        {[['strong', 92], ['moderate', 151], ['weak', 210]].map(([l, r]) => (
          <text key={l} x={CX + (r as number) * 1.45 - 4} y={CY - 4} textAnchor="end" className="svg-muted">{l}</text>
        ))}
        {placed.map((p) => (
          <line key={'l' + p.it.id} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={categoryColor(p.it.id)} strokeOpacity={0.12 + (p.it.score / 100) * 0.4} strokeWidth={1 + (p.it.score / 100) * 2} />
        ))}
        <circle cx={CX} cy={CY} r={46} fill="url(#core)" />
        <circle cx={CX} cy={CY} r={16} fill="var(--accent)" />
        <text x={CX} y={CY + 34} textAnchor="middle" className="svg-text" style={{ fontWeight: 600 }}>YOU</text>
        {placed.map((p) => {
          const on = p.it.id === selected
          const c = categoryColor(p.it.id)
          return (
            <g key={p.it.id} style={{ cursor: 'pointer', animation: `fadeIn .6s ease ${p.delay}ms both` }}
              onClick={() => onSelect(p.it)}
              onMouseMove={(e) => tip.show(e, <><b>{p.it.label}</b><div className="muted">score {p.it.score}/100 · {p.it.count.toLocaleString()} records · {p.it.days} days</div></>)}
              onMouseLeave={tip.hide}
              tabIndex={0} role="button" aria-label={`${p.it.label}, score ${p.it.score}`}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(p.it) }}>
              <circle cx={p.x} cy={p.y} r={p.size + 6} fill={c} opacity={on ? 0.35 : 0.12} filter="url(#glow)" />
              <circle cx={p.x} cy={p.y} r={p.size} fill={c} fillOpacity={0.9} stroke={on ? 'var(--ink)' : 'none'} strokeWidth={2} />
              <text x={p.x} y={p.y + p.size + 14} textAnchor="middle" className="svg-text" style={{ fontWeight: on ? 700 : 500 }}>{p.it.label}</text>
            </g>
          )
        })}
      </svg>
      {tip.el}
    </div>
  )
}
