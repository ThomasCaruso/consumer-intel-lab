import { useMemo } from 'react'
import * as d3 from 'd3'
import { sankey as d3sankey, sankeyLinkHorizontal, type SankeyNode, type SankeyLink } from 'd3-sankey'
import type { DomainStat, Profile } from '../lib/types'
import { categoryColor, categoryLabel } from '../lib/taxonomy'
import { useTooltip } from './ui'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`)

// ---------------------------------------------------------------- radial 24h clock
export function RadialClock({ grid }: { grid: number[][] }) {
  const tip = useTooltip()
  const size = 380, c = size / 2, inner = 58, outer = c - 26
  const weekday = Array.from({ length: 24 }, (_, h) => [1, 2, 3, 4, 5].reduce((a, d) => a + grid[d][h], 0) / 5)
  const weekend = Array.from({ length: 24 }, (_, h) => (grid[0][h] + grid[6][h]) / 2)
  const max = Math.max(1, ...weekday, ...weekend)
  const r = d3.scaleSqrt().domain([0, max]).range([inner, outer])
  const angle = (h: number) => (h / 24) * Math.PI * 2
  const arc = d3.arc<{ h: number; v: number; off: number }>()
    .innerRadius(inner).outerRadius((d) => r(d.v)).startAngle((d) => angle(d.h) + d.off).endAngle((d) => angle(d.h) + d.off + (Math.PI * 2) / 24 / 2 - 0.01).cornerRadius(3)
  const peak = weekday.indexOf(Math.max(...weekday))
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 420, display: 'block', margin: '0 auto' }} role="img" aria-label="Average activity by hour, weekdays vs weekends">
        <g transform={`translate(${c},${c})`}>
          {r.ticks(3).slice(1).map((t) => <circle key={t} r={r(t)} fill="none" stroke="var(--line)" strokeDasharray="2 4" />)}
          {Array.from({ length: 24 }, (_, h) => (
            <g key={h}>
              <path d={arc({ h, v: weekday[h], off: 0 })!} fill="var(--accent)" opacity={0.9}
                onMouseMove={(e) => tip.show(e, <><b>{hourLabel(h)} weekdays</b><div className="muted">{weekday[h].toFixed(1)} records / day avg</div></>)} onMouseLeave={tip.hide} />
              <path d={arc({ h, v: weekend[h], off: (Math.PI * 2) / 48 })!} fill="var(--violet)" opacity={0.85}
                onMouseMove={(e) => tip.show(e, <><b>{hourLabel(h)} weekends</b><div className="muted">{weekend[h].toFixed(1)} records / day avg</div></>)} onMouseLeave={tip.hide} />
              {h % 3 === 0 && <text x={Math.sin(angle(h)) * (outer + 14)} y={-Math.cos(angle(h)) * (outer + 14) + 3} textAnchor="middle" className="svg-muted">{hourLabel(h)}</text>}
            </g>
          ))}
          <text textAnchor="middle" y={-4} className="svg-muted">PEAK</text>
          <text textAnchor="middle" y={16} style={{ fill: 'var(--ink)', fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 600 }}>{hourLabel(peak)}</text>
        </g>
      </svg>
      <div className="row small" style={{ justifyContent: 'center' }}>
        <span className="chip"><i className="sw" style={{ background: 'var(--accent)' }} />Weekdays</span>
        <span className="chip"><i className="sw" style={{ background: 'var(--violet)' }} />Weekends</span>
      </div>
      {tip.el}
    </div>
  )
}

// ---------------------------------------------------------------- weekday × hour heatmap
export function Heatmap({ grid }: { grid: number[][] }) {
  const tip = useTooltip()
  const cell = 22, left = 34, top = 18
  const max = Math.max(1, ...grid.flat())
  const op = (v: number) => (v === 0 ? 0.04 : 0.15 + 0.85 * Math.sqrt(v / max))
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${left + 24 * cell} ${top + 7 * cell}`} width="100%" style={{ minWidth: 520 }} role="img" aria-label="Activity heatmap by weekday and hour">
        {Array.from({ length: 24 }, (_, h) => h % 3 === 0 && <text key={h} x={left + h * cell + cell / 2} y={11} textAnchor="middle" className="svg-muted">{hourLabel(h)}</text>)}
        {grid.map((row, d) => (
          <g key={d}>
            <text x={left - 6} y={top + d * cell + cell / 2 + 3} textAnchor="end" className="svg-muted">{DAYS[d]}</text>
            {row.map((v, h) => (
              <rect key={h} x={left + h * cell + 1} y={top + d * cell + 1} width={cell - 2} height={cell - 2} rx={4} fill="var(--accent)" opacity={op(v)}
                onMouseMove={(e) => tip.show(e, <><b>{DAYS[d]} {hourLabel(h)}</b><div className="muted">{v.toLocaleString()} records</div></>)} onMouseLeave={tip.hide} />
            ))}
          </g>
        ))}
      </svg>
      {tip.el}
    </div>
  )
}

// ---------------------------------------------------------------- calendar
export function Calendar({ daily, start, end }: { daily: Record<string, number>; start: number; end: number }) {
  const tip = useTooltip()
  const cell = 13
  const first = d3.timeWeek.floor(new Date(start))
  const last = new Date(end)
  const days = d3.timeDays(first, d3.timeDay.offset(last, 1))
  const weeks = d3.timeWeek.count(first, last) + 1
  const max = Math.max(1, ...Object.values(daily))
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const months = d3.timeMonths(first, last)
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(300, 30 + weeks * cell)} height={18 + 7 * cell} role="img" aria-label="Daily activity calendar">
        {months.map((m) => <text key={+m} x={30 + d3.timeWeek.count(first, m) * cell} y={10} className="svg-muted">{d3.timeFormat('%b')(m)}</text>)}
        {[1, 3, 5].map((d) => <text key={d} x={24} y={18 + d * cell + 10} textAnchor="end" className="svg-muted">{DAYS[d]}</text>)}
        {days.map((d) => {
          const v = daily[key(d)] ?? 0
          const inRange = +d >= d3.timeDay.floor(new Date(start)).getTime()
          return (
            <rect key={+d} x={30 + d3.timeWeek.count(first, d) * cell} y={18 + d.getDay() * cell} width={cell - 2} height={cell - 2} rx={3}
              fill={v ? 'var(--accent)' : 'var(--line)'} opacity={!inRange ? 0.2 : v ? 0.2 + 0.8 * Math.sqrt(v / max) : 0.6}
              onMouseMove={(e) => tip.show(e, <><b>{d.toDateString()}</b><div className="muted">{v.toLocaleString()} records</div></>)} onMouseLeave={tip.hide} />
          )
        })}
      </svg>
      {tip.el}
    </div>
  )
}

// ---------------------------------------------------------------- category flow sankey
type SN = { id: string; cat: string; side: 'L' | 'R' }
export function FlowSankey({ flows }: { flows: Profile['categoryFlows'] }) {
  const tip = useTooltip()
  const W = 720, H = 420
  const graph = useMemo(() => {
    const top = flows.slice(0, 22)
    const ids = new Set<string>()
    top.forEach((f) => { ids.add('L:' + f.from); ids.add('R:' + f.to) })
    const nodes: SN[] = [...ids].map((id) => ({ id, cat: id.slice(2), side: id[0] as 'L' | 'R' }))
    const links = top.map((f) => ({ source: 'L:' + f.from, target: 'R:' + f.to, value: f.count }))
    if (!links.length) return null
    const s = d3sankey<SN, { value: number }>().nodeId((d) => d.id).nodeWidth(12).nodePadding(10).extent([[150, 10], [W - 150, H - 10]])
    return s({ nodes: nodes.map((d) => ({ ...d })), links: links.map((d) => ({ ...d })) })
  }, [flows])
  if (!graph) return <p className="muted small">INSUFFICIENT DATA — no category-to-category transitions within a session yet.</p>
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="What you browse next: category transitions">
        <text x={150} y={H} className="svg-muted" dy={-2}>FROM</text>
        <text x={W - 150} y={H} className="svg-muted" textAnchor="end" dy={-2}>NEXT</text>
        {graph.links.map((l: SankeyLink<SN, { value: number }>, i) => {
          const s = l.source as SankeyNode<SN, { value: number }>, t = l.target as SankeyNode<SN, { value: number }>
          return (
            <path key={i} d={sankeyLinkHorizontal()(l as never) ?? ''} fill="none" stroke={categoryColor(s.cat)} strokeOpacity={0.3} strokeWidth={Math.max(1, l.width ?? 1)}
              onMouseMove={(e) => tip.show(e, <><b>{categoryLabel(s.cat)} → {categoryLabel(t.cat)}</b><div className="muted">{l.value} transitions within a session</div></>)} onMouseLeave={tip.hide}
              style={{ transition: 'stroke-opacity .2s' }} onMouseEnter={(e) => (e.currentTarget.style.strokeOpacity = '0.65')} onMouseOut={(e) => (e.currentTarget.style.strokeOpacity = '0.3')} />
          )
        })}
        {graph.nodes.map((n) => (
          <g key={n.id}>
            <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0))} rx={3} fill={categoryColor(n.cat)} />
            <text x={n.side === 'L' ? (n.x0 ?? 0) - 8 : (n.x1 ?? 0) + 8} y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2 + 4} textAnchor={n.side === 'L' ? 'end' : 'start'} className="svg-text">{categoryLabel(n.cat)}</text>
          </g>
        ))}
      </svg>
      {tip.el}
    </div>
  )
}

// ---------------------------------------------------------------- weekly streamgraph
export function Stream({ weekly, cats }: { weekly: Profile['weekly']; cats: string[] }) {
  const tip = useTooltip()
  const W = 720, H = 260, m = { l: 10, r: 10, t: 10, b: 24 }
  if (weekly.length < 3) return <p className="muted small">INSUFFICIENT DATA — needs at least 3 weeks of history. Pick a longer period.</p>
  const data = weekly.map((w) => ({ date: new Date(w.week), ...Object.fromEntries(cats.map((c) => [c, w.byCategory[c] ?? 0])) })) as ({ date: Date } & Record<string, number>)[]
  const series = d3.stack<{ date: Date } & Record<string, number>>().keys(cats).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut)(data)
  const x = d3.scaleTime().domain(d3.extent(data, (d) => d.date) as [Date, Date]).range([m.l, W - m.r])
  const y = d3.scaleLinear().domain([d3.min(series, (s) => d3.min(s, (d) => d[0]))!, d3.max(series, (s) => d3.max(s, (d) => d[1]))!]).range([H - m.b, m.t])
  const area = d3.area<d3.SeriesPoint<{ date: Date } & Record<string, number>>>().x((d) => x(d.data.date)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(d3.curveBasis)
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Weekly interest mix over time">
        {series.map((s) => (
          <path key={s.key} d={area(s) ?? ''} fill={categoryColor(s.key)} opacity={0.85} stroke="var(--panel)" strokeWidth={0.5}
            onMouseMove={(e) => {
              const [mx] = d3.pointer(e)
              const i = d3.bisector((d: { date: Date }) => d.date).center(data, x.invert(mx))
              tip.show(e, <><b>{categoryLabel(s.key)}</b><div className="muted">week of {data[i].date.toLocaleDateString()}: {data[i][s.key]} records</div></>)
            }} onMouseLeave={tip.hide} />
        ))}
        <g className="axis" transform={`translate(0,${H - m.b})`} ref={(g) => { if (g) d3.select(g).call(d3.axisBottom(x).ticks(6).tickSizeOuter(0)) }} />
      </svg>
      {tip.el}
    </div>
  )
}

// ---------------------------------------------------------------- habit vs exploration scatter
export function SiteScatter({ domains }: { domains: DomainStat[] }) {
  const tip = useTooltip()
  const W = 720, H = 360, m = { l: 44, r: 16, t: 14, b: 34 }
  const ds = domains.slice(0, 250)
  const x = d3.scaleLog().domain([1, Math.max(2, d3.max(ds, (d) => d.days)!)]).range([m.l, W - m.r]).nice()
  const y = d3.scaleLog().domain([1, Math.max(2, d3.max(ds, (d) => d.visits)!)]).range([H - m.b, m.t]).nice()
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Sites by days visited and total visits">
        <rect x={x(3)} y={m.t} width={W - m.r - x(3)} height={H - m.b - m.t} fill="var(--accent)" opacity={0.04} />
        <text x={W - m.r - 6} y={m.t + 14} textAnchor="end" className="svg-muted">HABITUAL (3+ DAYS)</text>
        <text x={m.l + 6} y={m.t + 14} className="svg-muted">EXPLORATORY</text>
        <g className="axis" transform={`translate(0,${H - m.b})`} ref={(g) => { if (g) d3.select(g).call(d3.axisBottom(x).ticks(6, '~s')) }} />
        <g className="axis" transform={`translate(${m.l},0)`} ref={(g) => { if (g) d3.select(g).call(d3.axisLeft(y).ticks(5, '~s')) }} />
        <text x={(W + m.l) / 2} y={H - 2} textAnchor="middle" className="svg-muted">distinct days visited →</text>
        <text transform={`translate(12,${(H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="svg-muted">total visits →</text>
        {ds.map((d) => (
          <circle key={d.domain} cx={x(d.days) + (Math.sin(d.domain.length * 7.3) * 4)} cy={y(d.visits)} r={3 + d.recency * 6} fill={categoryColor(d.category)} fillOpacity={0.75} stroke="var(--panel)"
            onMouseMove={(e) => tip.show(e, <><b>{d.domain}</b><div className="muted">{d.visits} visits · {d.days} days · {categoryLabel(d.category)}<br />last {new Date(d.lastSeen).toLocaleDateString()}</div></>)} onMouseLeave={tip.hide} />
        ))}
      </svg>
      {tip.el}
    </div>
  )
}
