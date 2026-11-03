import * as d3 from 'd3'
import { useStore } from '../lib/store'
import { Conf, EvidenceList, NeedsData, Panel, useTooltip } from '../components/ui'
import type { Confidence, Tendency } from '../lib/types'
import { Verdict } from './Reality'

export const BAND: Record<Confidence, number> = { High: 8, Medium: 15, Low: 25, 'INSUFFICIENT DATA': 50 }

export default function Style() {
  const { profile } = useStore()
  if (!profile) return <NeedsData what="Your shopping style" />
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout warn"><b>Not a personality test.</b> These are behavioral interpretations of browsing records, computed with simple published formulas. They have not been validated against any psychological instrument, and browsing is a noisy proxy for what you actually buy or value.</div>
      <div className="grid g3">
        <Panel title="Shopping-style profile" sub="Shaded band = uncertainty from confidence level.">
          <Radar tendencies={profile.tendencies} />
        </Panel>
        <div className="span2 grid g2">
          {profile.tendencies.map((t) => <TendencyCard key={t.id} t={t} />)}
        </div>
      </div>
    </div>
  )
}

function TendencyCard({ t }: { t: Tendency }) {
  const band = BAND[t.confidence]
  return (
    <Panel title={t.label} right={<Conf c={t.confidence} />}>
      <div className="stack">
        <div>
          <div className="row between small muted"><span>{t.low}</span><span>{t.high}</span></div>
          <div style={{ position: 'relative', height: 22, marginTop: 4 }}>
            <div style={{ position: 'absolute', top: 9, left: 0, right: 0, height: 4, borderRadius: 4, background: 'linear-gradient(90deg, var(--line-2), var(--violet))', opacity: 0.6 }} />
            {t.score != null && (
              <>
                <div style={{ position: 'absolute', top: 4, height: 14, borderRadius: 7, background: 'color-mix(in srgb, var(--violet) 22%, transparent)', left: `${Math.max(0, t.score - band)}%`, width: `${Math.min(100, t.score + band) - Math.max(0, t.score - band)}%`, transition: 'all .6s' }} />
                <div style={{ position: 'absolute', top: 1, width: 4, height: 20, borderRadius: 2, background: 'var(--ink)', left: `calc(${t.score}% - 2px)`, transition: 'left .6s' }} />
              </>
            )}
          </div>
          <div className="mono" style={{ marginTop: 4 }}>{t.score == null ? 'INSUFFICIENT DATA' : `${t.score} / 100  (±${band})`}</div>
        </div>
        <details>
          <summary className="small" style={{ cursor: 'pointer' }}>Method, signals & limitations</summary>
          <div className="stack small" style={{ marginTop: 8 }}>
            <div><span className="tag-inf">Method</span> <span className="ink2">{t.method}</span></div>
            <table className="t">
              <thead><tr><th>Signal</th><th>Value</th><th>Weight</th></tr></thead>
              <tbody>{t.signals.map((s) => <tr key={s.label}><td>{s.label}<div className="muted">{s.detail}</div></td><td className="mono">{Math.round(s.value * 100)}</td><td className="mono">{Math.round(s.weight * 100)}%</td></tr>)}</tbody>
            </table>
            <div><span className="tag-obs">Limits</span> <span className="ink2">{t.limitations}</span></div>
            <div className="tiny">Evidence</div>
            <EvidenceList items={t.evidence} max={4} />
          </div>
        </details>
        <Verdict k={`tendency:${t.id}`} />
      </div>
    </Panel>
  )
}

function Radar({ tendencies }: { tendencies: Tendency[] }) {
  const tip = useTooltip()
  const S = 320, c = S / 2, R = 110
  const n = tendencies.length
  const ang = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2
  const pt = (i: number, v: number) => [c + Math.cos(ang(i)) * R * (v / 100), c + Math.sin(ang(i)) * R * (v / 100)] as const
  const valid = tendencies.map((t) => t.score ?? 0)
  const hi = tendencies.map((t) => Math.min(100, (t.score ?? 0) + BAND[t.confidence]))
  const lo = tendencies.map((t) => Math.max(0, (t.score ?? 0) - BAND[t.confidence]))
  const line = d3.line().curve(d3.curveCardinalClosed.tension(0.4))
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`-70 0 ${S + 140} ${S}`} width="100%" role="img" aria-label="Shopping-style radar chart">
        {[25, 50, 75, 100].map((r) => <polygon key={r} points={tendencies.map((_, i) => pt(i, r).join(',')).join(' ')} fill="none" stroke="var(--line)" />)}
        {tendencies.map((t, i) => <line key={t.id} x1={c} y1={c} x2={pt(i, 100)[0]} y2={pt(i, 100)[1]} stroke="var(--line)" />)}
        <path d={line(hi.map((v, i) => pt(i, v) as [number, number])) ?? ''} fill="var(--violet)" opacity={0.15} />
        <path d={line(lo.map((v, i) => pt(i, v) as [number, number])) ?? ''} fill="var(--panel)" opacity={0.6} />
        <path d={line(valid.map((v, i) => pt(i, v) as [number, number])) ?? ''} fill="var(--violet)" fillOpacity={0.25} stroke="var(--violet)" strokeWidth={2} />
        {tendencies.map((t, i) => {
          const [x, y] = pt(i, 118)
          const [px, py] = pt(i, t.score ?? 0)
          return (
            <g key={t.id}>
              {t.score != null && <circle cx={px} cy={py} r={4.5} fill="var(--violet)" stroke="var(--panel)" strokeWidth={2} onMouseMove={(e) => tip.show(e, <><b>{t.label}</b><div className="muted">{t.score}/100 · {t.confidence}</div></>)} onMouseLeave={tip.hide} />}
              <text x={x} y={y} textAnchor={Math.abs(x - c) < 10 ? 'middle' : x > c ? 'start' : 'end'} dy={4} className="svg-text" style={{ fontSize: 10.5 }}>{t.label.replace(' vs. value', '')}{t.score == null ? ' (n/a)' : ''}</text>
            </g>
          )
        })}
      </svg>
      {tip.el}
    </div>
  )
}
