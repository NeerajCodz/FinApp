'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import {
  normalizeNotificationPreferences,
  notificationTypes,
  type NotificationType,
} from '@convex/notifications/domain';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { LocalSyncSheet } from '@/components/finance/dashboard/LocalSyncSheet';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button, Sheet } from '@finapp/ui/web';
import { quickAddActions } from '@finapp/ui/quick-add';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

type NavItem = { href: string; label: string; icon: LucideIcon };
type HeaderNotification = LocalRecord & { type?: string; readAt?: number };
type HeaderSettings = LocalRecord & { notificationPreferences?: unknown };
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

function SyncDotButton({
  state,
  tone,
  onPress,
}: {
  state: string;
  tone: 'connected' | 'syncing' | 'attention' | 'idle';
  onPress: () => void;
}) {
  return (
    <button
      className="finance-brand-status"
      type="button"
      aria-label={`Sync status: ${state}. Open sync details.`}
      aria-haspopup="dialog"
      title={`Sync status: ${state}`}
      onClick={onPress}
    >
      <span className={`sync-dot ${tone}`} aria-hidden="true" />
    </button>
  );
}

export function FinanceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    userId,
    isConnected,
    isSyncing,
    syncError,
    status,
    failedEntries,
    conflicts,
    retryNow,
    retryEntry,
    resolveConflict,
  } = useBrowserSync();
  const notifications = useLocalRecords<HeaderNotification>('notification');
  const settings = useLocalRecords<HeaderSettings>('settings');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);
  const lastNotifiedError = useRef<string | null>(null);
  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);
  const closeSyncDetails = useCallback(() => setSyncDetailsOpen(false), []);
  useEffect(() => {
    if (!syncError || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (lastNotifiedError.current === syncError) return;
    lastNotifiedError.current = syncError;
    new Notification('Finapp sync needs attention', {
      body: 'A saved change could not sync. Open Finapp and retry.',
      tag: 'finapp-sync-error',
    });
  }, [syncError]);
  const hasSyncIssue = status.failed > 0 || status.conflicts > 0 || Boolean(syncError);
  const state = !userId
    ? 'Sign in to sync'
    : hasSyncIssue
      ? 'Needs attention'
      : !isConnected
        ? 'Offline'
        : isSyncing
          ? 'Syncing'
          : status.pending > 0
            ? 'Saved locally'
            : 'All changes synced';
  const syncTone = !userId
    ? 'idle'
    : hasSyncIssue || !isConnected
      ? 'attention'
      : isSyncing || status.pending > 0
        ? 'syncing'
        : 'connected';
  const notificationPreferences = normalizeNotificationPreferences(
    settings.records[0]?.notificationPreferences,
  );
  const unreadNotifications = notifications.records.reduce((count, event) => {
    const type = event.type as NotificationType;
    return event.readAt === undefined &&
      notificationTypes.includes(type) &&
      notificationPreferences[type]
      ? count + 1
      : count;
  }, 0);
  const profileHref = userId ? '/profile' : '/sign-in';
  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
  const isProfileActive =
    pathname === '/profile' ||
    pathname.startsWith('/profile/') ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/');
  const guestHome = !userId && pathname === '/dashboard';

  return (
    <QuickAddContext.Provider value={openQuickAdd}>
      <div className={`finance-app${guestHome ? ' finance-guest-home' : ''}`}>
        <aside className="finance-sidebar" aria-label="Finapp">
          <div className="finance-brand-lockup">
            <SyncDotButton state={state} tone={syncTone} onPress={() => setSyncDetailsOpen(true)} />
            <Link className="finance-brand" href="/dashboard" aria-label="Finapp overview">
              finapp
            </Link>
          </div>
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
          </div>
        </aside>
        <div className="finance-main">
          <header className="finance-topbar">
            <div className="finance-topbar-brand finance-brand-lockup">
              <SyncDotButton
                state={state}
                tone={syncTone}
                onPress={() => setSyncDetailsOpen(true)}
              />
              <Link className="finance-brand" href="/dashboard" aria-label="Finapp overview">
                finapp
              </Link>
            </div>
            <Link
              href="/notifications"
              className="finance-notification-link"
              aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
              aria-current={isActive('/notifications') ? 'page' : undefined}
              title="Notifications"
            >
              <Bell size={19} aria-hidden="true" />
              {unreadNotifications > 0 && (
                <span className="finance-notification-badge" aria-hidden="true">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
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
                fill="var(--finance-background)"
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
      <LocalSyncSheet
        visible={syncDetailsOpen}
        isSignedIn={Boolean(userId)}
        isConnected={Boolean(userId) && isConnected}
        isSyncing={isSyncing}
        status={status}
        failedEntries={failedEntries}
        conflicts={conflicts}
        syncError={syncError}
        onClose={closeSyncDetails}
        onRetry={() => void retryNow()}
        onRetryEntry={(localId) => void retryEntry(localId)}
        onResolveConflict={(conflictId, winner) => void resolveConflict(conflictId, winner)}
        onOpenSettings={() => {
          closeSyncDetails();
          router.push('/settings/sync');
        }}
      />
    </QuickAddContext.Provider>
  );
}
