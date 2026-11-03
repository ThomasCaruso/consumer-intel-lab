import { useMemo, useState } from 'react'
import { Trash2, Unplug } from 'lucide-react'
import { useStore } from '../lib/store'
import { ConnectFlow, ImportDrop } from '../components/Connect'
import { Panel, fmtDateTime, fmtN } from '../components/ui'

export default function Privacy() {
  const { sources, records, profile, extension, disconnectChrome, removeSource, removeRecord, resetAll, captured, catalog, feedback } = useStore()
  const [q, setQ] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const matches = useMemo(() => {
    if (q.length < 2) return []
    const s = q.toLowerCase()
    return records.filter((r) => r.title.toLowerCase().includes(s) || r.url?.toLowerCase().includes(s) || r.text?.toLowerCase().includes(s)).slice(0, 200)
  }, [records, q])

  const coverage = profile ? [
    { label: 'Records loaded', v: fmtN(profile.totalRecords) },
    { label: 'Analyzed', v: fmtN(profile.analyzedRecords) },
    { label: 'Excluded: sensitive topics', v: fmtN(profile.excludedSensitive) },
    { label: 'Excluded: logins, local pages, reloads', v: fmtN(profile.excludedOther) },
    { label: 'Classified into a category', v: `${Math.round((profile.interests.reduce((a, i) => a + i.count, 0) / Math.max(1, profile.analyzedRecords)) * 100)}%` },
    { label: 'Days covered', v: `${profile.span.activeDays} of ${profile.span.days}` },
  ] : []

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g3">
        <Panel title="Chrome connection" right={<span className="row small"><span className={`status-dot ${extension.historyGranted ? 'on' : extension.installed ? 'warn' : ''}`} />{extension.historyGranted ? 'History access granted' : extension.installed ? 'Installed, no access' : 'Not installed'}</span>}>
          <div className="stack small">
            <div className="row between"><span className="muted">Extension</span><span>{extension.installed ? `v${extension.version}` : '—'}</span></div>
            <div className="row between"><span className="muted">Permission</span><span className="mono">{extension.historyGranted ? 'history (optional, granted)' : 'none'}</span></div>
            <div className="row between"><span className="muted">Captured products</span><span>{extension.capturedProducts ?? 0}</span></div>
            <button className="btn danger" disabled={!extension.historyGranted} onClick={disconnectChrome}><Unplug size={14} /> Disconnect Chrome & revoke access</button>
            <span className="muted">Revoking removes the extension's history permission in Chrome and deletes loaded Chrome records from this page. You can also remove the extension in chrome://extensions.</span>
          </div>
        </Panel>
        <Panel title="Data coverage">
          {profile ? <div className="stack small">{coverage.map((c) => <div key={c.label} className="row between"><span className="muted">{c.label}</span><span className="mono">{c.v}</span></div>)}</div> : <p className="muted small">No records loaded.</p>}
        </Panel>
        <Panel title="Where your data lives">
          <ul className="small ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li><b>Raw records:</b> this tab's memory only. Closing or reloading the tab erases them.</li>
            <li><b>Your grades & self-ratings ({Object.keys(feedback.verdicts).length + Object.keys(feedback.selfRated).length}):</b> this browser's local storage.</li>
            <li><b>Catalog products ({catalog.length}):</b> this browser's local storage.</li>
            <li><b>Captured products ({captured.length}):</b> the extension's local storage.</li>
            <li><b>Sent to servers, AI APIs or analytics:</b> nothing. This site has no backend and loads no trackers.</li>
          </ul>
          <a className="small" href="./privacy.html" target="_blank" rel="noopener">Full privacy policy →</a>
        </Panel>
      </div>

      <Panel title="Connected sources & import status">
        {sources.length === 0 ? <p className="muted small">No sources connected yet.</p> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Source</th><th>Type</th><th>Records</th><th>Imported</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td className="mono">{s.kind}</td>
                    <td className="mono">{fmtN(s.recordCount)}</td>
                    <td className="muted">{fmtDateTime(s.importedAt)}</td>
                    <td className="small muted">{s.notes.join(' · ') || '—'}</td>
                    <td><button className="btn sm danger" onClick={() => removeSource(s.id)}><Trash2 size={13} /> Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 14 }}><ImportDrop /></div>
      </Panel>

      <Panel title="Remove individual records" sub="Search your loaded records and delete any you don't want analyzed. The profile recomputes immediately.">
        <input className="input" style={{ width: '100%' }} placeholder="Type at least 2 characters (site, title, search)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search records" />
        {matches.length > 0 && (
          <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto', marginTop: 10 }}>
            <table className="t">
              <tbody>
                {matches.map((r) => (
                  <tr key={r.id}>
                    <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.time)}</td>
                    <td className="clip">{r.kind === 'chat' ? r.text : r.title}<div className="muted small clip">{r.url ?? r.source}</div></td>
                    <td><button className="icon-btn" aria-label="Delete record" onClick={() => removeRecord(r.id)}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.length >= 2 && matches.length === 0 && <p className="muted small">No matching records.</p>}
      </Panel>

      <Panel title="How the profile is generated">
        <ol className="small ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Filter.</b> Login/auth pages, local addresses, browser-internal pages and reloads within 60 s are dropped. Anything matching health, religion, politics or sexuality rules is excluded from every calculation.</li>
          <li><b>Classify.</b> Each record gets one of 22 categories from a hand-written domain list, or keywords in its title/search query. The matched rule is kept as evidence.</li>
          <li><b>Score.</b> Interest = Σ recency-weighted records (half-life ≈ a third of the period, min 14 days) × kind weight (search 2, order 3, chat 1.5, visit 1), normalized to your top interest. Tool-like categories count at reduced weight.</li>
          <li><b>Interpret.</b> Shopping tendencies and segments are weighted formulas over those scores, each shown with its inputs. Below a minimum amount of evidence, the result is INSUFFICIENT DATA.</li>
          <li><b>Correct.</b> Your grades in AI vs. Reality adjust the weights.</li>
        </ol>
      </Panel>

      <Panel title="Reset everything">
        {!confirmReset ? (
          <button className="btn danger" onClick={() => setConfirmReset(true)}><Trash2 size={14} /> Reset dashboard</button>
        ) : (
          <div className="row">
            <span className="small">Delete all loaded records, grades, catalog and captured products, and revoke Chrome access?</span>
            <button className="btn danger" onClick={async () => { await resetAll(); setConfirmReset(false) }}>Yes, delete everything</button>
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        )}
      </Panel>

      <Panel title="Connect again" sub="">
        <ConnectFlow compact />
      </Panel>
    </div>
  )
}
