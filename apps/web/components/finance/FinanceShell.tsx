'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Bell,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CircleUserRound,
  HandCoins,
  History,
  House,
  Landmark,
  Tags,
  Target,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Avatar, Sheet } from '@finapp/ui/web';
import { FinanceBrand, FinanceWorkspace, MobileFinanceNav } from '@finapp/ui/finance';
import { quickAddActions } from '@finapp/ui/quick-add';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type NavItem = { href: string; label: string; icon: LucideIcon };
type SidebarProfile = LocalRecord & {
  displayName?: string;
  username?: string;
  avatarId?: string;
  avatarUrl?: string | null;
};
const navigation: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/activity', label: 'Activity', icon: History },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
  { href: '/budgets', label: 'Budgets', icon: Activity },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/groups', label: 'Groups', icon: UsersRound },
  { href: '/categories', label: 'Categories', icon: Tags },
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
  const router = useRouter();
  const { userId, identityReady } = useBrowserSync();
  const { records: profiles } = useLocalRecords<SidebarProfile>('profile');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);
  useEffect(() => {
    if (identityReady && !userId) router.replace('/sign-in');
  }, [identityReady, router, userId]);
  if (!identityReady || !userId) return null;
  const profile = profiles[0];
  const profileName = profile?.displayName?.trim() || profile?.username?.trim() || 'Your profile';
  const profileInitials =
    (profile?.displayName?.trim() || profile?.username?.trim() || 'U')
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .slice(0, 2)
      .join('')
      .toLocaleUpperCase() || 'U';

  const profileHref = '/profile';
  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
  const isProfileActive =
    pathname === '/profile' ||
    pathname.startsWith('/profile/') ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/');

  return (
    <QuickAddContext.Provider value={openQuickAdd}>
      <FinanceWorkspace
        onAdd={openQuickAdd}
        brandLink={
          pathname === '/dashboard' ? (
            <Link href="/dashboard" aria-label="Finapp overview">
              <FinanceBrand />
            </Link>
          ) : (
            <></>
          )
        }
        navigation={
          <>
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}>
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
            <Link
              href={profileHref}
              className="finance-sidebar-profile"
              aria-current={isProfileActive ? 'page' : undefined}
            >
              <Avatar
                initials={profileInitials}
                label={profileName}
                size={40}
                imageUrl={profile?.avatarUrl}
                avatarId={profile?.avatarId}
              />
              <span className="finance-sidebar-profile-copy">
                <span className="finance-sidebar-profile-name">{profileName}</span>
                {profile?.username?.trim() && (
                  <span className="finance-sidebar-profile-label">
                    @{profile.username.trim().replace(/^@+/, '')}
                  </span>
                )}
              </span>
            </Link>
          </>
        }
        mobileNavigation={
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
        }
      >
        <main>{children}</main>
      </FinanceWorkspace>
      <Sheet visible={quickAddOpen} onClose={closeQuickAdd} title="Add">
        <QuickAddActions onClose={closeQuickAdd} />
      </Sheet>
    </QuickAddContext.Provider>
  );
}
