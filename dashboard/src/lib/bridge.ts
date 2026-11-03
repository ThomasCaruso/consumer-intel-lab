// Talks to the companion Chrome extension through window.postMessage.
// The extension's content script only runs on this dashboard's own origins,
// and only forwards messages that come from this window.

import type { ChromeVisit } from './importers'
import type { Product } from './types'

export const BRIDGE_TAG = 'consumer-intel-lab'

export interface ExtensionStatus {
  installed: boolean
  version?: string
  historyGranted?: boolean
  capturedProducts?: number
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: number }
const pending = new Map<string, Pending>()
let helloVersion: string | null = null
const helloListeners = new Set<(v: string) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.origin !== window.location.origin) return
    const m = ev.data
    if (!m || m.tag !== BRIDGE_TAG) return
    if (m.dir === 'hello') {
      helloVersion = m.version
      helloListeners.forEach((f) => f(m.version))
    } else if (m.dir === 'response') {
      const p = pending.get(m.id)
      if (!p) return
      pending.delete(m.id)
      clearTimeout(p.timer)
      if (m.ok) p.resolve(m.data)
      else p.reject(new Error(m.error ?? 'Extension error'))
    }
  })
}

export function onExtensionHello(f: (version: string) => void) {
  helloListeners.add(f)
  if (helloVersion) f(helloVersion)
  return () => helloListeners.delete(f)
}

export function extensionPresent() {
  return helloVersion != null
}

function call<T>(type: string, payload?: unknown, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2)
    const timer = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('The extension did not respond. Is it installed and enabled?'))
    }, timeoutMs)
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
    window.postMessage({ tag: BRIDGE_TAG, dir: 'request', id, type, payload }, window.location.origin)
  })
}

/** Ask the content script to re-announce itself (e.g. right after install). */
export function ping() {
  window.postMessage({ tag: BRIDGE_TAG, dir: 'ping' }, window.location.origin)
}

export const ext = {
  status: () => call<ExtensionStatus>('status', undefined, 4000),
  /** Opens the extension's own permission page, where Chrome shows its permission prompt. */
  connect: () => call<{ granted: boolean; opened?: boolean }>('connect'),
  history: (days: number) => call<{ visits: ChromeVisit[]; truncated: boolean; scannedUrls: number }>('history', { days }, 180_000),
  disconnect: () => call<{ granted: boolean }>('disconnect'),
  products: () => call<Product[]>('products'),
  removeProduct: (id: string) => call<Product[]>('removeProduct', { id }),
  clearProducts: () => call<Product[]>('clearProducts'),
}
