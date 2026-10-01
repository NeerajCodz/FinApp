'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
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
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Button, Sheet } from '@finapp/ui/web';
import { FinanceBrand, MobileFinanceNav } from '@finapp/ui/finance';
import { quickAddActions } from '@finapp/ui/quick-add';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

type NavItem = { href: string; label: string; icon: LucideIcon };
const navigation: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/activity', label: 'Activity', icon: History },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
  { href: '/budgets', label: 'Budgets', icon: Activity },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/categories', label: 'Categories', icon: Tags },
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

export function FinanceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, identityReady } = useBrowserSync();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);
  useEffect(() => {
    if (identityReady && !userId) router.replace('/sign-in');
  }, [identityReady, router, userId]);
  if (!identityReady || !userId) return null;

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
            <Link className="finance-brand" href="/dashboard" aria-label="Finapp overview">
              <FinanceBrand />
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
              <Link className="finance-brand" href="/dashboard" aria-label="Finapp overview">
                <FinanceBrand />
              </Link>
            </div>
          </header>
          <main className="finance-content">{children}</main>
          <MobileFinanceNav
            onAdd={openQuickAdd}
            beforeAdd={
              <>
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
              </>
            }
            afterAdd={
              <>
                {mobileNavigation.slice(2).map(({ href, label, icon: Icon }) => {
                  const active =
                    href === '/profile'
                      ? isProfileActive || pathname === profileHref
                      : isActive(href);
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
              </>
            }
          />
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
