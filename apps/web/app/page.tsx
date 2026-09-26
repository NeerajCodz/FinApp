'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

export default function HomePage() {
  const { userId, identityReady } = useBrowserSync();
  const router = useRouter();
  const waitingForIdentity = !identityReady;

  React.useEffect(() => {
    if (waitingForIdentity) return;
    router.replace(userId ? '/dashboard' : '/welcome');
  }, [router, userId, waitingForIdentity]);

  return (
    <main className="finance-welcome" role="status" aria-live="polite">
      <p className="finance-kicker">PRIVATE WORKSPACE</p>
      <h1>{userId || waitingForIdentity ? 'Restoring your space.' : 'Opening Finapp.'}</h1>
    </main>
  );
}
