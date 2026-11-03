import { useStore } from '../lib/store'
import { Conf, NeedsData, Panel } from '../components/ui'
import type { Verdict as V } from '../lib/types'
import { categoryColor } from '../lib/taxonomy'

const OPTIONS: { v: V; label: string }[] = [
  { v: 'accurate', label: 'Accurate' },
  { v: 'uncertain', label: 'Unsure' },
  { v: 'inaccurate', label: 'Inaccurate' },
]

/** Three-way grading control, reusable anywhere an inference is shown. */
export function Verdict({ k }: { k: string }) {
  const { feedback, setVerdict } = useStore()
  const cur = feedback.verdicts[k]
  return (
    <div className="row small">
      <span className="muted">Is this right?</span>
      <div className="seg-btns verdict" role="group" aria-label="Grade this inference">
        {OPTIONS.map((o) => (
          <button key={o.v} className={`${cur === o.v ? 'on' : ''} ${o.v}`} aria-pressed={cur === o.v} onClick={() => setVerdict(k, cur === o.v ? null : o.v)}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}

export default function Reality() {
  const { profile, feedback, setSelfRating } = useStore()
  if (!profile) return <NeedsData what="AI vs. Reality" />

  const interests = profile.interests.filter((i) => i.count >= 3).slice(0, 14)
  const verdicts = Object.values(feedback.verdicts)
  const graded = verdicts.length
  const acc = verdicts.filter((v) => v === 'accurate').length
  const inacc = verdicts.filter((v) => v === 'inaccurate').length
  const rated = interests.filter((i) => feedback.selfRated[i.id] != null)
  const gaps = rated.map((i) => ({ i, ai: i.score / 20, self: feedback.selfRated[i.id] })).sort((a, b) => Math.abs(b.ai - b.self) - Math.abs(a.ai - a.self))
  const mae = gaps.length ? gaps.reduce((a, g) => a + Math.abs(g.ai - g.self), 0) / gaps.length : null

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g4">
        <section className="panel kpi"><div className="tiny">Inferences graded</div><div className="v">{graded}</div><div className="s">across interests, brands, styles & segments</div></section>
        <section className="panel kpi"><div className="tiny">Model accuracy (your grading)</div><div className="v">{graded ? Math.round((acc / graded) * 100) + '%' : '—'}</div><div className="s">{acc} accurate · {inacc} inaccurate · {graded - acc - inacc} unsure</div></section>
        <section className="panel kpi"><div className="tiny">Self-ratings given</div><div className="v">{rated.length}/{interests.length}</div><div className="s">rate each interest 0–5 below</div></section>
        <section className="panel kpi"><div className="tiny">Avg. AI ↔ self gap</div><div className="v">{mae == null ? '—' : mae.toFixed(1)}</div><div className="s">points on a 0–5 scale</div></section>
      </div>

      <div className="callout">Your grades feed straight back into the model: an interest marked <b>inaccurate</b> is down-weighted to 25%, a tendency marked inaccurate is flipped, and an inaccurate segment is capped at 20. Self-ratings blend 50/50 into recommendation scores. Grades are saved only in this browser.</div>

      <div className="grid g2">
        <Panel title="Grade the inferred interests" sub="AI score is relative to your strongest interest. Your own rating is what you'd say about yourself.">
          <div className="stack">
            {interests.map((i) => (
              <div key={i.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                <div className="row between">
                  <span className="row"><i className="status-dot" style={{ background: categoryColor(i.id) }} /> <b>{i.label}</b> <span className="mono muted">AI {i.score}</span></span>
                  <Conf c={i.confidence} />
                </div>
                <div className="row between" style={{ marginTop: 6 }}>
                  <Verdict k={`interest:${i.id}`} />
                  <label className="row small"><span className="muted">My interest</span>
                    <input type="range" min={0} max={5} step={1} value={feedback.selfRated[i.id] ?? 0} onChange={(e) => setSelfRating(i.id, Number(e.target.value))} aria-label={`Your own interest in ${i.label}, 0 to 5`} />
                    <span className="mono" style={{ width: 22 }}>{feedback.selfRated[i.id] ?? '–'}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <div className="stack" style={{ gap: 16 }}>
          <Panel title="Self-report vs. AI prediction" sub="Both on a 0–5 scale (AI score ÷ 20). Long lines are where behavioral data misreads you.">
            {gaps.length ? <Dumbbell rows={gaps.map((g) => ({ id: g.i.id, label: g.i.label, ai: g.ai, self: g.self }))} /> : <p className="muted small">Rate at least one interest to compare.</p>}
          </Panel>
          <Panel title="Grade brands & segments">
            <div className="stack small">
              {profile.brands.slice(0, 6).map((b) => <div key={b.id} className="row between"><span>Brand: <b>{b.label}</b> <span className="mono muted">{b.score}</span></span><Verdict k={`brand:${b.id}`} /></div>)}
              {profile.segments.filter((s) => s.member).map((s) => <div key={s.id} className="row between"><span>Segment: <b>{s.label}</b> <span className="mono muted">{s.score}</span></span><Verdict k={`segment:${s.id}`} /></div>)}
            </div>
          </Panel>
          <Panel title="Why the model can be wrong">
            <ul className="small ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Shared devices and school/work research look like personal interest.</li>
              <li>Attention isn't preference: hate-reading and comparison shopping both count as “interest”.</li>
              <li>Keyword rules miss context (a “Target” stock analysis is not a Target shopping trip).</li>
              <li>Sensitive topics are excluded on purpose, so the profile is deliberately incomplete.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Dumbbell({ rows }: { rows: { id: string; label: string; ai: number; self: number }[] }) {
  return (
    <div className="stack small">
      {rows.map((r) => (
        <div key={r.id}>
          <div className="row between"><span>{r.label}</span><span className="mono muted">AI {r.ai.toFixed(1)} · you {r.self}</span></div>
          <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden>
            <line x1={0} x2={100} y1={8} y2={8} stroke="var(--line)" />
            <line x1={r.ai * 20} x2={r.self * 20} y1={8} y2={8} stroke={Math.abs(r.ai - r.self) > 1.5 ? 'var(--bad)' : 'var(--muted)'} strokeWidth={2} />
            <circle cx={r.ai * 20} cy={8} r={4} fill="var(--violet)" />
            <circle cx={r.self * 20} cy={8} r={4} fill="var(--accent)" />
          </svg>
        </div>
      ))}
      <div className="row"><span className="chip"><i className="sw" style={{ background: 'var(--violet)' }} />AI prediction</span><span className="chip"><i className="sw" style={{ background: 'var(--accent)' }} />Your self-report</span></div>
    </div>
  )
}
