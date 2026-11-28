import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@finapp/ui'],
  // Content is read from ./content at build time; every page is statically generated.
  outputFileTracingIncludes: { '/*': ['./content/**/*'] },
};

export default nextConfig;
