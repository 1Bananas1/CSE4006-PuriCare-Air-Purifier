/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for PWA
  experimental: {
    optimizePackageImports: ['lucide-react', '@xyflow/react'],
  },
  // Configure headers for PWA
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      {
        source: '/service-worker.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true,
  },
  // Images configuration
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
