// Single source of truth for which pages may talk to this extension.
// Keep in sync with "content_scripts.matches" in manifest.json.
export const DASHBOARD_URL = 'https://thomascaruso.github.io/consumer-intel-lab/'

export const ALLOWED_PAGES = [
  { origin: 'https://thomascaruso.github.io', pathPrefix: '/consumer-intel-lab/' },
  { origin: 'http://localhost:5173', pathPrefix: '/' },
  { origin: 'http://127.0.0.1:5173', pathPrefix: '/' },
  { origin: 'http://localhost:4173', pathPrefix: '/' },
  { origin: 'http://127.0.0.1:4173', pathPrefix: '/' },
]

export function isAllowedPage(url) {
  try {
    const u = new URL(url)
    return ALLOWED_PAGES.some((p) => u.origin === p.origin && u.pathname.startsWith(p.pathPrefix))
  } catch {
    return false
  }
}

export const MAX_DAYS = 365
export const MAX_URLS = 25000
export const MAX_VISITS = 120000

// Query-string keys that may carry credentials or session state. Removed before
// anything leaves the extension, even though it only goes to your own dashboard.
const SECRET_PARAM = /(^|[_-])(auth|sid|secret|passwd|pwd|key|apikey|code|sig|signature|otp|ticket|state|nonce)($|[_-])|token|password|session|credential/i

export function scrubUrl(raw) {
  try {
    const u = new URL(raw)
    u.hash = ''
    u.username = ''
    u.password = ''
    for (const k of [...u.searchParams.keys()]) if (SECRET_PARAM.test(k)) u.searchParams.delete(k)
    return u.toString()
  } catch {
    return null
  }
}

