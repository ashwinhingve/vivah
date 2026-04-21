import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@smartshaadi/types', '@smartshaadi/schemas'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'http',  hostname: '127.0.0.1' },
    ],
  },
};

export default nextConfig;
