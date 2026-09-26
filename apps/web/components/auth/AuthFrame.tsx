import Link from 'next/link';
import type { ReactNode } from 'react';

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
    <main className="auth-layout">
      <section className="auth-story" aria-label="Finapp account">
        <Link href="/" className="brand auth-brand" aria-label="Finapp home">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>finapp</span>
        </Link>
        <div className="auth-story-copy">
          <span className="auth-story-index">A MORE HUMAN WAY TO SEE IT</span>
          <p>
            Clarity feels
            <br />
            like <span>breathing room.</span>
          </p>
          <span className="auth-story-detail">
            Your money, on your terms. One calm place to see what’s moving.
          </span>
        </div>
        <span className="auth-story-foot">
          PRIVATE BY DESIGN <i /> ALWAYS YOURS
        </span>
      </section>
      <section className="auth-content" aria-labelledby="auth-title">
        <div className="auth-topline">
          <span className="auth-mobile-brand">
            <span className="brand-mark" aria-hidden="true">
              F
            </span>{' '}
            finapp
          </span>
          <Link href="/" className="auth-home-link">
            Back to home
          </Link>
        </div>
        <div className="auth-card">
          <span className="auth-eyebrow">{eyebrow}</span>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          <div className="auth-form">{children}</div>
          <div className="auth-footer">{footer}</div>
        </div>
        <span className="auth-legal">
          Your account stays yours. <Link href="/privacy">Read our privacy notes</Link>
        </span>
      </section>
    </main>
  );
}
