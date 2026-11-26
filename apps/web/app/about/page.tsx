'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { api } from '@convex/_generated/api';
import { PRODUCT_VERSION, RELEASE_CHANNEL } from '@convex/shared/version';
import { CoinLogo } from '@/components/brand/CoinLogo';
import { AboutScreen } from '@finapp/ui/finance';
import { releaseNotesFor, updateState, versionRows } from '@finapp/ui/version';

export default function AboutPage() {
  const router = useRouter();
  const backend = useQuery(api.system.info, {});
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  const live = backend ?? (online ? undefined : null);
  const rows = versionRows({
    platform: 'web',
    backend: live,
    commit: process.env.NEXT_PUBLIC_GIT_SHA,
    environment: process.env.NEXT_PUBLIC_DEPLOY_ENV,
  });

  return (
    <main className="finance-content">
      <AboutScreen
        logo={<CoinLogo interactive />}
        productVersion={PRODUCT_VERSION}
        channel={RELEASE_CHANNEL}
        rows={rows}
        notes={releaseNotesFor(PRODUCT_VERSION)}
        update={updateState('web', live)}
        onUpdate={() => window.location.reload()}
        onBack={() => (window.history.length > 1 ? router.back() : router.push('/'))}
        onOpenPrivacy={() => router.push('/privacy')}
      />
    </main>
  );
}
