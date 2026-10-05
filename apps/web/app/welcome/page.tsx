'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { ThemeProvider } from '@finapp/ui/web';
import { CoinLogo } from '@/components/brand/CoinLogo';
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
          <Link href="/" className="auth-home-link auth-welcome-brand" aria-label="Finapp home">
            <span className="auth-welcome-brand-mark" aria-hidden="true">
              F
            </span>
            <span>finapp</span>
          </Link>
          <span className="auth-welcome-header-note">Your money. Your moment.</span>
        </header>
        <section className="auth-welcome-hero" aria-labelledby="welcome-title">
          <div className="auth-welcome-copy">
            <p className="auth-eyebrow">PRIVATE MONEY, CLEARLY</p>
            <h1 id="welcome-title">
              Less noise.
              <br />
              <span>More clarity.</span>
            </h1>
            <p className="auth-welcome-description">
              See spending, savings goals, and shared expenses together. Know what comes next.
            </p>
            <div className="auth-welcome-visuals">
              <figure className="auth-welcome-photo auth-welcome-photo--mountains">
                <Image
                  src="/landing/mountain-goal.webp"
                  alt="Sunrise over mountain peaks above a sea of clouds"
                  fill
                  priority
                  sizes="(max-width: 760px) 62vw, (max-width: 1200px) 48vw, 580px"
                />
                <figcaption>
                  <span>The long view</span>
                  <strong>Make room for the plans that matter.</strong>
                </figcaption>
              </figure>
              <figure className="auth-welcome-photo auth-welcome-photo--shared">
                <Image
                  src="/landing/shared-table.webp"
                  alt="A warmly lit restaurant set for a shared meal"
                  fill
                  sizes="(max-width: 760px) 34vw, (max-width: 1200px) 31vw, 390px"
                />
                <figcaption>
                  <span>Everyday, together</span>
                  <strong>Keep shared spending clear.</strong>
                </figcaption>
              </figure>
            </div>
          </div>
          <div className="auth-welcome-entry">
            <div className="auth-welcome-coin-stage">
              <CoinLogo className="auth-welcome-coin" interactive />
            </div>
            <div className="auth-welcome-actions">
              <Link href="/sign-up" className="auth-welcome-action auth-welcome-action--primary">
                Create account <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/sign-in" className="auth-welcome-action">
                Sign in <span aria-hidden="true">→</span>
              </Link>
            </div>
            {restoring && (
              <div className="auth-restoring" role="status" aria-live="polite">
                <span className="auth-status-dot" aria-hidden="true" />
                <div>
                  <h2>{userId ? 'Opening your space.' : 'Restoring your space.'}</h2>
                  <p>Your saved records are being checked before the ledger opens.</p>
                </div>
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
