import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@smartshaadi/types', '@smartshaadi/schemas', '@smartshaadi/db'],
};

export default nextConfig;
