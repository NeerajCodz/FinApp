'use client';

import Link from 'next/link';
import { ArrowRight, Bell, Coins, Download, Palette, RefreshCw, ShieldCheck } from 'lucide-react';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

export default function SettingsPage() {
  const { userId, syncWindow } = useBrowserSync();
  if (!userId)
    return (
      <FinanceSignedOut
        section="YOUR ACCOUNT"
        title="Settings are ready when you are."
        description="Sign in to choose how Finapp looks, stores money, and protects your data."
      />
    );

  const items = [
    {
      label: 'Appearance',
      description: 'Choose dark, light, or system theme.',
      href: '/settings/appearance',
      icon: Palette,
    },
    {
      label: 'Currency',
      description: 'Set the default currency for new records.',
      href: '/settings/currency',
      icon: Coins,
    },
    {
      label: 'Notifications',
      description: 'Choose which updates appear in your inbox.',
      href: '/settings/notifications',
      icon: Bell,
    },
    {
      label: 'Security',
      description: 'Manage sign-in verification and this browser’s screen lock.',
      href: '/settings/security',
      icon: ShieldCheck,
    },
    {
      label: 'Local sync',
      description: syncWindow === 'all' ? 'All history' : `${syncWindow} days`,
      href: '/settings/sync',
      icon: RefreshCw,
    },
    {
      label: 'Privacy and export',
      description: 'Review browser storage and export controls.',
      href: '/settings/privacy',
      icon: Download,
    },
  ];

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <h1>Settings</h1>
          <p className="finance-muted">
            Choose how Finapp looks, stores money, and protects your data.
          </p>
        </div>
        <Link className="finance-secondary-action" href="/profile">
          Back to profile
        </Link>
      </header>
      <nav className="finance-settings-list" aria-label="Settings">
        {items.map(({ label, description, href, icon: Icon }) => (
          <Link className="finance-settings-row" href={href} key={href}>
            <Icon size={19} aria-hidden="true" />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
