'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  ChartNoAxesCombined,
  CircleUserRound,
  HandCoins,
  History,
  House,
  Landmark,
  Plus,
  Tags,
  Target,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button, Sheet } from '@finapp/ui/web';
import { quickAddActions } from '@finapp/ui/quick-add';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

type NavItem = { href: string; label: string; icon: LucideIcon };
const navigation: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/activity', label: 'Activity', icon: History },
  { href: '/account', label: 'Accounts', icon: Landmark },
  { href: '/budget', label: 'Budgets', icon: Activity },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/category', label: 'Categories', icon: Tags },
  { href: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { href: '/recurring', label: 'Recurring', icon: CalendarClock },
  { href: '/notifications', label: 'Notifications', icon: Bell },
];
const mobileNavigation = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/activity', label: 'Activity', icon: History },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/profile', label: 'Profile', icon: CircleUserRound },
] satisfies NavItem[];
type QuickAddLabel = (typeof quickAddActions)[number]['label'];
const quickAddIcons: Record<QuickAddLabel, LucideIcon> = {
  Expense: ArrowUpRight,
  Income: ArrowDownLeft,
  Transfer: ArrowLeftRight,
  'Split expense': UsersRound,
  Settlement: HandCoins,
};
const QuickAddContext = createContext<(() => void) | null>(null);

export function useQuickAdd() {
  const openQuickAdd = useContext(QuickAddContext);
  if (!openQuickAdd) throw new Error('useQuickAdd must be used inside FinanceShell.');
  return openQuickAdd;
}

function QuickAddActions({ onClose }: { onClose: () => void }) {
  return (
    <div className="finance-quick-add-list">
      {quickAddActions.map((action) => {
        const Icon = quickAddIcons[action.label];
        return (
          <Link
            key={action.label}
            href={action.route}
            className="finance-quick-add-option"
            onClick={onClose}
          >
            <span className="finance-quick-add-icon">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="finance-quick-add-copy">
              <span>{action.label}</span>
              <small>{action.description}</small>
            </span>
            <ArrowRight className="finance-quick-add-arrow" size={17} aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}

export function FinanceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { userId, isConnected, isSyncing, syncError, status, retryNow } = useBrowserSync();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const lastNotifiedError = useRef<string | null>(null);
  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);
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
  const profileHref = userId ? '/profile' : '/sign-in';
  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
  const isProfileActive =
    pathname === '/profile' ||
    pathname.startsWith('/profile/') ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/');

  return (
    <QuickAddContext.Provider value={openQuickAdd}>
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
              const active = isActive(href);
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
              className={`finance-nav-link${isProfileActive ? ' active' : ''}`}
            >
              <CircleUserRound size={18} aria-hidden="true" />
              <span>{userId ? 'Profile' : 'Sign in'}</span>
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
          </header>
          <main className="finance-content">{children}</main>
          <nav className="finance-mobile-nav" aria-label="Main navigation">
            <svg
              className="finance-mobile-nav-shape"
              viewBox="0 0 390 96"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 0 24 L 121 24 C 138 24 136 52 153 60 C 167 66 177 68 195 68 C 213 68 223 66 237 60 C 254 52 252 24 269 24 L 390 24 L 390 96 L 0 96 Z"
                fill="#080808"
                stroke="var(--finance-line)"
                strokeWidth="1"
              />
            </svg>
            {mobileNavigation.slice(0, 2).map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'active' : ''}
                >
                  <Icon size={22} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
            <Button
              className="finance-mobile-add"
              size="icon"
              aria-label="Add"
              onPress={openQuickAdd}
            >
              <Plus size={25} strokeWidth={2.2} aria-hidden="true" />
            </Button>
            {mobileNavigation.slice(2).map(({ href, label, icon: Icon }) => {
              const active =
                href === '/profile' ? isProfileActive || pathname === profileHref : isActive(href);
              return (
                <Link
                  key={href}
                  href={href === '/profile' ? profileHref : href}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'active' : ''}
                >
                  <Icon size={22} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <Button className="finance-desktop-add" size="icon" aria-label="Add" onPress={openQuickAdd}>
        <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
      </Button>
      <Sheet visible={quickAddOpen} onClose={closeQuickAdd} title="Add">
        <QuickAddActions onClose={closeQuickAdd} />
      </Sheet>
    </QuickAddContext.Provider>
  );
}
