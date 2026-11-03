// AUTOMATED EXTENSION TEST (not a real installation test).
// Loads the extension into a throwaway Chromium profile, seeds that profile's history
// with SYNTHETIC URLs, and drives the dashboard end to end. Nothing here touches your
// real Chrome profile or history.
//
// Because automation cannot click Chrome's permission prompt, part B uses a temp copy of
// the extension whose manifest makes "history" a required permission. Part A checks
// the real optional-permission flow up to the prompt.
//
// Usage: (dev server running on :5173) node e2e/extension.e2e.mjs [--shots dir]
import { chromium } from 'playwright'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const EXT = resolve(here, '..', '..', 'extension')
const BASE = process.env.DASHBOARD_URL ?? 'http://localhost:5173/'
const shotsIdx = process.argv.indexOf('--shots')
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`) }

async function launch(extDir) {
  const profile = mkdtempSync(join(tmpdir(), 'cil-e2e-'))
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    viewport: { width: 1440, height: 950 },
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  })
  let [sw] = ctx.serviceWorkers()
  if (!sw) sw = await ctx.waitForEvent('serviceworker')
  return { ctx, sw, profile, id: new URL(sw.url()).host }
}

// ---------------- Part A: real manifest, optional permission ----------------
{
  const { ctx, sw, profile, id } = await launch(EXT)
  check('A1 extension loads (MV3 service worker)', !!id, id)
  const granted = await sw.evaluate(() => chrome.permissions.contains({ permissions: ['history'] }))
  check('A2 history NOT granted at install', granted === false)
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByText(/Connector extension v1\.0\.0 detected/).first().waitFor({ timeout: 10000 })
  check('A3 dashboard detects extension via bridge', true)
  const [connectTab] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 10000 }),
    page.getByRole('button', { name: /Approve history access/ }).click(),
  ])
  await connectTab.waitForLoadState()
  check('A4 Approve opens the extension permission page', connectTab.url() === `chrome-extension://${id}/connect.html`, connectTab.url())
  check('A5 permission page explains what is / is not read', (await connectTab.textContent('body')).includes('Passwords, cookies'))
  if (SHOTS) await connectTab.screenshot({ path: join(SHOTS, 'connect-page.png') })
  // An unauthorized origin must not be able to reach the extension.
  const other = await ctx.newPage()
  await other.goto('data:text/html,<p>x</p>')
  const leaked = await other.evaluate(() => new Promise((r) => {
    window.addEventListener('message', (e) => { if (e.data?.dir === 'response' || e.data?.dir === 'hello') r(true) })
    window.postMessage({ tag: 'consumer-intel-lab', dir: 'request', id: '1', type: 'status' }, '*')
    setTimeout(() => r(false), 1500)
  }))
  check('A6 non-dashboard page gets no bridge', leaked === false)
  await ctx.close()
  rmSync(profile, { recursive: true, force: true })
}

// ---------------- Part B: test copy with history pre-granted ----------------
{
  const tmpExt = mkdtempSync(join(tmpdir(), 'cil-ext-'))
  cpSync(EXT, tmpExt, { recursive: true })
  const mf = JSON.parse(readFileSync(join(tmpExt, 'manifest.json'), 'utf8'))
  mf.permissions.push('history')
  mf.optional_permissions = []
  writeFileSync(join(tmpExt, 'manifest.json'), JSON.stringify(mf, null, 2))
  const { ctx, sw, profile } = await launch(tmpExt)

  // Seed SYNTHETIC history into the throwaway profile.
  const seeded = await sw.evaluate(async () => {
    const urls = []
    const add = (u, n) => { for (let i = 0; i < n; i++) urls.push(u) }
    add('https://github.com/example/project', 30)
    add('https://www.amazon.com/s?k=mechanical+keyboard', 6)
    add('https://www.amazon.com/Keychron-K2-Keyboard/dp/B07QBPDWLS', 4)
    add('https://www.bestbuy.com/site/searchpage.jsp?st=mechanical+keyboard', 3)
    add('https://www.google.com/search?q=best+mechanical+keyboard+review', 5)
    add('https://www.espn.com/nba/', 12)
    add('https://www.youtube.com/watch?v=abc', 10)
    add('https://www.webmd.com/a/symptoms', 3)
    add('https://docs.google.com/document/d/1/edit?token=SECRET123', 8)
    for (const url of urls) await chrome.history.addUrl({ url })
    return urls.length
  })
  check('B1 seeded synthetic history in throwaway profile', seeded > 0, `${seeded} visits`)

  const page = await ctx.newPage()
  page.on('pageerror', (e) => check('page error', false, e.message))
  await page.goto(BASE)
  await page.getByRole('button', { name: /Analyze my history/ }).click({ timeout: 10000 })
  await page.getByText('Records analyzed', { exact: true }).waitFor({ timeout: 30000 })
  const body = await page.textContent('body')
  check('B2 Connect → Analyze renders a profile', /Your interest constellation/.test(body))
  check('B3 sensitive records excluded (count shown)', /excluded: [1-9]\d* sensitive/.test(body))
  check('B4 secret URL params stripped before transfer', !(await page.evaluate(() => document.body.innerHTML.includes('SECRET123'))))

  const sections = ['overview', 'universe', 'footprint', 'style', 'segments', 'discovery', 'recs', 'reality', 'privacy']
  for (const s of sections) {
    await page.goto(BASE + '#/' + s)
    await page.waitForTimeout(s === 'universe' ? 2500 : 700)
    const h1 = await page.textContent('h1')
    check(`B5 section ${s} renders`, !!h1, h1)
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${s}.png`), fullPage: true })
  }
  // Universe interactions: click a node at the canvas center region, search.
  await page.goto(BASE + '#/universe')
  await page.waitForTimeout(2500)
  await page.getByPlaceholder(/Find a site/).fill('amazon')
  await page.getByRole('button', { name: /amazon\.com/ }).first().click()
  await page.waitForTimeout(900)
  check('B6 network search selects & focuses a node', /connections/.test(await page.textContent('main')))
  // Feedback
  await page.goto(BASE + '#/reality')
  await page.getByRole('button', { name: 'Inaccurate' }).first().click()
  check('B7 feedback grading updates accuracy', /1 inaccurate/.test(await page.textContent('main')))
  // Theme + mobile
  const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.getByRole('button', { name: /(Light|Dark) mode/ }).click()
  const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme)
  check('B8 theme toggles', themeBefore !== themeAfter, `${themeBefore} → ${themeAfter}`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(BASE + '#/overview')
  await page.waitForTimeout(600)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('B9 no horizontal scroll at phone width', overflow <= 1, `overflow ${overflow}px`)
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'mobile-overview.png'), fullPage: false })
  await page.setViewportSize({ width: 1440, height: 950 })
  // Disconnect + reset
  await page.goto(BASE + '#/privacy')
  await page.getByRole('button', { name: /Reset dashboard/ }).click()
  await page.getByRole('button', { name: /Yes, delete everything/ }).click()
  await page.waitForTimeout(800)
  check('B10 reset clears all records', /No personal data loaded/.test(await page.textContent('aside')))
  await ctx.close()
  rmSync(profile, { recursive: true, force: true })
  rmSync(tmpExt, { recursive: true, force: true })
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} automated extension checks passed`)
process.exit(failed.length ? 1 : 0)
