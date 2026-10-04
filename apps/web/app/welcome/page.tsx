'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { Button, ThemeProvider } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

export default function WelcomePage() {
  const auth = useConvexAuth();
  const { userId, identityReady } = useBrowserSync();
  const router = useRouter();
  const restoring = auth.isLoading || !identityReady || Boolean(userId) || auth.isAuthenticated;

  React.useEffect(() => {
    if (identityReady && userId) router.replace('/dashboard');
  }, [identityReady, router, userId]);

  return (
    <ThemeProvider forcedMode="dark">
      <main className="auth-welcome">
        <header className="auth-header">
          <Link href="/" className="auth-home-link">
            Explore Finapp <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <section className="auth-welcome-hero" aria-labelledby="welcome-title">
          <div className="auth-welcome-copy">
            <p className="auth-eyebrow">PRIVATE MONEY, CLEARLY</p>
            <h1 id="welcome-title">
              Your money.
              <br />
              <span>In your corner.</span>
            </h1>
            <p className="auth-welcome-description">
              Your money. Your people. One clear place. Get a little more perspective on what comes
              in, what goes out, and what comes next.
            </p>
            {restoring ? (
              <div className="auth-restoring" role="status" aria-live="polite">
                <span className="auth-status-dot" aria-hidden="true" />
                <div>
                  <h2>{userId ? 'Opening your space.' : 'Restoring your space.'}</h2>
                  <p>Your saved records are being checked before the ledger opens.</p>
                </div>
              </div>
            ) : (
              <div className="auth-welcome-actions">
                <Button size="lg" onPress={() => router.push('/sign-up')}>
                  Create your account{' '}
                  <span className="auth-button-arrow" aria-hidden="true">
                    ↗
                  </span>
                </Button>
                <Link href="/sign-in" className="auth-welcome-sign-in">
                  Already have an account?{' '}
                  <span>
                    Sign in <span aria-hidden="true">→</span>
                  </span>
                </Link>
                <p>Private by default. Built for everyday money.</p>
              </div>
            )}
          </div>
        </section>
        <section className="auth-welcome-features" aria-label="Your Finapp space">
          <div>
            <span className="auth-feature-number" aria-hidden="true">
              01
            </span>
            <p>
              See the whole picture.<span>Accounts and everyday spending, together.</span>
            </p>
          </div>
          <div>
            <span className="auth-feature-number" aria-hidden="true">
              02
            </span>
            <p>
              Give your plans a place.<span>Budgets and savings goals you can follow.</span>
            </p>
          </div>
          <div>
            <span className="auth-feature-number" aria-hidden="true">
              03
            </span>
            <p>
              Keep shared money clear.<span>Split expenses without losing track.</span>
            </p>
          </div>
        </section>
        <footer className="auth-legal">
          Your account stays yours. <Link href="/privacy">Read our privacy notes</Link>
        </footer>
      </main>
    </ThemeProvider>
  );
}
