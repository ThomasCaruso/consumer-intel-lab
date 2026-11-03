import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '../lib/types'

export interface SimNode extends d3.SimulationNodeDatum {
  id: string
  data: GraphNode
  r: number
  color: string
  community: number
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  data: GraphEdge
  w: number
}

export interface NetworkHandle {
  focus: (id: string) => void
  zoomBy: (k: number) => void
  reset: () => void
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  colorOf: (n: GraphNode, community: number) => string
  communities: Map<string, number>
  selected: string | null
  onSelect: (id: string | null) => void
  height?: number
}

const TYPE_RADIUS: Record<GraphNode['type'], [number, number]> = {
  interest: [14, 34], domain: [4, 16], brand: [5, 13], search: [3.5, 9], product: [4, 8],
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

/**
 * Force-directed network on <canvas> (D3 force + zoom + drag). Positions persist across
 * filter changes so nodes animate to their new equilibrium instead of jumping.
 */
const NetworkGraph = forwardRef<NetworkHandle, Props>(function NetworkGraph({ nodes, edges, colorOf, communities, selected, onSelect, height = 640 }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const state = useRef({
    sim: null as d3.Simulation<SimNode, SimLink> | null,
    nodes: [] as SimNode[],
    links: [] as SimLink[],
    pos: new Map<string, { x: number; y: number }>(),
    transform: d3.zoomIdentity,
    hover: null as SimNode | null,
    selected: null as string | null,
    neighbors: new Map<string, Set<string>>(),
    zoom: null as d3.ZoomBehavior<HTMLCanvasElement, unknown> | null,
    width: 800,
    draw: () => {},
  })
  state.current.selected = selected

  // ---------- setup canvas, zoom, drag, pointer (once) ----------
  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const s = state.current
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      const w = wrap.clientWidth
      const dpr = window.devicePixelRatio || 1
      s.width = w
      canvas.width = w * dpr
      canvas.height = height * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      s.draw()
    }

    s.draw = () => {
      const w = s.width
      ctx.save()
      ctx.clearRect(0, 0, w, height)
      const t = s.transform
      ctx.translate(t.x, t.y)
      ctx.scale(t.k, t.k)
      const focus = s.hover?.id ?? s.selected
      const nb = focus ? s.neighbors.get(focus) ?? new Set<string>() : null
      const isLit = (id: string) => !nb || id === focus || nb.has(id)
      const ink = cssVar('--ink'), ink2 = cssVar('--ink-2'), line = cssVar('--line-2'), bg = cssVar('--panel')

      // edges
      for (const l of s.links) {
        const a = l.source as SimNode, b = l.target as SimNode
        const lit = !nb || ((a.id === focus || b.id === focus))
        ctx.globalAlpha = lit ? (nb ? 0.85 : 0.22 + Math.min(0.4, l.w * 0.05)) : 0.04
        ctx.strokeStyle = lit && nb ? a.id === focus ? b.color : a.color : line
        ctx.lineWidth = Math.min(6, 0.6 + Math.sqrt(l.w) * 0.45) / Math.sqrt(t.k)
        ctx.beginPath()
        ctx.moveTo(a.x!, a.y!)
        ctx.lineTo(b.x!, b.y!)
        ctx.stroke()
      }
      // nodes
      for (const n of s.nodes) {
        const lit = isLit(n.id)
        ctx.globalAlpha = lit ? 1 : 0.13
        const x = n.x!, y = n.y!, r = n.r
        if (n.data.type === 'interest') {
          ctx.fillStyle = n.color
          ctx.globalAlpha = lit ? 0.18 : 0.04
          ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = lit ? 1 : 0.13
        }
        ctx.fillStyle = n.color
        ctx.strokeStyle = n.id === s.selected ? ink : bg
        ctx.lineWidth = (n.id === s.selected ? 3 : 1.5) / t.k
        ctx.beginPath()
        if (n.data.type === 'brand') {
          ctx.moveTo(x, y - r * 1.25); ctx.lineTo(x + r * 1.25, y); ctx.lineTo(x, y + r * 1.25); ctx.lineTo(x - r * 1.25, y); ctx.closePath()
        } else if (n.data.type === 'search') {
          const q = r * 1.1
          ctx.roundRect(x - q, y - q, q * 2, q * 2, q * 0.35)
        } else if (n.data.type === 'product') {
          const q = r * 1.35
          ctx.moveTo(x, y - q); ctx.lineTo(x + q * 0.95, y + q * 0.7); ctx.lineTo(x - q * 0.95, y + q * 0.7); ctx.closePath()
        } else {
          ctx.arc(x, y, r, 0, Math.PI * 2)
        }
        ctx.fill()
        ctx.stroke()
      }
      // labels
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const n of s.nodes) {
        const lit = isLit(n.id)
        const show = n.data.type === 'interest' || n.id === focus || (nb && nb.has(n.id)) || (t.k > 1.6 && n.r > 6) || t.k > 2.6 || (n.data.type === 'domain' && n.r > 11)
        if (!show || !lit) continue
        const big = n.data.type === 'interest'
        const fs = (big ? 13 : 11) / Math.max(0.8, Math.sqrt(t.k))
        ctx.font = `${big ? 600 : 500} ${fs}px ${big ? 'Space Grotesk' : 'Inter'}, sans-serif`
        ctx.globalAlpha = 1
        ctx.lineWidth = 3 / t.k
        ctx.strokeStyle = bg
        ctx.fillStyle = big ? ink : ink2
        const ly = n.y! + n.r * (n.data.type === 'brand' ? 1.3 : 1.05) + 3 / t.k
        ctx.strokeText(n.data.label, n.x!, ly)
        ctx.fillText(n.data.label, n.x!, ly)
      }
      ctx.restore()
    }

    const findNode = (px: number, py: number) => {
      const [gx, gy] = s.transform.invert([px, py])
      let best: SimNode | null = null
      let bd = Infinity
      for (const n of s.nodes) {
        const d = Math.hypot(n.x! - gx, n.y! - gy)
        if (d < n.r + 6 / s.transform.k && d < bd) { bd = d; best = n }
      }
      return best
    }

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 8])
      .filter((ev) => {
        if (ev.type === 'mousedown' || ev.type === 'touchstart') {
          const r = canvas.getBoundingClientRect()
          const p = 'touches' in ev ? ev.touches[0] : ev
          return !findNode(p.clientX - r.left, p.clientY - r.top)
        }
        return !ev.button
      })
      .on('zoom', (ev) => { s.transform = ev.transform; s.draw() })
    s.zoom = zoom
    const sel = d3.select(canvas)
    sel.call(zoom).on('dblclick.zoom', null)

    const drag = d3.drag<HTMLCanvasElement, unknown, SimNode | undefined>()
      .subject((ev) => findNode(ev.x, ev.y) ?? undefined)
      .on('start', (ev) => {
        const n = ev.subject
        if (!n) return
        if (!ev.active) s.sim?.alphaTarget(0.25).restart()
        n.fx = n.x; n.fy = n.y
      })
      .on('drag', (ev) => {
        const n = ev.subject
        if (!n) return
        const [gx, gy] = s.transform.invert([ev.x, ev.y])
        n.fx = gx; n.fy = gy
      })
      .on('end', (ev) => {
        const n = ev.subject
        if (!n) return
        if (!ev.active) s.sim?.alphaTarget(0)
        n.fx = null; n.fy = null
      })
    sel.call(drag)

    const tip = tipRef.current!
    const onMove = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const n = findNode(ev.clientX - r.left, ev.clientY - r.top)
      if (n !== s.hover) { s.hover = n; s.draw() }
      canvas.style.cursor = n ? 'pointer' : 'grab'
      if (n) {
        tip.style.display = 'block'
        tip.style.left = Math.min(ev.clientX - r.left + 14, s.width - 260) + 'px'
        tip.style.top = ev.clientY - r.top + 14 + 'px'
        tip.innerHTML = ''
        const b = document.createElement('b'); b.textContent = n.data.label
        const d = document.createElement('div'); d.className = 'muted'; d.textContent = `${n.data.type} · ${(s.neighbors.get(n.id)?.size ?? 0)} connections`
        tip.append(b, d)
      } else tip.style.display = 'none'
    }
    const onLeave = () => { s.hover = null; tip.style.display = 'none'; s.draw() }
    const onClick = (ev: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const n = findNode(ev.clientX - r.left, ev.clientY - r.top)
      onSelectRef.current(n ? n.id : null)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('click', onClick)

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()
    s.transform = d3.zoomIdentity.translate(s.width / 2, height / 2).scale(0.85)
    sel.call(zoom.transform, s.transform)
    return () => {
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('click', onClick)
      s.sim?.stop()
    }
  }, [height])

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const colorRef = useRef(colorOf)
  colorRef.current = colorOf

  // ---------- (re)build simulation when data changes ----------
  useEffect(() => {
    const s = state.current
    for (const n of s.nodes) s.pos.set(n.id, { x: n.x!, y: n.y! })
    const maxW: Record<string, number> = {}
    for (const n of nodes) maxW[n.type] = Math.max(maxW[n.type] ?? 1, n.weight)
    const commIds = [...new Set(communities.values())]
    const commAngle = new Map(commIds.map((c, i) => [c, (i / Math.max(1, commIds.length)) * Math.PI * 2]))
    const R = 260

    s.nodes = nodes.map((d) => {
      const [lo, hi] = TYPE_RADIUS[d.type]
      const r = lo + (hi - lo) * Math.sqrt(d.weight / maxW[d.type])
      const community = communities.get(d.id) ?? 0
      const prev = s.pos.get(d.id)
      const a = commAngle.get(community) ?? 0
      return {
        id: d.id, data: d, r, community, color: colorRef.current(d, community),
        x: prev?.x ?? Math.cos(a) * R * 0.3 + (Math.random() - 0.5) * 30,
        y: prev?.y ?? Math.sin(a) * R * 0.3 + (Math.random() - 0.5) * 30,
      }
    })
    const byId = new Map(s.nodes.map((n) => [n.id, n]))
    s.links = edges.filter((e) => byId.has(e.source) && byId.has(e.target)).map((e) => ({ source: byId.get(e.source)!, target: byId.get(e.target)!, data: e, w: e.weight }))
    s.neighbors = new Map()
    for (const l of s.links) {
      const a = (l.source as SimNode).id, b = (l.target as SimNode).id
      if (!s.neighbors.has(a)) s.neighbors.set(a, new Set())
      if (!s.neighbors.has(b)) s.neighbors.set(b, new Set())
      s.neighbors.get(a)!.add(b)
      s.neighbors.get(b)!.add(a)
    }
    const maxLinkW = Math.max(1, ...s.links.map((l) => l.w))

    s.sim?.stop()
    s.sim = d3.forceSimulation<SimNode, SimLink>(s.nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(s.links).id((d) => d.id)
        .distance((l) => ((l.source as SimNode).data.type === 'interest' && (l.target as SimNode).data.type === 'interest' ? 150 : 46 + (l.source as SimNode).r + (l.target as SimNode).r))
        .strength((l) => 0.08 + 0.5 * Math.sqrt(l.w / maxLinkW)))
      .force('charge', d3.forceManyBody<SimNode>().strength((d) => (d.data.type === 'interest' ? -1100 : -60 - d.r * 6)).distanceMax(700))
      .force('collide', d3.forceCollide<SimNode>((d) => (d.data.type === 'interest' ? d.r + 34 : d.r + 3)).iterations(2))
      .force('cx', d3.forceX<SimNode>((d) => Math.cos(commAngle.get(d.community) ?? 0) * R).strength(0.035))
      .force('cy', d3.forceY<SimNode>((d) => Math.sin(commAngle.get(d.community) ?? 0) * R * 0.8).strength(0.035))
      .alpha(s.pos.size ? 0.6 : 1)
      .alphaDecay(0.025)
      .on('tick', () => {
        s.draw()
        // Once the layout has mostly settled, zoom to fit everything (once per data change).
        if (!fitted && s.sim!.alpha() < 0.12) { fitted = true; fitView(600) }
      })
    let fitted = !!s.pos.size && s.nodes.every((n) => s.pos.has(n.id))
    return () => { s.sim?.stop() }
  }, [nodes, edges, communities])

  // recolor without restarting the layout
  useEffect(() => {
    const s = state.current
    for (const n of s.nodes) n.color = colorOf(n.data, n.community)
    s.draw()
  }, [colorOf])

  // redraw on selection change
  useEffect(() => { state.current.draw() }, [selected])

  const fitView = (duration: number) => {
    const s = state.current
    if (!s.nodes.length || !s.zoom || !canvasRef.current) return
    const xs = s.nodes.map((n) => n.x!), ys = s.nodes.map((n) => n.y!)
    const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 40, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 50
    const k = Math.min(2, 0.95 * Math.min(s.width / (x1 - x0), height / (y1 - y0)))
    const t = d3.zoomIdentity.translate(s.width / 2 - ((x0 + x1) / 2) * k, height / 2 - ((y0 + y1) / 2) * k).scale(k)
    d3.select(canvasRef.current).transition().duration(duration).call(s.zoom.transform, t)
  }

  useImperativeHandle(ref, () => ({
    focus: (id: string) => {
      const s = state.current
      const n = s.nodes.find((x) => x.id === id)
      if (!n || !s.zoom || !canvasRef.current) return
      const k = Math.max(1.6, s.transform.k)
      const t = d3.zoomIdentity.translate(s.width / 2 - n.x! * k, height / 2 - n.y! * k).scale(k)
      d3.select(canvasRef.current).transition().duration(750).call(s.zoom.transform, t)
    },
    zoomBy: (k: number) => {
      const s = state.current
      if (s.zoom && canvasRef.current) d3.select(canvasRef.current).transition().duration(300).call(s.zoom.scaleBy, k)
    },
    reset: () => fitView(600),
  }), [height])

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height, borderRadius: 12, overflow: 'hidden', background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 5%, transparent), transparent 70%)' }}>
      <canvas ref={canvasRef} role="img" aria-label="Interest network graph" />
      <div ref={tipRef} className="tooltip" style={{ position: 'absolute', display: 'none' }} />
    </div>
  )
})

export default NetworkGraph
