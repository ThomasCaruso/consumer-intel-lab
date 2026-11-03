import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ActivityRecord, DataSource, Feedback, Product, Profile } from './types'
import { analyze } from './analyze'
import { ext, onExtensionHello, ping, type ExtensionStatus } from './bridge'
import { importChromeHistory, importFile } from './importers'

// Only small, derived, non-raw state is persisted (your feedback and imported product catalogs).
// Raw browsing / chat / order records live in memory and vanish when the tab closes.
const LS_FEEDBACK = 'cil.feedback.v1'
const LS_CATALOG = 'cil.catalog.v1'
const LS_THEME = 'cil.theme'

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage unavailable */ }
}

export type Theme = 'dark' | 'light'

interface Store {
  records: ActivityRecord[]
  sources: DataSource[]
  profile: Profile | null
  analyzing: boolean
  catalog: Product[]
  captured: Product[]
  feedback: Feedback
  extension: ExtensionStatus
  theme: Theme
  busy: string | null
  error: string | null
  setTheme: (t: Theme) => void
  setError: (e: string | null) => void
  refreshExtension: () => Promise<ExtensionStatus>
  connectChrome: () => Promise<void>
  pullHistory: (days: number) => Promise<void>
  disconnectChrome: () => Promise<void>
  importFiles: (files: File[]) => Promise<void>
  removeSource: (id: string) => void
  removeRecord: (id: string) => void
  resetAll: () => Promise<void>
  syncCaptured: () => Promise<void>
  removeProduct: (p: Product) => Promise<void>
  setVerdict: (key: string, v: Feedback['verdicts'][string] | null) => void
  setSelfRating: (id: string, v: number | null) => void
}

const Ctx = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<ActivityRecord[]>([])
  const [sources, setSources] = useState<DataSource[]>([])
  const [catalog, setCatalog] = useState<Product[]>(() => load(LS_CATALOG, []))
  const [captured, setCaptured] = useState<Product[]>([])
  const [feedback, setFeedback] = useState<Feedback>(() => load(LS_FEEDBACK, { verdicts: {}, selfRated: {} }))
  const [extension, setExtension] = useState<ExtensionStatus>({ installed: false })
  const [theme, setThemeState] = useState<Theme>(() => load<Theme | null>(LS_THEME, null) ?? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const setTheme = (t: Theme) => { setThemeState(t); save(LS_THEME, t) }
  useEffect(() => save(LS_FEEDBACK, feedback), [feedback])
  useEffect(() => save(LS_CATALOG, catalog), [catalog])

  // Re-analyze whenever records or feedback change (deferred so the UI can paint a progress state).
  useEffect(() => {
    if (!records.length) { setProfile(null); return }
    setAnalyzing(true)
    const t = setTimeout(() => {
      try { setProfile(analyze(records, feedback)) } catch (e) { setError(`Analysis failed: ${(e as Error).message}`) }
      setAnalyzing(false)
    }, 30)
    return () => clearTimeout(t)
  }, [records, feedback])

  const refreshExtension = useCallback(async () => {
    try {
      const s = await ext.status()
      setExtension(s)
      return s
    } catch {
      const s = { installed: false }
      setExtension(s)
      return s
    }
  }, [])

  useEffect(() => {
    const off = onExtensionHello(() => { void refreshExtension() })
    ping()
    void refreshExtension()
    // Re-check when the tab regains focus (e.g. after approving the permission in the extension tab).
    const onFocus = () => { ping(); void refreshExtension() }
    window.addEventListener('focus', onFocus)
    return () => { off(); window.removeEventListener('focus', onFocus) }
  }, [refreshExtension])

  const connectChrome = useCallback(async () => {
    setError(null)
    try {
      const r = await ext.connect()
      if (r.granted) await refreshExtension()
    } catch (e) {
      setError((e as Error).message)
    }
  }, [refreshExtension])

  const pullHistory = useCallback(async (days: number) => {
    setError(null)
    setBusy(`Reading the last ${days} days of Chrome history…`)
    try {
      const res = await ext.history(days)
      const imp = importChromeHistory(res.visits, days)
      if (res.truncated) imp.source.notes.push(`Capped at ${res.visits.length.toLocaleString()} visits from ${res.scannedUrls.toLocaleString()} URLs`)
      // Replace any earlier Chrome pull rather than double-counting it.
      setSources((s) => [...s.filter((x) => x.kind !== 'chrome'), imp.source])
      setRecords((r) => [...r.filter((x) => x.source !== 'chrome'), ...imp.records])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }, [])

  const disconnectChrome = useCallback(async () => {
    try { await ext.disconnect() } catch (e) { setError((e as Error).message) }
    setSources((s) => s.filter((x) => x.kind !== 'chrome'))
    setRecords((r) => r.filter((x) => x.source !== 'chrome'))
    await refreshExtension()
  }, [refreshExtension])

  const importFiles = useCallback(async (files: File[]) => {
    setError(null)
    const errs: string[] = []
    for (const f of files) {
      setBusy(`Importing ${f.name}…`)
      try {
        const res = await importFile(f)
        setSources((s) => [...s, res.source])
        if (res.records.length) setRecords((r) => [...r, ...res.records])
        if (res.products.length) setCatalog((c) => [...c, ...res.products])
      } catch (e) {
        errs.push((e as Error).message)
      }
    }
    setBusy(null)
    if (errs.length) setError(errs.join('\n'))
  }, [])

  const removeSource = useCallback((id: string) => {
    setSources((s) => s.filter((x) => x.id !== id))
    setRecords((r) => r.filter((x) => x.sourceId !== id))
    setCatalog((c) => c.filter((p) => p.sourceId !== id))
  }, [])

  const removeRecord = useCallback((id: string) => {
    setRecords((r) => r.filter((x) => x.id !== id))
  }, [])

  const syncCaptured = useCallback(async () => {
    try { setCaptured(await ext.products()) } catch (e) { setError((e as Error).message) }
  }, [])

  useEffect(() => { if (extension.installed) void syncCaptured() }, [extension.installed, syncCaptured])

  const removeProduct = useCallback(async (p: Product) => {
    if (p.origin === 'capture') {
      try { setCaptured(await ext.removeProduct(p.id)) } catch (e) { setError((e as Error).message) }
    } else if (p.origin === 'catalog') {
      setCatalog((c) => c.filter((x) => x.id !== p.id))
    }
  }, [])

  const resetAll = useCallback(async () => {
    setRecords([])
    setSources([])
    setCatalog([])
    setFeedback({ verdicts: {}, selfRated: {} })
    try { localStorage.removeItem(LS_FEEDBACK); localStorage.removeItem(LS_CATALOG) } catch { /* ignore */ }
    if (extension.installed) {
      try { setCaptured(await ext.clearProducts()) } catch { /* ignore */ }
      try { await ext.disconnect() } catch { /* ignore */ }
      await refreshExtension()
    }
  }, [extension.installed, refreshExtension])

  const setVerdict = useCallback((key: string, v: Feedback['verdicts'][string] | null) => {
    setFeedback((f) => {
      const verdicts = { ...f.verdicts }
      if (v) verdicts[key] = v
      else delete verdicts[key]
      return { ...f, verdicts }
    })
  }, [])

  const setSelfRating = useCallback((id: string, v: number | null) => {
    setFeedback((f) => {
      const selfRated = { ...f.selfRated }
      if (v == null) delete selfRated[id]
      else selfRated[id] = v
      return { ...f, selfRated }
    })
  }, [])

  // keep per-source counts honest after individual deletions
  const liveSources = useMemo(() => {
    const counts = new Map<string, number>()
    records.forEach((r) => counts.set(r.sourceId, (counts.get(r.sourceId) ?? 0) + 1))
    return sources.map((s) => (s.kind === 'csv' && s.label.includes('product catalog') ? s : { ...s, recordCount: counts.get(s.id) ?? 0 }))
  }, [records, sources])

  const value: Store = {
    records, sources: liveSources, profile, analyzing, catalog, captured, feedback, extension, theme, busy, error,
    setTheme, setError, refreshExtension, connectChrome, pullHistory, disconnectChrome, importFiles, removeSource, removeRecord,
    resetAll, syncCaptured, removeProduct, setVerdict, setSelfRating,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
