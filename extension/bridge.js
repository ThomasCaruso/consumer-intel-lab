// Content script — runs ONLY on the dashboard origins listed in manifest.json.
// It relays messages between the dashboard page and the extension background.
// It never reads the page's content and never runs anywhere else.
(() => {
  const TAG = 'consumer-intel-lab'
  const version = chrome.runtime.getManifest().version

  const hello = () => window.postMessage({ tag: TAG, dir: 'hello', version }, window.location.origin)

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.origin !== window.location.origin) return
    const m = ev.data
    if (!m || m.tag !== TAG) return
    if (m.dir === 'ping') return hello()
    if (m.dir !== 'request' || typeof m.id !== 'string' || typeof m.type !== 'string') return
    chrome.runtime.sendMessage({ type: m.type, payload: m.payload }, (res) => {
      const err = chrome.runtime.lastError
      const out = err
        ? { tag: TAG, dir: 'response', id: m.id, ok: false, error: err.message }
        : { tag: TAG, dir: 'response', id: m.id, ok: !!res?.ok, data: res?.data, error: res?.error }
      window.postMessage(out, window.location.origin)
    })
  })

  hello()
  document.addEventListener('DOMContentLoaded', hello)
})()
