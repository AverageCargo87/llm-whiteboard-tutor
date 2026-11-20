// Next.js instrumentation hook: runs once when the server starts.
// Makes Node's built-in fetch honour HTTPS_PROXY / HTTP_PROXY, which it ignores by default
// (curl reads these variables, Node does not). Useful on corporate or otherwise proxied
// networks where outbound API traffic must go through a local proxy.

import { createRequire } from 'node:module'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy

  if (!proxyUrl) return

  try {
    // createRequire is Node's native CJS require. Webpack does not analyse it statically,
    // so it never tries to bundle undici (whose mock submodule imports `node:console`).
    const nodeRequire = createRequire(import.meta.url)
    const undici = nodeRequire('undici') as typeof import('undici')
    undici.setGlobalDispatcher(new undici.ProxyAgent({ uri: proxyUrl }))
    console.log('[instrumentation] global fetch routed through the configured proxy')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[instrumentation] could not enable the proxy:', msg)
  }
}
