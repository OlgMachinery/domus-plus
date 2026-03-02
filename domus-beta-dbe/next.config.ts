import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  turbopack: {
    // Evita que Next infiera el root por lockfiles externos (monorepo).
    root: rootDir,
  },
  async redirects() {
    return [
      { source: '/diagram', destination: '/ui/system-architecture', permanent: true },
      { source: '/diagrama', destination: '/ui/system-architecture', permanent: true },
      { source: '/ui/system-a', destination: '/ui/system-architecture', permanent: true },
      { source: '/ui/syster', destination: '/ui/system-architecture', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        // Evita HTML viejo en /ui durante el beta
        source: '/ui/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // Setup también es sensible a sesión (mejor sin cache)
        source: '/setup/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ]
  },
}

export default nextConfig
