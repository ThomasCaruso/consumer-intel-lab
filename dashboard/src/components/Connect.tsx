import { useState, type DragEvent } from 'react'
import { CheckCircle2, Download, FileUp, Loader2, Play, ShieldCheck, Store } from 'lucide-react'
import { useStore } from '../lib/store'
import { ping } from '../lib/bridge'

/** Set this once the Chrome Web Store listing is approved. Until then there is no store button. */
export const CHROME_WEB_STORE_URL: string | null = null

const PERIODS = [7, 30, 90, 180, 365]

export function ConnectFlow({ compact = false }: { compact?: boolean }) {
  const { extension, connectChrome, pullHistory, refreshExtension, busy, sources } = useStore()
  const [days, setDays] = useState(90)
  const [showSteps, setShowSteps] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const chromeLoaded = sources.some((s) => s.kind === 'chrome')
  const step = !extension.installed ? 1 : !extension.historyGranted ? 2 : 3

  const approve = async () => {
    setWaiting(true)
    await connectChrome()
    // Poll briefly: the approval happens in the extension's own tab.
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const s = await refreshExtension()
      if (s.historyGranted) break
    }
    setWaiting(false)
  }

  return (
    <div className="stack">
      <div className="steps">
        <div className={`step ${step > 1 ? 'done' : 'current'}`}>
          <div className="n">STEP 1</div>
          <h3 className="row">{step > 1 && <CheckCircle2 size={16} color="var(--accent)" />} Connect Chrome</h3>
          {step > 1 ? (
            <p>Connector extension v{extension.version} detected on this page.</p>
          ) : (
            <>
              <p>Add the small connector extension. It can only talk to this dashboard and reads nothing until you approve.</p>
              <div className="actions row">
                {CHROME_WEB_STORE_URL ? (
                  <a className="btn primary" href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer"><Store size={15} /> Install extension</a>
                ) : (
                  <>
                    <a className="btn primary" href={`${import.meta.env.BASE_URL}consumer-intel-lab-extension.zip`} download><Download size={15} /> Download extension</a>
                    <button className="btn ghost" onClick={() => setShowSteps(!showSteps)}>{showSteps ? 'Hide' : 'How to install'}</button>
                  </>
                )}
                <button className="btn ghost sm" onClick={() => { ping(); void refreshExtension() }}>Re-check</button>
              </div>
            </>
          )}
        </div>
        <div className={`step ${step > 2 ? 'done' : step === 2 ? 'current' : ''}`}>
          <div className="n">STEP 2</div>
          <h3 className="row">{step > 2 && <CheckCircle2 size={16} color="var(--accent)" />} Approve permission</h3>
          <p>{step > 2 ? 'History access granted. You can revoke it any time in Data & Privacy.' : 'Chrome shows its own prompt. Only URLs, titles and visit times are read — never passwords, cookies or page contents.'}</p>
          {step === 2 && (
            <div className="actions">
              <button className="btn primary" onClick={approve} disabled={waiting}>{waiting ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} {waiting ? 'Waiting for approval…' : 'Approve history access'}</button>
            </div>
          )}
        </div>
        <div className={`step ${chromeLoaded ? 'done' : step === 3 ? 'current' : ''}`}>
          <div className="n">STEP 3</div>
          <h3 className="row">{chromeLoaded && <CheckCircle2 size={16} color="var(--accent)" />} Explore my profile</h3>
          <p>Pick a period. Analysis runs in this tab; nothing is uploaded or saved.</p>
          <div className="actions stack">
            <div className="seg-btns" role="group" aria-label="History period">
              {PERIODS.map((d) => <button key={d} className={d === days ? 'on' : ''} onClick={() => setDays(d)} disabled={step < 3}>{d}d</button>)}
            </div>
            <button className="btn primary" disabled={step < 3 || !!busy} onClick={() => pullHistory(days)}>
              {busy ? <Loader2 size={15} className="spin" /> : <Play size={15} />} {chromeLoaded ? 'Re-analyze' : 'Analyze my history'}
            </button>
          </div>
        </div>
      </div>

      {showSteps && !extension.installed && !CHROME_WEB_STORE_URL && (
        <div className="callout fade-in">
          <b>Temporary install (until the Chrome Web Store listing is approved)</b>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Unzip <span className="mono">consumer-intel-lab-extension.zip</span> to a folder you will keep.</li>
            <li>Open <span className="mono">chrome://extensions</span> in a new tab (paste it in the address bar).</li>
            <li>Turn on <b>Developer mode</b> (top-right switch).</li>
            <li>Click <b>Load unpacked</b> and choose the unzipped folder.</li>
            <li>Come back to this tab — it detects the extension automatically (or press Re-check).</li>
          </ol>
          <p className="small muted" style={{ margin: '8px 0 0' }}>The extension's source is in the project repository; it requests no permissions at install beyond local storage and on-click page reading for product capture.</p>
        </div>
      )}
      {!compact && <ImportDrop />}
    </div>
  )
}

export function ImportDrop() {
  const { importFiles, busy } = useStore()
  const [over, setOver] = useState(false)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void importFiles(Array.from(e.dataTransfer.files))
  }
  return (
    <label className={`drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <input type="file" multiple accept=".json,.csv,.tsv,.html,.htm" hidden onChange={(e) => { void importFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
      <FileUp size={22} style={{ color: 'var(--accent)' }} />
      <div style={{ marginTop: 6, color: 'var(--ink)' }}><b>Optional: drop your own exports here</b> {busy && <Loader2 size={13} className="spin" />}</div>
      <div className="small" style={{ marginTop: 4 }}>
        Google Takeout (BrowserHistory.json, My Activity .json/.html) · ChatGPT <span className="mono">conversations.json</span> · order history CSV (e.g. Amazon) · any CSV/JSON with url + time · product catalogs (name + url)
      </div>
      <div className="small" style={{ marginTop: 4 }}>Files are read in this tab only. For ChatGPT, only your own messages are analyzed.</div>
    </label>
  )
}
