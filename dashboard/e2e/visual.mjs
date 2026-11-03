// Visual QA: imports a SYNTHETIC CSV (path arg) through the drop zone and screenshots every section, dark + light.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const [file, out] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, colorScheme: 'dark' })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(process.env.DASHBOARD_URL ?? 'http://localhost:5173/')
await page.locator('input[type=file]').first().setInputFiles(file)
await page.getByText('Records analyzed', { exact: true }).waitFor({ timeout: 30000 })
for (const s of ['overview', 'universe', 'footprint', 'style', 'segments', 'discovery', 'recs', 'reality', 'privacy']) {
  const t0 = Date.now()
  await page.goto((process.env.DASHBOARD_URL ?? 'http://localhost:5173/') + '#/' + s)
  await page.waitForTimeout(s === 'universe' ? 4000 : 900)
  await page.screenshot({ path: join(out, `dark-${s}.png`), fullPage: true })
  console.log(s, Date.now() - t0, 'ms')
}
await page.getByRole('button', { name: /Light mode/ }).click()
for (const s of ['universe', 'footprint']) {
  await page.goto((process.env.DASHBOARD_URL ?? 'http://localhost:5173/') + '#/' + s)
  await page.waitForTimeout(s === 'universe' ? 4000 : 900)
  await page.screenshot({ path: join(out, `light-${s}.png`), fullPage: true })
}
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
