'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bell,
  ChartNoAxesCombined,
  Coins,
  LogOut,
  Palette,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  IconButton,
  Sheet,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/web';
import { SettingsRow } from '@finapp/ui/finance';
import { currencies } from '@convex/shared/validators';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & {
  displayName?: string;
  email?: string;
  username?: string;
  phone?: string;
  phoneVerificationTime?: number;
  defaultCurrency?: string;
  avatarUrl?: string | null;
};
const links = [
  { label: 'Accounts', description: 'Balances and activity', href: '/accounts', icon: Wallet },
  {
    label: 'Categories',
    description: 'Spending structure',
    href: '/categories',
    icon: ReceiptText,
  },
  { label: 'Budget', description: 'Limits and progress', href: '/budget', icon: Coins },
  {
    label: 'Analytics',
    description: 'Patterns over time',
    href: '/analytics',
    icon: ChartNoAxesCombined,
  },
];
const privacyLinks = [
  { label: 'Privacy and export', href: '/settings/privacy', icon: ShieldCheck },
];
export default function ProfilePage() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { tokens, appearance } = useTheme();
  const { records, loading, error } = useLocalRecords<Profile>('profile');
  const profile = records[0];
  const [currencyOpen, setCurrencyOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  if (!userId)
    return (
      <FinanceSignedOut
        section="PROFILE"
        title="Your money, in your hands."
        description="Sign in to view your profile and edit the details used across your private ledger."
      />
    );
  async function changeCurrency(value: string) {
    setMessage('');
    try {
      if (!userId) throw new Error('AUTH_REQUIRED');
      if (!profile) throw new Error('Your profile is not available yet.');
      const next = { ...profile, defaultCurrency: value };
      await commitLocalWrite(
        userId,
        'profile',
        'user.update',
        next,
        { defaultCurrency: value },
        { recordId: String(profile.id ?? profile._id ?? userId) },
      );
      setCurrencyOpen(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save currency.');
    }
  }
  async function leave() {
    await signOut();
    router.replace('/sign-in');
  }
  return (
    <>
      <div className="finance-page">
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="title">Profile</Typography>
          <IconButton
            label="Open settings"
            variant="ghost"
            onPress={() => router.push('/settings')}
          >
            <Settings2 size={21} aria-hidden="true" />
          </IconButton>
        </header>
        <Card
          variant="subtle"
          style={{
            display: 'grid',
            gap: 18,
            padding: 20,
            borderRadius: 24,
            border: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar
              initials={(profile?.displayName ?? 'NS').slice(0, 2)}
              label="Your profile"
              size={68}
              imageUrl={profile?.avatarUrl}
            />
            <div style={{ display: 'grid', minWidth: 0, gap: 3 }}>
              <Typography variant="heading">{profile?.displayName ?? 'Your profile'}</Typography>
              <Typography variant="small" style={{ overflowWrap: 'anywhere' }}>
                {profile?.email ?? 'Private ledger'}
              </Typography>
              <Typography variant="small">
                {profile?.username ? `@${profile.username}` : 'Username not set'}
              </Typography>
            </div>
          </div>
          <Button variant="outline" onPress={() => router.push('/profile/edit')}>
            Edit profile <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </Card>
        {(loading || error) && (
          <div style={{ display: 'grid', gap: 10 }}>
            {loading && <Text role="status">Loading your local profile…</Text>}
            {error && <Text role="alert">Profile could not be loaded from this browser.</Text>}
          </div>
        )}
        <section style={{ display: 'grid', gap: 12 }}>
          <Typography variant="label" as="h2">
            Money workspace
          </Typography>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 10,
            }}
          >
            {links.map(({ label, description, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                aria-label={`${label}, ${description}`}
                style={{
                  display: 'flex',
                  width: '48.5%',
                  minHeight: 126,
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 16,
                  border: `1px solid ${tokens.borderSubtle}`,
                  borderRadius: 18,
                  background: tokens.surfaceSubtle,
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    width: 38,
                    height: 38,
                    placeItems: 'center',
                    borderRadius: 12,
                    background: tokens.controlDisabledBackground,
                  }}
                >
                  <Icon size={19} color={tokens.primary} />
                </span>
                <span style={{ display: 'grid', gap: 2 }}>
                  <Typography variant="bodyLarge" style={{ fontSize: 15 }}>
                    {label}
                  </Typography>
                  <Typography variant="caption">{description}</Typography>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <Typography variant="label" as="h2" style={{ display: 'block', marginBottom: 4 }}>
            Profile details
          </Typography>
          <SettingsRow
            leadingIcon={<Coins size={19} color={tokens.foreground} />}
            label="Default currency"
            value={profile?.defaultCurrency ?? 'INR'}
            onPress={() => setCurrencyOpen(true)}
          />
        </section>
        <section>
          <Typography variant="label" as="h2" style={{ display: 'block', marginBottom: 4 }}>
            Preferences
          </Typography>
          <SettingsRow
            leadingIcon={<Palette size={19} color={tokens.foreground} />}
            label="Appearance"
            value={`${appearance.charAt(0).toUpperCase()}${appearance.slice(1)}`}
            onPress={() => router.push('/settings/appearance')}
          />
          <SettingsRow
            leadingIcon={<Bell size={19} color={tokens.foreground} />}
            label="Notifications"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsRow
            leadingIcon={<ShieldCheck size={19} color={tokens.foreground} />}
            label="Security"
            onPress={() => router.push('/settings/security')}
          />
        </section>
        <section>
          <Typography variant="label" as="h2" style={{ display: 'block', marginBottom: 4 }}>
            Data and privacy
          </Typography>
          {privacyLinks.map(({ label, href, icon: Icon }) => (
            <SettingsRow
              key={label}
              leadingIcon={<Icon size={19} color={tokens.foreground} />}
              label={label}
              onPress={() => router.push(href)}
            />
          ))}
        </section>
        {!!message && <Text role="status">{message}</Text>}
        <Button variant="destructive" size="lg" onPress={() => void leave()}>
          <LogOut size={16} aria-hidden="true" /> Sign out{' '}
          <ArrowRight size={18} aria-hidden="true" style={{ marginLeft: 'auto' }} />
        </Button>
      </div>
      <Sheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Default currency">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {currencies.map((currency) => (
            <Button
              key={currency}
              size="sm"
              variant={(profile?.defaultCurrency ?? 'INR') === currency ? 'primary' : 'outline'}
              onPress={() => void changeCurrency(currency)}
              style={{ width: '31%' }}
            >
              {currency}
            </Button>
          ))}
        </div>
        {!!message && <Text role="alert">{message}</Text>}
      </Sheet>
    </>
  );
}
