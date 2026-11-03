import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import { useStore } from '../lib/store'
import { Conf, NeedsData, Panel, useTooltip } from '../components/ui'
import type { Segment } from '../lib/types'
import { Verdict } from './Reality'

const PALETTE = ['#5ee6d0', '#a78bfa', '#ffb547', '#ff6b8b', '#7aa2ff', '#86efac', '#f472b6', '#facc15', '#67e8f9', '#fdba74', '#c084fc', '#94a3b8', '#fca5a5', '#4ade80', '#e879f9']

export default function Segments() {
  const { profile } = useStore()
  const [sel, setSel] = useState<string | null>(null)
  if (!profile) return <NeedsData what="Your consumer segments" />
  const segs = profile.segments
  const current = segs.find((s) => s.id === sel) ?? segs[0]
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g3">
        <Panel className="span2" title="Segment overlap map" sub="Each bubble is a segment, sized by your score. Bubbles overlap when the same behavior drives both — that's how one person lands in several ad audiences at once. Dashed ring = membership threshold (50).">
          <OverlapMap segs={segs} selected={current.id} onSelect={setSel} />
        </Panel>
        <Panel title={current.label} sub={current.description} right={<Conf c={current.confidence} />}>
          <div className="stack">
            <div className="row"><span style={{ fontFamily: 'Space Grotesk', fontSize: 34, fontWeight: 600 }}>{current.score}</span><span className="muted">/ 100 · {current.member ? <b style={{ color: 'var(--accent)' }}>member</b> : 'not a member'}</span></div>
            <div className="tiny">Formula</div>
            <div className="stack small">
              {current.criteria.map((c) => (
                <div key={c.label}>
                  <div className="row between"><span>{c.label}</span><span className="mono">{Number.isNaN(c.value) ? 'n/a' : Math.round(c.value * 100)} × {Math.round(c.weight * 100)}%</span></div>
                  <div className="bar"><i style={{ width: `${Number.isNaN(c.value) ? 0 : c.value * 100}%`, background: 'var(--violet)' }} /></div>
                </div>
              ))}
            </div>
            <p className="small muted">Score = Σ(value × weight) ÷ Σ(weights with data). Missing inputs (n/a) are dropped; if under half the weight has data, the segment is INSUFFICIENT DATA.</p>
            <Verdict k={`segment:${current.id}`} />
          </div>
        </Panel>
      </div>
      <Panel title="Contribution matrix" sub="Which behavioral features feed which segments. Shared columns explain the overlaps above.">
        <Matrix segs={segs} onSelect={setSel} />
      </Panel>
    </div>
  )
}

function OverlapMap({ segs, selected, onSelect }: { segs: Segment[]; selected: string; onSelect: (id: string) => void }) {
  const tip = useTooltip()
  const W = 720, H = 440
  const layout = useMemo(() => {
    const nodes = segs.map((s, i) => ({ s, i, r: 14 + (s.score / 100) * 62, x: W / 2 + Math.cos(i) * 120, y: H / 2 + Math.sin(i) * 90 }))
    // Link segments that share a driving feature with non-trivial value → they attract and overlap.
    const links: { source: number; target: number; strength: number }[] = []
    for (let a = 0; a < segs.length; a++) for (let b = a + 1; b < segs.length; b++) {
      let shared = 0
      for (const ca of segs[a].criteria) for (const cb of segs[b].criteria) {
        if (ca.label === cb.label && !Number.isNaN(ca.value)) shared += ca.value * Math.min(ca.weight, cb.weight)
      }
      if (shared > 0.02) links.push({ source: a, target: b, strength: shared })
    }
    const sim = d3.forceSimulation(nodes as (d3.SimulationNodeDatum & typeof nodes[number])[])
      .force('link', d3.forceLink(links).distance((l) => { const s = nodes[(l.source as unknown as { index: number }).index], t = nodes[(l.target as unknown as { index: number }).index]; return (s.r + t.r) * (1 - Math.min(0.55, l.strength * 1.6)) }).strength(0.4))
      .force('collide', d3.forceCollide<typeof nodes[number]>((d) => d.r * 0.82).iterations(2))
      .force('x', d3.forceX(W / 2).strength(0.02))
      .force('y', d3.forceY(H / 2).strength(0.04))
      .stop()
    for (let i = 0; i < 300; i++) sim.tick()
    nodes.forEach((n) => { n.x = Math.max(n.r, Math.min(W - n.r, n.x)); n.y = Math.max(n.r, Math.min(H - n.r, n.y)) })
    return nodes
  }, [segs])
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Segment overlap map">
        {layout.map(({ s, i, r, x, y }) => (
          <g key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: 'pointer', animation: `fadeIn .5s ease ${i * 40}ms both` }}
            onMouseMove={(e) => tip.show(e, <><b>{s.label}</b><div className="muted">{s.score}/100 · {s.member ? 'member' : 'below threshold'}</div></>)} onMouseLeave={tip.hide}>
            <circle cx={x} cy={y} r={r} fill={PALETTE[i % PALETTE.length]} fillOpacity={s.member ? 0.28 : 0.08} stroke={PALETTE[i % PALETTE.length]} strokeOpacity={s.member ? 0.9 : 0.35} strokeWidth={s.id === selected ? 3 : 1.2} />
            <circle cx={x} cy={y} r={14 + 0.5 * 62} fill="none" stroke="var(--line-2)" strokeDasharray="2 4" opacity={s.id === selected ? 1 : 0} />
            {(s.score >= 30 || s.id === selected) && <text x={x} y={y} textAnchor="middle" className="svg-text" style={{ fontWeight: s.member ? 650 : 400, opacity: s.member ? 1 : 0.7 }}>{s.label}</text>}
            <text x={x} y={s.score >= 30 || s.id === selected ? y + 14 : y + 4} textAnchor="middle" className="svg-muted">{s.score}</text>
          </g>
        ))}
      </svg>
      {tip.el}
    </div>
  )
}

function Matrix({ segs, onSelect }: { segs: Segment[]; onSelect: (id: string) => void }) {
  const features = [...new Set(segs.flatMap((s) => s.criteria.map((c) => c.label)))]
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr><th>Segment</th><th>Score</th>{features.map((f) => <th key={f} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 140, padding: '6px 4px' }}>{f}</th>)}</tr></thead>
        <tbody>
          {segs.map((s) => (
            <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(s.id)}>
              <td>{s.label} {s.member && <span className="tag-obs">member</span>}</td>
              <td className="mono">{s.confidence === 'INSUFFICIENT DATA' ? 'n/a' : s.score}</td>
              {features.map((f) => {
                const c = s.criteria.find((x) => x.label === f)
                const v = c && !Number.isNaN(c.value) ? c.value * c.weight : null
                return <td key={f} style={{ padding: 3 }}>{c ? <div title={`${f}: ${c && !Number.isNaN(c.value) ? Math.round(c.value * 100) : 'n/a'} × ${Math.round(c.weight * 100)}%`} style={{ width: 22, height: 22, borderRadius: 5, margin: '0 auto', background: v == null ? 'var(--line)' : 'var(--violet)', opacity: v == null ? 0.5 : 0.15 + Math.min(0.85, v * 1.4) }} /> : null}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
