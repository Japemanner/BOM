import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Geen externe font-downloads nodig tijdens build
  optimizeFonts: false,
}

export default nextConfig
