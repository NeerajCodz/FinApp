'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type RouteStatusProps = {
  title: string;
  description: string;
  detail?: string;
  action?: ReactNode;
};

const shell: React.CSSProperties = {
  minHeight: '70vh',
  display: 'grid',
  placeItems: 'center',
  padding: '48px 20px',
  background: 'var(--finapp-background)',
  color: 'var(--finapp-foreground)',
  fontFamily: 'var(--finapp-font-sans)',
};

/** Themed status view shared by error, global-error and not-found routes. */
export function RouteStatus({ title, description, detail, action }: RouteStatusProps) {
  return (
    <main role="alert" style={shell}>
      <div style={{ display: 'grid', gap: 14, maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>{title}</h1>
        <p style={{ margin: 0, color: 'var(--finapp-muted-foreground)' }}>{description}</p>
        {detail ? (
          <code style={{ fontSize: 12, color: 'var(--finapp-foreground-subtle)' }}>{detail}</code>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
          {action}
          <Link href="/dashboard" style={secondaryButton}>
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

export const primaryButton: React.CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: '12px 18px',
  background: 'var(--finapp-primary)',
  color: 'var(--finapp-primary-foreground)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: 'var(--finapp-secondary)',
  color: 'var(--finapp-secondary-foreground)',
  textDecoration: 'none',
};
