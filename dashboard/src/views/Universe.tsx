import { useCallback, useMemo, useRef, useState } from 'react'
import Graph from 'graphology'
import louvain from 'graphology-communities-louvain'
import { Maximize2, Minus, Plus, Search } from 'lucide-react'
import { useStore } from '../lib/store'
import NetworkGraph, { type NetworkHandle } from '../components/NetworkGraph'
import { EvidenceList, NeedsData, Panel } from '../components/ui'
import { categoryColor, categoryLabel } from '../lib/taxonomy'
import type { GraphNode } from '../lib/types'

const TYPES: { id: GraphNode['type']; label: string; shape: string }[] = [
  { id: 'interest', label: 'Interests', shape: '●' },
  { id: 'domain', label: 'Websites', shape: '●' },
  { id: 'brand', label: 'Brands', shape: '◆' },
  { id: 'search', label: 'Searches', shape: '■' },
  { id: 'product', label: 'Products', shape: '▲' },
]
const TYPE_COLORS: Record<GraphNode['type'], string> = { interest: '#5ee6d0', domain: '#7aa2ff', brand: '#ffb547', search: '#a78bfa', product: '#ff6b8b' }
const COMMUNITY_COLORS = ['#5ee6d0', '#a78bfa', '#ffb547', '#ff6b8b', '#7aa2ff', '#86efac', '#f472b6', '#facc15', '#67e8f9', '#fdba74', '#c084fc', '#94a3b8']

type ColorMode = 'category' | 'community' | 'type'

export default function Universe() {
  const { profile } = useStore()
  const [types, setTypes] = useState<Set<GraphNode['type']>>(new Set(['interest', 'domain', 'brand', 'search', 'product']))
  const [mode, setMode] = useState<ColorMode>('community')
  const [minW, setMinW] = useState(1)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const net = useRef<NetworkHandle>(null)

  const filtered = useMemo(() => {
    if (!profile) return { nodes: [], edges: [] }
    let nodes = profile.graph.nodes.filter((n) => types.has(n.type))
    const ids = new Set(nodes.map((n) => n.id))
    let edges = profile.graph.edges.filter((e) => e.weight >= minW && ids.has(e.source) && ids.has(e.target))
    if (catFilter) {
      const keep = new Set<string>([`interest:${catFilter}`])
      for (const e of edges) { if (e.source === `interest:${catFilter}`) keep.add(e.target); if (e.target === `interest:${catFilter}`) keep.add(e.source) }
      // second hop for non-interest nodes so brands ↔ sites stay visible
      for (const e of edges) { if (keep.has(e.source) && !e.target.startsWith('interest:')) keep.add(e.target); if (keep.has(e.target) && !e.source.startsWith('interest:')) keep.add(e.source) }
      nodes = nodes.filter((n) => keep.has(n.id))
    }
    const connected = new Set<string>()
    edges.forEach((e) => { connected.add(e.source); connected.add(e.target) })
    nodes = nodes.filter((n) => connected.has(n.id) || (n.type === 'interest' && !catFilter))
    const nid = new Set(nodes.map((n) => n.id))
    edges = edges.filter((e) => nid.has(e.source) && nid.has(e.target))
    return { nodes, edges }
  }, [profile, types, minW, catFilter])

  // Louvain community detection on the visible weighted graph
  const communities = useMemo(() => {
    const g = new Graph({ type: 'undirected' })
    filtered.nodes.forEach((n) => g.addNode(n.id))
    filtered.edges.forEach((e) => { if (!g.hasEdge(e.source, e.target)) g.addEdge(e.source, e.target, { weight: e.weight }) })
    const m = new Map<string, number>()
    if (g.size === 0) { filtered.nodes.forEach((n, i) => m.set(n.id, i)); return m }
    const res = louvain(g, { getEdgeWeight: 'weight', resolution: 1 }) as Record<string, number>
    Object.entries(res).forEach(([k, v]) => m.set(k, v))
    return m
  }, [filtered])

  const communityList = useMemo(() => {
    const groups = new Map<number, GraphNode[]>()
    filtered.nodes.forEach((n) => { const c = communities.get(n.id) ?? 0; groups.set(c, [...(groups.get(c) ?? []), n]) })
    return [...groups.entries()].map(([c, ns]) => {
      const lead = ns.filter((n) => n.type === 'interest').sort((a, b) => b.weight - a.weight)
      return { c, size: ns.length, name: lead.length ? lead.slice(0, 2).map((n) => n.label).join(' + ') : ns.sort((a, b) => b.weight - a.weight)[0]?.label ?? '—' }
    }).filter((x) => x.size > 1).sort((a, b) => b.size - a.size)
  }, [filtered, communities])

  const colorOf = useCallback((n: GraphNode, community: number) => {
    if (mode === 'type') return TYPE_COLORS[n.type]
    if (mode === 'community') return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length]
    return categoryColor(n.category ?? 'other')
  }, [mode])

  if (!profile) return <NeedsData what="Your Interest Universe" />

  const node = selected ? profile.graph.nodes.find((n) => n.id === selected) : null
  const nodeEdges = node ? profile.graph.edges.filter((e) => e.source === node.id || e.target === node.id).sort((a, b) => b.weight - a.weight) : []
  const labelOf = (id: string) => profile.graph.nodes.find((n) => n.id === id)?.label ?? id
  const matches = query.length >= 2 ? profile.graph.nodes.filter((n) => n.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []
  const pick = (id: string) => { setSelected(id); setQuery(''); setTimeout(() => net.current?.focus(id), 50) }

  return (
    <div className="grid g3">
      <Panel className="span2" title={`${filtered.nodes.length} nodes · ${filtered.edges.length} weighted connections · ${communityList.length} communities`}
        sub="Drag nodes, scroll to zoom, drag the background to pan. Hover to light up a node's neighborhood."
        right={
          <div className="row">
            <div style={{ position: 'relative' }}>
              <div className="row input" style={{ padding: '6px 10px', gap: 6 }}>
                <Search size={14} className="muted" />
                <input aria-label="Search the network" placeholder="Find a site, brand, search…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ background: 'none', border: 'none', outline: 'none', width: 180 }} />
              </div>
              {matches.length > 0 && (
                <div className="panel" style={{ position: 'absolute', top: 40, right: 0, zIndex: 5, padding: 6, width: 280 }}>
                  {matches.map((m) => <button key={m.id} className="nav-item small" onClick={() => pick(m.id)}><span className="muted mono">{m.type}</span> {m.label}</button>)}
                </div>
              )}
            </div>
            <button className="icon-btn" aria-label="Zoom in" onClick={() => net.current?.zoomBy(1.4)}><Plus size={15} /></button>
            <button className="icon-btn" aria-label="Zoom out" onClick={() => net.current?.zoomBy(0.7)}><Minus size={15} /></button>
            <button className="icon-btn" aria-label="Reset view" onClick={() => net.current?.reset()}><Maximize2 size={15} /></button>
          </div>
        }>
        <div className="row" style={{ marginBottom: 10 }}>
          {TYPES.map((t) => (
            <button key={t.id} className={`chip ${types.has(t.id) ? 'on' : 'off'}`} onClick={() => setTypes((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n })}>
              <span style={{ color: TYPE_COLORS[t.id] }}>{t.shape}</span> {t.label} <span className="mono muted">{profile.graph.nodes.filter((n) => n.type === t.id).length}</span>
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span className="tiny">Color</span>
          <div className="seg-btns">
            {(['community', 'category', 'type'] as ColorMode[]).map((m) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m}</button>)}
          </div>
        </div>
        <div className="row small" style={{ marginBottom: 10 }}>
          <label className="row"><span className="tiny">Min. link weight</span>
            <input type="range" min={1} max={20} value={minW} onChange={(e) => setMinW(Number(e.target.value))} aria-label="Minimum connection weight" /> <span className="mono">{minW}</span>
          </label>
          {catFilter && <button className="chip on" onClick={() => setCatFilter(null)}>Showing {categoryLabel(catFilter)} only ✕</button>}
        </div>
        <NetworkGraph ref={net} nodes={filtered.nodes} edges={filtered.edges} colorOf={colorOf} communities={communities} selected={selected} onSelect={setSelected} />
      </Panel>

      <div className="stack" style={{ gap: 16 }}>
        <Panel title={node ? node.label : 'Select a node'} sub={node ? `${node.type} · ${nodeEdges.length} connections` : 'Click any node to see the behavioral records and inference method behind it.'}>
          {node ? (
            <div className="stack">
              <div className="callout small"><b>Method:</b> {node.method}</div>
              {node.type === 'interest' && <button className="btn sm" onClick={() => setCatFilter(node.category ?? null)}>Isolate this interest's neighborhood</button>}
              <div className="tiny">Supporting records</div>
              <EvidenceList items={node.evidence} max={4} />
              <div className="tiny" style={{ marginTop: 6 }}>Connections</div>
              <div className="stack" style={{ gap: 6 }}>
                {nodeEdges.slice(0, 12).map((e) => <EdgeRow key={e.id} label={labelOf(e.source === node.id ? e.target : e.source)} onGo={() => pick(e.source === node.id ? e.target : e.source)} method={e.method} weight={e.weight} evidence={e.evidence} />)}
              </div>
            </div>
          ) : <p className="muted small">Node shapes: ● interest / website, ◆ brand, ■ search, ▲ product. Size encodes weight within each type.</p>}
        </Panel>
        <Panel title="Communities" sub="Detected with the Louvain method on link weights — groups of things you tend to engage with together.">
          <div className="stack small">
            {communityList.slice(0, 10).map((c) => (
              <div key={c.c} className="row between">
                <span className="row"><i className="status-dot" style={{ background: COMMUNITY_COLORS[c.c % COMMUNITY_COLORS.length] }} /> {c.name}</span>
                <span className="mono muted">{c.size}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function EdgeRow({ label, method, weight, evidence, onGo }: { label: string; method: string; weight: number; evidence: GraphNode['evidence']; onGo: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '7px 9px' }}>
      <div className="row between small" style={{ flexWrap: 'nowrap' }}>
        <button className="btn sm ghost" style={{ padding: 0, border: 'none' }} onClick={onGo}>{label}</button>
        <span className="row" style={{ flexWrap: 'nowrap' }}><span className="mono muted">w {weight}</span><button className="btn sm ghost" onClick={() => setOpen(!open)}>{open ? '−' : 'why'}</button></span>
      </div>
      {open && <div className="stack small" style={{ marginTop: 6 }}><span className="ink2">{method}</span><EvidenceList items={evidence} max={3} /></div>}
    </div>
  )
}
