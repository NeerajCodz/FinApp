'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import {
  Activity,
  BarChart3,
  Crown,
  Flag,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, Button, Spinner, useTheme } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import type { AdminPermission } from '@convex/admin/permissions';
import { AdminProvider, type StaffMe } from '@/lib/admin';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the viewer has any of these (empty: every staff member). */
  any: AdminPermission[];
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, any: ['VIEW_ANALYTICS'] },
      { href: '/analytics', label: 'Analytics', icon: BarChart3, any: ['VIEW_ANALYTICS'] },
    ],
  },
  {
    section: 'Community',
    items: [
      { href: '/users', label: 'Users', icon: Users, any: ['VIEW_USERS'] },
      { href: '/groups', label: 'Groups', icon: UsersRound, any: ['VIEW_GROUPS'] },
      { href: '/tickets', label: 'Tickets', icon: LifeBuoy, any: ['VIEW_TICKETS'] },
      { href: '/reports', label: 'Reports', icon: Flag, any: ['MANAGE_REPORTS'] },
    ],
  },
  {
    section: 'Trust and safety',
    items: [
      { href: '/security', label: 'Security', icon: ShieldAlert, any: ['VIEW_SECURITY'] },
      { href: '/audit', label: 'Audit log', icon: ScrollText, any: ['VIEW_AUDIT_LOG'] },
    ],
  },
  {
    section: 'Team',
    items: [
      { href: '/roles', label: 'Roles', icon: Crown, any: ['MANAGE_ROLES', 'ASSIGN_ROLES'] },
      { href: '/staff', label: 'Staff', icon: UserCog, any: [] },
      {
        href: '/announcements',
        label: 'Announcements',
        icon: Megaphone,
        any: ['MANAGE_ANNOUNCEMENTS'],
      },
      { href: '/settings', label: 'Settings', icon: Settings, any: [] },
    ],
  },
];

export function navFor(me: StaffMe) {
  const granted = new Set(me.permissions);
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.any.length || item.any.some((permission) => granted.has(permission)),
    ),
  })).filter((section) => section.items.length);
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function ThemeToggle() {
  const { isDark, setAppearance } = useTheme();
  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={() => setAppearance(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
      {isDark ? 'Light' : 'Dark'}
    </Button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="admin-center">{children}</main>;
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onPress={async () => {
        await signOut();
        router.replace('/sign-in');
      }}
    >
      <LogOut size={16} aria-hidden /> Sign out
    </Button>
  );
}

/** Auth + staff gate and the sidebar layout. */
export function Shell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery(api.admin.roles.me, isAuthenticated ? {} : 'skip');
  const status = useQuery(api.admin.account.status, isAuthenticated ? {} : 'skip');
  const counts = useQuery(
    api.support.tickets.inboxCounts,
    me?.staff && me.permissions.includes('VIEW_TICKETS') && !me.blockedByMfa ? {} : 'skip',
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/sign-in');
  }, [isLoading, isAuthenticated, router]);
  useEffect(() => setOpen(false), [pathname]);

  if (isLoading || !isAuthenticated || me === undefined || status === undefined)
    return (
      <Centered>
        <Spinner />
      </Centered>
    );

  if (status && status.state !== 'active')
    return (
      <Centered>
        <ShieldAlert size={40} aria-hidden />
        <h1>Account {status.state}</h1>
        <p>This Finapp account is {status.state}. Staff access is unavailable.</p>
        <SignOutButton />
      </Centered>
    );

  if (!me.staff)
    return (
      <Centered>
        <ShieldAlert size={40} aria-hidden />
        <h1>Access denied</h1>
        <p>
          This Finapp account isn’t on the staff team. Ask an owner to give your username a role.
        </p>
        <SignOutButton />
      </Centered>
    );

  if (me.blockedByMfa)
    return (
      <Centered>
        <ShieldCheck size={40} aria-hidden />
        <h1>Two-factor sign-in required</h1>
        <p>
          Staff need two-factor sign-in. In Finapp, open Settings → Security and turn on an
          authenticator app or email codes, then sign in here again.
        </p>
        <SignOutButton />
      </Centered>
    );

  const sections = navFor(me);
  const name = me.user?.displayName ?? 'Staff';
  const topRole = [...me.roles].sort((a, b) => b.position - a.position)[0];

  return (
    <AdminProvider me={me}>
      <div className="admin-shell">
        <aside className="admin-sidebar" data-open={open} aria-label="Console navigation">
          <Link href="/" className="admin-brand">
            <ShieldCheck size={24} aria-hidden />
            Finapp <span>Admin</span>
          </Link>
          <nav className="admin-nav">
            {sections.map((section) => (
              <div key={section.section} style={{ display: 'grid', gap: 2 }}>
                <div className="admin-nav-section">{section.section}</div>
                {section.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={isActive(pathname, href) ? 'page' : undefined}
                  >
                    <Icon size={17} aria-hidden />
                    {label}
                    {href === '/tickets' && counts && counts.open > 0 ? (
                      <span className="admin-nav-count">{counts.open}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <ThemeToggle />
            <div className="admin-me">
              <Avatar
                initials={name.slice(0, 2)}
                size={34}
                imageUrl={me.user?.avatarUrl}
                avatarId={me.user?.avatarId ?? undefined}
              />
              <div>
                <strong>{name}</strong>
                <small style={topRole ? { color: topRole.color } : undefined}>
                  {topRole ? `${topRole.icon ?? ''} ${topRole.name}`.trim() : 'Staff'}
                </small>
              </div>
            </div>
            <SignOutButton />
          </div>
        </aside>
        <div style={{ minWidth: 0 }}>
          <div className="admin-mobile-bar">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open navigation"
              onPress={() => setOpen((value) => !value)}
            >
              <Menu size={18} aria-hidden />
            </Button>
            <strong>Finapp Admin</strong>
          </div>
          <main className="admin-main">
            {!me.mfaEnabled ? (
              <div className="admin-banner" role="status">
                <ShieldAlert size={20} aria-hidden />
                <div>
                  <strong>Turn on two-factor sign-in</strong>
                  <p>
                    Your account can change other people’s access. Protect it with an authenticator
                    app or email codes in Finapp → Settings → Security.
                  </p>
                </div>
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}

export function Forbidden({ permission }: { permission: string }) {
  return (
    <div className="admin-panel admin-empty">
      <Activity size={28} aria-hidden />
      <p>You need the {permission.replace(/_/g, ' ').toLowerCase()} permission to see this page.</p>
    </div>
  );
}
