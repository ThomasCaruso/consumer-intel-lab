// Renders the extension/dashboard icon (a small knowledge-graph mark) to PNG
// with no dependencies: signed-distance shapes + 4x supersampling + zlib.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const BG1 = hex('#141a2e'), BG2 = hex('#0a0c14'), CYAN = hex('#5ee6d0'), VIOLET = hex('#a78bfa'), AMBER = hex('#ffb547'), LINE = hex('#8fa3d6')

// geometry in unit square
const nodes = [
  { x: 0.33, y: 0.36, r: 0.115, c: CYAN },
  { x: 0.70, y: 0.30, r: 0.085, c: VIOLET },
  { x: 0.64, y: 0.70, r: 0.10, c: AMBER },
  { x: 0.30, y: 0.72, r: 0.06, c: VIOLET },
]
const links = [[0, 1], [0, 2], [1, 2], [0, 3], [3, 2]]

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
function roundRectSd(px, py, r) {
  const qx = Math.abs(px - 0.5) - (0.5 - r), qy = Math.abs(py - 0.5) - (0.5 - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

function sample(px, py, size) {
  // returns [r,g,b,a]
  if (roundRectSd(px, py, 0.22) > 0) return [0, 0, 0, 0]
  const t = (px + py) / 2
  let col = BG1.map((v, i) => v * (1 - t) + BG2[i] * t)
  const lw = Math.max(0.028, 1.4 / size)
  for (const [a, b] of links) {
    const A = nodes[a], B = nodes[b]
    if (segDist(px, py, A.x, A.y, B.x, B.y) < lw / 2) col = col.map((v, i) => v * 0.35 + LINE[i] * 0.65)
  }
  for (const n of nodes) {
    const d = Math.hypot(px - n.x, py - n.y)
    if (d < n.r * 1.45 && size >= 32) col = col.map((v, i) => v * 0.8 + n.c[i] * 0.2) // halo
    if (d < n.r) col = n.c
  }
  return [...col, 255]
}

function render(size) {
  const ss = 4
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const [cr, cg, cb, ca] = sample((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, size)
      r += cr * ca; g += cg * ca; b += cb * ca; a += ca
    }
    const o = (y * size + x) * 4
    buf[o] = a ? r / a : 0; buf[o + 1] = a ? g / a : 0; buf[o + 2] = a ? b / a : 0; buf[o + 3] = a / (ss * ss)
  }
  return png(size, buf)
}

const outExt = join(root, 'extension', 'icons')
mkdirSync(outExt, { recursive: true })
for (const s of [16, 32, 48, 128]) writeFileSync(join(outExt, `icon${s}.png`), render(s))
const outStore = join(root, 'store')
mkdirSync(outStore, { recursive: true })
writeFileSync(join(outStore, 'icon128.png'), render(128))
const pub = join(root, 'dashboard', 'public')
mkdirSync(pub, { recursive: true })
writeFileSync(join(pub, 'icon-192.png'), render(192))
console.log('icons written')
