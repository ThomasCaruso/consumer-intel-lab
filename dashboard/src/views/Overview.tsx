import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { ConnectFlow } from '../components/Connect'
import { CatChip, Conf, EvidenceList, Meter, ObsInf, Panel, fmtDate, fmtN } from '../components/ui'
import { insights } from '../lib/insights'
import { categoryColor } from '../lib/taxonomy'
import type { ScoredItem } from '../lib/types'
import Constellation from '../components/Constellation'

export default function Overview() {
  const { profile, sources } = useStore()
  const [sel, setSel] = useState<ScoredItem | null>(null)
  const ins = useMemo(() => (profile ? insights(profile) : []), [profile])

  if (!profile) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <Panel className="hero" title="CONNECT CHROME → APPROVE PERMISSION → EXPLORE MY PROFILE" sub="This lab only ever shows a profile built from your own, authorized records. Until you connect, every section reads INSUFFICIENT DATA.">
          <ConnectFlow />
        </Panel>
      </div>
    )
  }

  const interests = profile.interests.filter((i) => i.confidence !== 'INSUFFICIENT DATA')
  const current = sel ?? interests[0] ?? null
  const members = profile.segments.filter((s) => s.member)
  const tend = profile.tendencies

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g4">
        <Kpi label="Records analyzed" v={fmtN(profile.analyzedRecords)} s={`excluded: ${fmtN(profile.excludedSensitive)} sensitive, ${fmtN(profile.excludedOther)} logins/local/reloads`} />
        <Kpi label="Period" v={`${profile.span.days} day${profile.span.days === 1 ? '' : 's'}`} s={`${fmtDate(profile.span.start)} – ${fmtDate(profile.span.end)} · ${profile.span.activeDays} active days`} />
        <Kpi label="Distinct sites" v={fmtN(profile.domains.length)} s={`${Math.round(profile.repeatShare * 100)}% of visits to habitual sites`} />
        <Kpi label="Searches" v={fmtN(profile.searches.length)} s={`${fmtN(profile.shopping.productSearches)} on retailer sites`} />
      </div>

      <div className="grid g3">
        <Panel className="span2 hero" title="Your interest constellation" sub="Closer to the center = stronger signal. Size = number of records. Click a planet for the evidence.">
          <Constellation items={interests.slice(0, 14)} selected={current?.id} onSelect={setSel} />
        </Panel>
        <Panel title={current ? current.label : 'Interest'} right={current && <Conf c={current.confidence} />}>
          {current ? (
            <div className="stack">
              <div className="row"><CatChip id={current.id} /><span className="mono muted">score {current.score}/100</span></div>
              <Meter value={current.score} color={categoryColor(current.id)} />
              <ObsInf observed={current.observed} inferred={current.inferred} />
              <div className="tiny" style={{ marginTop: 6 }}>Supporting records</div>
              <EvidenceList items={current.evidence} max={4} />
            </div>
          ) : <p className="muted">INSUFFICIENT DATA</p>}
        </Panel>
      </div>

      <div className="grid g3">
        <Panel className="span2" title="Strongest evidence-based insights" sub="Observed = counted directly from your records. Inferred = an interpretation of those counts.">
          <div className="stack">
            {ins.map((x, i) => <InsightRow key={i} x={x} />)}
          </div>
        </Panel>
        <div className="stack" style={{ gap: 16 }}>
          <Panel title="Shopping tendencies" sub="Tentative; see Personality & Shopping Style.">
            <div className="stack">
              {tend.map((t) => (
                <div key={t.id}>
                  <div className="row between small"><span>{t.label}</span>{t.score == null ? <Conf c="INSUFFICIENT DATA" /> : <span className="mono">{t.score}</span>}</div>
                  {t.score != null && <Meter value={t.score} color="var(--violet)" />}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Segments you fall into">
            {members.length ? (
              <div className="row">{members.map((m) => <span key={m.id} className="chip on">{m.label} <span className="mono muted">{m.score}</span></span>)}</div>
            ) : <p className="muted small">No segment reached the 50-point membership threshold.</p>}
          </Panel>
          <Panel title="Sources">
            <div className="stack small">
              {sources.map((s) => <div key={s.id} className="row between"><span className="ink2">{s.label}</span><span className="mono">{fmtN(s.recordCount)}</span></div>)}
              <a href="#/privacy" className="small">Manage data →</a>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Connect more data" sub="Add another period or file. Re-analysis happens instantly and locally.">
        <ConnectFlow />
      </Panel>
    </div>
  )
}

function Kpi({ label, v, s }: { label: string; v: string; s: string }) {
  return <section className="panel kpi fade-in"><div className="tiny">{label}</div><div className="v">{v}</div><div className="s">{s}</div></section>
}

function InsightRow({ x }: { x: ReturnType<typeof insights>[number] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ alignItems: 'flex-start', flex: 1, minWidth: 220, flexWrap: 'nowrap' }}>
          <span className={x.kind === 'observed' ? 'tag-obs' : 'tag-inf'}>{x.kind}</span>
          <div><b>{x.headline}</b><div className="small ink2">{x.detail}</div></div>
        </div>
        <div className="row"><Conf c={x.confidence} />{x.evidence.length > 0 && <button className="btn sm ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Evidence'}</button>}</div>
      </div>
      {open && <div style={{ marginTop: 8 }}><EvidenceList items={x.evidence} max={4} /></div>}
    </div>
  )
}
