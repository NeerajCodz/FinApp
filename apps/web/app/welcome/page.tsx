'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react';
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
      <main className="landing" role="status" aria-live="polite">
        <p className="finance-kicker">PRIVATE WORKSPACE</p>
        <h1>Restoring your space.</h1>
        <p className="finance-muted">Your saved records are being checked before the ledger opens.</p>
      </main>
    );
  }

  return (
    <main className="landing">
      <header className="site-header">
        <Link className="brand" href="/welcome" aria-label="Finapp welcome">
          <Image src="/icon.png" width={36} height={36} alt="" priority />
          <span>finapp</span>
        </Link>
        <nav className="site-nav" aria-label="Account navigation">
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </header>
      <section className="hero" aria-labelledby="welcome-heading">
        <div className="hero-copy">
          <p className="finance-kicker">PRIVATE MONEY, CLEARLY</p>
          <h1 id="welcome-heading">A calmer way to know where your money goes.</h1>
          <p>
            Keep your accounts, everyday spending, plans, and shared expenses in one private ledger.
            Your browser saves changes locally first and syncs them when a connection is available.
          </p>
          <div className="hero-actions">
            <Link
              className="finance-primary-link"
              href="/sign-up"
              style={{
                backgroundColor: 'var(--finapp-primary, #b7ff4a)',
                color: 'var(--finapp-primary-foreground, #10140c)',
              }}
            >
              Create account <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="finance-secondary-action" href="/sign-in">
              Sign in
            </Link>
          </div>
          <p className="finance-muted" style={{ color: 'var(--finapp-foreground-subtle, #9a9e91)' }}>
            <ShieldCheck size={15} aria-hidden="true" /> Your browser copy is profile-scoped and is
            not separately encrypted by Finapp.
          </p>
        </div>
        <div className="preview-wrap" aria-label="Finapp private money overview">
          <div className="preview-card">
            <div className="preview-topline">
              <span className="preview-label">PRIVATE FINANCIAL WORKSPACE</span>
              <span className="preview-add" aria-hidden="true">+</span>
            </div>
            <p className="preview-caption">Your financial life in one place</p>
            <div className="preview-balance">
              Clear<span> by design</span>
            </div>
            <div className="preview-change">
              <span className="change-pill">LOCAL FIRST</span>
              <span>Syncs when connected</span>
            </div>
            <div className="preview-divider" />
            <div className="preview-activity">
              <span className="activity-icon" aria-hidden="true">
                <Wallet size={16} />
              </span>
              <span className="activity-copy">
                <strong>Accounts and activity</strong>
                <small>Plans and shared expenses</small>
              </span>
              <span className="activity-amount">Private</span>
            </div>
          </div>
        </div>
      </section>
      <footer className="site-footer">
        <span>finapp.</span>
        <Link href="/privacy">Privacy notes</Link>
      </footer>
    </main>
  );
}
