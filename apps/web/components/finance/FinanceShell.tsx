'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowLeftRight,
  ChartNoAxesCombined,
  CircleUserRound,
  Landmark,
  Target,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

type NavItem = { href: string; label: string; icon: typeof ChartNoAxesCombined };
const navigation: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: ChartNoAxesCombined },
  { href: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
  { href: '/budgets', label: 'Budgets', icon: Activity },
  { href: '/goals', label: 'Goals', icon: Target },
];

export function FinanceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { userId, isConnected, isSyncing, syncError, status, retryNow } = useBrowserSync();
  const lastNotifiedError = useRef<string | null>(null);
  useEffect(() => {
    if (!syncError || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (lastNotifiedError.current === syncError) return;
    lastNotifiedError.current = syncError;
    new Notification('Finapp sync needs attention', {
      body: 'A saved change could not sync. Open Finapp and retry.',
      tag: 'finapp-sync-error',
    });
  }, [syncError]);
  const state = isSyncing
    ? 'Syncing'
    : !isConnected
      ? 'Offline'
      : status.failed || status.conflicts
        ? 'Needs attention'
        : status.pending > 0
          ? 'Saved locally'
          : 'All changes synced';
  const profileHref = userId ? '/settings' : '/sign-in';

  return (
    <div className="finance-app">
      <aside className="finance-sidebar" aria-label="Finapp">
        <Link className="finance-brand" href="/dashboard" aria-label="Finapp overview">
          <span className="finance-brand-mark" aria-hidden="true">
            F
          </span>
          <span>finapp</span>
        </Link>
        <p className="finance-sidebar-label">YOUR MONEY</p>
        <nav className="finance-nav" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                className={`finance-nav-link${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="finance-sidebar-bottom">
          <Link
            href={profileHref}
            className={`finance-nav-link${pathname === '/settings' ? ' active' : ''}`}
          >
            <CircleUserRound size={18} aria-hidden="true" />
            <span>{userId ? 'Preferences' : 'Sign in'}</span>
          </Link>
          <div className="finance-sync-state" role="status" aria-live="polite">
            <span
              className={`sync-dot${isConnected ? ' connected' : ''}${status.failed || status.conflicts ? ' attention' : ''}`}
            />
            <span>{state}</span>
            {status.pending + status.failed + status.conflicts > 0 && (
              <span className="sync-count">
                {status.pending + status.failed + status.conflicts}
              </span>
            )}
          </div>
          {syncError && (
            <p className="finance-sync-error" role="alert">
              {syncError}
            </p>
          )}
          {(status.failed > 0 || status.conflicts > 0) && (
            <button className="finance-retry" type="button" onClick={() => void retryNow()}>
              Retry sync
            </button>
          )}
        </div>
      </aside>
      <div className="finance-main">
        <header className="finance-mobile-header">
          <Link className="finance-brand" href="/dashboard" aria-label="Finapp overview">
            <span className="finance-brand-mark" aria-hidden="true">
              F
            </span>
            <span>finapp</span>
          </Link>
          <span className="finance-mobile-status">
            <span className={`sync-dot${isConnected ? ' connected' : ''}`} />
            {state}
          </span>
          <Link
            className={`finance-mobile-profile${pathname === '/settings' ? ' active' : ''}`}
            href={profileHref}
            aria-label={userId ? 'Preferences' : 'Sign in'}
          >
            <CircleUserRound size={19} aria-hidden="true" />
          </Link>
        </header>
        <main className="finance-content">{children}</main>
        <nav className="finance-mobile-nav" aria-label="Main navigation">
          {navigation.slice(0, 5).map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={active ? 'active' : ''}
              >
                <Icon size={19} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
