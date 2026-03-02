/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  async redirects() {
    return [
      { source: '/ui/system-a', destination: '/diagrama', permanent: true },
      { source: '/ui/system-architecture', destination: '/diagrama', permanent: true },
      { source: '/ui/syster', destination: '/diagrama', permanent: true },
      { source: '/ui/system', destination: '/diagrama', permanent: true },
    ]
  },
}

module.exports = nextConfig

