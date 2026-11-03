// Zips extension/ into dashboard/public/consumer-intel-lab-extension.zip so the
// dashboard can offer a download for the temporary (unpacked) install, and into
// store/ for Chrome Web Store upload. Uses PowerShell/zip — no npm deps.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'extension')
const outs = [join(root, 'dashboard', 'public', 'consumer-intel-lab-extension.zip'), join(root, 'store', 'consumer-intel-lab-extension.zip')]
for (const o of outs) { mkdirSync(dirname(o), { recursive: true }); if (existsSync(o)) rmSync(o) }

const files = []
const walk = (d, rel = '') => { for (const f of readdirSync(d)) { const p = join(d, f); const r = rel ? `${rel}/${f}` : f; statSync(p).isDirectory() ? walk(p, r) : files.push(r) } }
walk(src)

if (process.platform === 'win32') {
  // Compress-Archive puts files at the zip root when given the folder contents.
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${src}\\*' -DestinationPath '${outs[0]}' -Force`], { stdio: 'inherit' })
} else {
  execFileSync('zip', ['-qr', outs[0], '.'], { cwd: src, stdio: 'inherit' })
}
copyFileSync(outs[0], outs[1])
console.log(`packed ${files.length} files → ${outs.map((o) => o.replace(root, '.')).join(', ')}`)
