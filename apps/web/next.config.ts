import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vivah/types', '@vivah/schemas', '@vivah/db'],
};

export default nextConfig;
