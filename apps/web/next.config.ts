import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@smartshaadi/types', '@smartshaadi/schemas', '@smartshaadi/db'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
};

export default nextConfig;
