'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { Button } from '@finapp/ui/web';
import Image from 'next/image';
import appIcon from '../../../mobile/assets/icon.png';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

export default function WelcomePage() {
  const auth = useConvexAuth();
  const { userId, identityReady } = useBrowserSync();
  const router = useRouter();

  React.useEffect(() => {
    if (identityReady && userId) router.replace('/dashboard');
  }, [identityReady, router, userId]);

  if (auth.isAuthenticated && !userId) {
    return (
      <main className="auth-welcome" role="status" aria-live="polite">
        <p className="auth-eyebrow">PRIVATE MONEY, CLEARLY</p>
        <h1>Restoring your space.</h1>
        <p>Your saved records are being checked before the ledger opens.</p>
      </main>
    );
  }

  return (
    <main className="auth-welcome">
      <p className="auth-eyebrow">PRIVATE MONEY, CLEARLY</p>
      <section className="auth-welcome-center" aria-labelledby="welcome-title">
        <div className="auth-welcome-mark">
          <Image
            src={appIcon}
            alt="Finapp app icon"
            width={176}
            height={176}
            style={{ width: '100%', height: '100%', transform: 'scale(2.12)' }}
          />
        </div>
        <h1 id="welcome-title">finapp</h1>
        <p>Your money. Your people. One clear place.</p>
      </section>
      <div className="auth-welcome-actions">
        <Button size="lg" onPress={() => router.push('/sign-up')}>
          Create account
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.push('/sign-in')}>
          Log in
        </Button>
        <p>Private by default. Built for everyday money.</p>
      </div>
    </main>
  );
}
