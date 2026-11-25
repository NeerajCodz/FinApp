import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@finapp/ui'],
  // Shown on the About page and in copied diagnostics.
  env: {
    NEXT_PUBLIC_GIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7),
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  },
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
