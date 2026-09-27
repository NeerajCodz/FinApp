import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@finapp/ui'],
  async redirects() {
    return [
      {
        source: '/group/:id/expenses/new',
        destination: '/split/new?groupId=:id',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
