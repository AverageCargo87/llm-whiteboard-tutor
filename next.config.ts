import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Pin the workspace root to this folder. Otherwise Next.js can pick up a stray
  // package-lock.json higher up the tree and treat that directory as the root.
  outputFileTracingRoot: path.resolve(__dirname),

  // undici (used by instrumentation.ts for ProxyAgent) pulls in node:console,
  // and webpack rejects node: URIs by default. Mark undici and every node: import
  // as externals so Next loads them through native Node require instead of bundling.
  serverExternalPackages: ['undici'],

  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = config.externals
      const list = Array.isArray(externals)
        ? externals
        : externals
          ? [externals]
          : []
      config.externals = [
        ...list,
        (
          { request }: { request?: string },
          callback: (err?: unknown, result?: string) => void,
        ) => {
          if (request && request.startsWith('node:')) {
            return callback(undefined, 'commonjs ' + request)
          }
          callback()
        },
      ]
    }
    return config
  },
}

export default nextConfig
