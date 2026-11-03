import { useEffect, useState, type ComponentType } from 'react'
import {
  Atom, BarChart3, Boxes, Fingerprint, Gauge, Menu, Moon, Scale, ShieldCheck, ShoppingBag, Sparkles, Sun, X,
} from 'lucide-react'
import { useStore } from './lib/store'
import { fmtN } from './components/ui'
import Overview from './views/Overview'
import Universe from './views/Universe'
import Footprint from './views/Footprint'
import Style from './views/Style'
import Segments from './views/Segments'
import Discovery from './views/Discovery'
import Recommendations from './views/Recommendations'
import Reality from './views/Reality'
import Privacy from './views/Privacy'

interface Section { id: string; label: string; icon: ComponentType<{ size?: number }>; title: string; blurb: string; view: ComponentType }

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Consumer Overview', icon: Gauge, title: 'Consumer Overview', blurb: 'Your inferred consumer profile, built only from records you authorized. Every claim links back to the records behind it.', view: Overview },
  { id: 'universe', label: 'Interest Universe', icon: Atom, title: 'Interest Universe', blurb: 'A force-directed map of how your sites, searches, brands, products and interests connect. Click any node to see the records and the rule that links it.', view: Universe },
  { id: 'footprint', label: 'Digital Footprint', icon: Fingerprint, title: 'Digital Footprint', blurb: 'When, how often and in what order you browse — the raw behavioral rhythm that ad platforms model.', view: Footprint },
  { id: 'style', label: 'Personality & Shopping Style', icon: Scale, title: 'Personality & Shopping Style', blurb: 'Tentative behavioral interpretations — not validated psychological measurements. Each shows its method, signals, evidence and limits.', view: Style },
  { id: 'segments', label: 'Consumer Segments', icon: Boxes, title: 'Consumer Segments', blurb: 'Marketing segments you could be targeted as. Membership overlaps; each score is a transparent weighted formula.', view: Segments },
  { id: 'discovery', label: 'Product Discovery', icon: ShoppingBag, title: 'Product Discovery', blurb: 'Collect real products from retailers — through the extension on pages you open, or from catalog files — without scraping or bypassing anti-bot protections.', view: Discovery },
  { id: 'recs', label: 'Recommendations', icon: Sparkles, title: 'Personalized Recommendations', blurb: 'Real products ranked against your profile. Prices appear only when read from the retailer page or your own file.', view: Recommendations },
  { id: 'reality', label: 'AI vs. Reality', icon: BarChart3, title: 'AI vs. Reality', blurb: 'Grade what the model inferred about you. Your feedback re-weights the profile and shows where behavioral targeting gets people wrong.', view: Reality },
  { id: 'privacy', label: 'Data & Privacy', icon: ShieldCheck, title: 'Data Connections & Privacy', blurb: 'What is connected, what was analyzed, and controls to remove any of it.', view: Privacy },
]

function useHashRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0]
  const [route, setRoute] = useState(get)
  useEffect(() => {
    const f = () => { setRoute(get()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return route
}

export default function App() {
  const route = useHashRoute()
  const { theme, setTheme, extension, profile, records, error, setError, busy, analyzing } = useStore()
  const [open, setOpen] = useState(false)
  const section = SECTIONS.find((s) => s.id === route) ?? SECTIONS[0]
  const View = section.view
  useEffect(() => { document.title = `${section.title} · Consumer Intelligence Lab` }, [section])
  useEffect(() => setOpen(false), [route])

  return (
    <div className="shell">
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Sections">
        <div className="logo">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
          <div><b>Consumer Intelligence Lab</b><span>Private · on-device</span></div>
        </div>
        {SECTIONS.map((s, i) => (
          <a key={s.id} href={`#/${s.id}`} className={`nav-item ${s.id === section.id ? 'active' : ''}`} aria-current={s.id === section.id ? 'page' : undefined}>
            <s.icon size={17} /> {s.label} <span className="k">{String.fromCharCode(65 + i)}</span>
          </a>
        ))}
        <div className="side-foot">
          <div className="row small"><span className={`status-dot ${extension.historyGranted ? 'on' : extension.installed ? 'warn' : ''}`} />
            {extension.historyGranted ? 'Chrome connected' : extension.installed ? 'Extension installed — not connected' : 'Extension not detected'}
          </div>
          <div className="row small muted"><span className={`status-dot ${records.length ? 'on' : ''}`} />{records.length ? `${fmtN(profile?.analyzedRecords ?? records.length)} records analyzed` : 'No personal data loaded'}</div>
          <button className="btn sm ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={18} /></button>
          <div className="crumbs">
            <div className="tiny">Section {String.fromCharCode(65 + SECTIONS.indexOf(section))}</div>
            <h1>{section.title}</h1>
            <p>{section.blurb}</p>
          </div>
          {(busy || analyzing) && <span className="chip on"><span className="status-dot on" /> {busy ?? 'Analyzing…'}</span>}
        </header>
        <View key={section.id} />
      </main>

      {error && (
        <div className="callout bad toast" role="alert">
          <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <span>{error}</span>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setError(null)}><X size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
