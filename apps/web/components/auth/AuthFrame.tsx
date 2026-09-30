import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@finapp/ui/web';
import { CoinLogo } from '@/components/brand/CoinLogo';

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <ThemeProvider forcedMode="dark">
    <main className="auth-layout">
      <header className="auth-header">
        <Link href="/" className="auth-wordmark" aria-label="Finapp home">
          finapp<span aria-hidden="true">.</span>
        </Link>
        <Link href="/welcome" className="auth-home-link">
          <span aria-hidden="true">←</span> Back to welcome
        </Link>
      </header>
      <div className="auth-stage">
        <aside className="auth-story" aria-label="About your Finapp account">
          <div className="auth-story-copy">
            <span className="auth-story-index">YOUR MONEY. YOUR MOMENT.</span>
            <p>Less noise.<br /><span>More clarity.</span></p>
            <span className="auth-story-detail">
              Spending, saving, and shared expenses. One clear place to make sense of it all.
            </span>
          </div>
          <div className="auth-coin-stage" aria-hidden="true">
            <CoinLogo className="auth-coin" />
          </div>
          <span className="auth-story-foot">PRIVATE BY DEFAULT <i aria-hidden="true" /> ALWAYS YOURS</span>
        </aside>
        <section className="auth-content" aria-labelledby="auth-title">
          <div className="auth-card">
            <span className="auth-eyebrow">{eyebrow}</span>
            <h1 id="auth-title">{title}</h1>
            <p className="auth-description">{description}</p>
            <div className="auth-form">{children}</div>
            <div className="auth-footer">{footer}</div>
          </div>
        </section>
      </div>
      <footer className="auth-legal">
        Your account stays yours. <Link href="/privacy">Read our privacy notes</Link>
      </footer>
    </main>
    </ThemeProvider>
  );
}
