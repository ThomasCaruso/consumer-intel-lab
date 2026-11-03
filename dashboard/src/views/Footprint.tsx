import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { CatChip, NeedsData, Panel, fmtDate } from '../components/ui'
import { Calendar, FlowSankey, Heatmap, RadialClock, SiteScatter, Stream } from '../components/charts'
import { categoryColor } from '../lib/taxonomy'

export default function Footprint() {
  const { profile } = useStore()
  const [q, setQ] = useState('')
  const cats = useMemo(() => profile?.interests.filter((i) => i.count >= 5).slice(0, 10).map((i) => i.id) ?? [], [profile])
  if (!profile) return <NeedsData what="Your digital footprint" />
  const domains = profile.domains.filter((d) => !q || d.domain.includes(q.toLowerCase()))

  return (
    <div className="grid g2">
      <Panel title="24-hour rhythm" sub="Average records per day at each hour. Wedge length uses a square-root scale.">
        <RadialClock grid={profile.hourByWeekday} />
      </Panel>
      <Panel title="Weekly heatmap" sub="Total records for each weekday × hour. Hover a cell for the count.">
        <Heatmap grid={profile.hourByWeekday} />
        <div className="tiny" style={{ marginTop: 16 }}>Activity calendar</div>
        <Calendar daily={profile.daily} start={profile.span.start} end={profile.span.end} />
      </Panel>
      <Panel className="span2" title="Category flows" sub="What you tend to open next: transitions between categories within one browsing session (gaps under 30 minutes).">
        <FlowSankey flows={profile.categoryFlows} />
      </Panel>
      <Panel className="span2" title="Interest mix over time" sub="Weekly records per category, as a streamgraph. Bands that widen are interests growing in your attention.">
        <Stream weekly={profile.weekly} cats={cats} />
        <div className="row" style={{ marginTop: 8 }}>{cats.map((c) => <CatChip key={c} id={c} />)}</div>
      </Panel>
      <Panel title="Habitual vs. exploratory sites" sub={`${Math.round(profile.repeatShare * 100)}% of visits go to sites you returned to on 3+ days; ${Math.round(profile.exploratoryShare * 100)}% to single-day sites. Dot size = how recent.`}>
        <SiteScatter domains={profile.domains} />
      </Panel>
      <Panel title="Changes in interests" sub="Share of your activity in the first vs. second half of the period.">
        <div className="stack small">
          {profile.interestTrend.slice(0, 10).map((t) => {
            const max = Math.max(...profile.interestTrend.map((x) => Math.max(x.first, x.second)), 0.01)
            return (
              <div key={t.id}>
                <div className="row between"><span>{t.label}</span><span className="mono" style={{ color: t.change > 0 ? 'var(--good)' : 'var(--bad)' }}>{t.change > 0 ? '+' : ''}{(t.change * 100).toFixed(1)} pts</span></div>
                <svg width="100%" height="14" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden>
                  <line x1={(t.first / max) * 100} x2={(t.second / max) * 100} y1={7} y2={7} stroke={categoryColor(t.id)} strokeWidth={2} />
                  <circle cx={(t.first / max) * 100} cy={7} r={3.5} fill="var(--muted)" />
                  <circle cx={(t.second / max) * 100} cy={7} r={4.5} fill={categoryColor(t.id)} />
                </svg>
              </div>
            )
          })}
          <span className="muted">● grey = first half · ● colored = second half</span>
        </div>
      </Panel>
      <Panel className="span2" title="Most-visited websites" sub="Frequency and recency, directly observed." right={<input className="input" placeholder="Filter sites…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter sites" />}>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Site</th><th>Category</th><th>Visits</th><th>Days</th><th>First seen</th><th>Last seen</th><th>Pattern</th></tr></thead>
            <tbody>
              {domains.slice(0, 150).map((d) => (
                <tr key={d.domain}>
                  <td className="mono">{d.domain}</td>
                  <td><CatChip id={d.category} /></td>
                  <td className="mono">{d.visits.toLocaleString()}</td>
                  <td className="mono">{d.days}</td>
                  <td className="muted">{fmtDate(d.firstSeen)}</td>
                  <td className="muted">{fmtDate(d.lastSeen)}</td>
                  <td>{d.repeat ? <span className="tag-obs">habitual</span> : d.days === 1 ? <span className="tag-inf">one-off</span> : <span className="muted small">occasional</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
