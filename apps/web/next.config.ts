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
      {
        source: '/settle/:userId',
        destination: '/settle/new?member=:userId',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
