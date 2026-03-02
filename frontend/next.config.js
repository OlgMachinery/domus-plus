/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  async redirects() {
    return [
      { source: '/ui/system-a', destination: '/ui/system-architecture', permanent: true },
    ]
  },
}

module.exports = nextConfig

