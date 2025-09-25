/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Enable hot reloading in development
  webpack: (config, { dev, isServer, buildId }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    
    // Add build ID to chunk names for better cache busting
    if (!dev) {
      config.output.filename = `static/chunks/[name]-[chunkhash]-${buildId}.js`;
      config.output.chunkFilename = `static/chunks/[name]-[chunkhash]-${buildId}.js`;
    }
    
    return config
  },
  // Add experimental features for better chunk loading
  experimental: {
    optimizePackageImports: ['@tanstack/react-query', 'lucide-react'],
  },
}

module.exports = nextConfig