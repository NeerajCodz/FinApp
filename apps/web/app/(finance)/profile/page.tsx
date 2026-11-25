'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  ArrowRight,
  AtSign,
  Bell,
  Bot,
  ChartNoAxesCombined,
  Coins,
  Info,
  KeyRound,
  LogOut,
  Mail,
  Palette,
  PencilLine,
  PlugZap,
  ReceiptText,
  Settings,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Avatar, Button, Sheet, Text, useTheme } from '@finapp/ui/web';
import { SettingsGroup, SettingsIconButton, SettingsLink, SettingsShell } from '@finapp/ui/finance';
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
  avatarId?: string;
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
  { label: 'Budget', description: 'Limits and progress', href: '/budgets', icon: Coins },
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
  const { userId, isConnected } = useBrowserSync();
  const { tokens, appearance } = useTheme();
  const live = Boolean(userId && isConnected);
  const finai = useQuery(api.ai.settings.get, live ? {} : 'skip');
  const grants = useQuery(api.mcpOAuth.listGrants, live ? { limit: 50 } : 'skip');
  const activeConnections = grants?.filter((grant) => grant.revokedAt === undefined).length ?? 0;
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
  const name = profile?.displayName ?? 'Your profile';
  return (
    <>
      <SettingsShell
        title="Profile"
        subtitle="Your account, preferences and AI"
        wide
        actions={
          <SettingsIconButton label="Settings" onPress={() => router.push('/settings')}>
            <Settings size={20} aria-hidden="true" />
          </SettingsIconButton>
        }
      >
        <section className="me-hero" data-span>
          <div className="me-cover" aria-hidden />
          <div className="me-hero-body">
            <span className="me-avatar">
              <Avatar
                initials={name.slice(0, 2).toUpperCase()}
                label="Your profile"
                size={92}
                imageUrl={profile?.avatarUrl}
                avatarId={profile?.avatarId}
              />
            </span>
            <div className="me-identity">
              <h2>{name}</h2>
              <p>
                {profile?.username ? (
                  <span>
                    <AtSign size={14} aria-hidden />
                    {profile.username}
                  </span>
                ) : (
                  <span>Username not set</span>
                )}
                {profile?.email ? (
                  <span>
                    <Mail size={14} aria-hidden />
                    {profile.email}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="me-actions">
              <Button variant="outline" onPress={() => router.push('/profile/edit')}>
                <PencilLine size={16} aria-hidden="true" /> Edit profile
              </Button>
              {profile?.username ? (
                <Button
                  variant="ghost"
                  onPress={() => router.push(`/profile/${encodeURIComponent(profile.username!)}`)}
                >
                  Public profile <ArrowRight size={16} aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {(loading || error) && (
          <div style={{ display: 'grid', gap: 10, gridColumn: '1 / -1' }}>
            {loading && <Text role="status">Loading your local profile…</Text>}
            {error && <Text role="alert">Profile could not be loaded from this browser.</Text>}
          </div>
        )}

        <section className="me-workspace" data-span aria-label="Money workspace">
          {links.map(({ label, description, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="me-tile"
              aria-label={`${label}, ${description}`}
            >
              <span className="me-tile-icon" aria-hidden="true">
                <Icon size={19} color={tokens.primary} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </Link>
          ))}
        </section>

        <SettingsGroup title="AI">
          <SettingsLink
            icon={<Bot size={19} />}
            tone="violet"
            title="FinAI"
            description="Personality, data access, actions and chats"
            value={finai ? (finai.enabled ? 'On' : 'Off') : undefined}
            onPress={() => router.push('/settings/ai/finai')}
          />
          <SettingsLink
            icon={<KeyRound size={19} />}
            tone="warning"
            title="API keys"
            description="Bring your own model key"
            onPress={() => router.push('/settings/ai/keys')}
          />
          <SettingsLink
            icon={<PlugZap size={19} />}
            tone="info"
            title="MCP connections"
            description="ChatGPT, Claude and other AI apps"
            value={grants ? `${activeConnections} active` : undefined}
            onPress={() => router.push('/settings/ai/mcp')}
          />
        </SettingsGroup>

        <SettingsGroup title="Preferences">
          <SettingsLink
            icon={<Coins size={19} />}
            tone="warning"
            title="Default currency"
            value={profile?.defaultCurrency ?? 'INR'}
            onPress={() => setCurrencyOpen(true)}
          />
          <SettingsLink
            icon={<Palette size={19} />}
            tone="violet"
            title="Appearance"
            value={`${appearance.charAt(0).toUpperCase()}${appearance.slice(1)}`}
            onPress={() => router.push('/settings/appearance')}
          />
          <SettingsLink
            icon={<Bell size={19} />}
            tone="info"
            title="Notifications"
            onPress={() => router.push('/settings/notifications')}
          />
        </SettingsGroup>

        <SettingsGroup title="Security and data">
          <SettingsLink
            icon={<ShieldCheck size={19} />}
            tone="positive"
            title="Security"
            description="Password, two-factor and app lock"
            onPress={() => router.push('/settings/security')}
          />
          {privacyLinks.map(({ label, href, icon: Icon }) => (
            <SettingsLink
              key={label}
              icon={<Icon size={19} />}
              tone="primary"
              title={label}
              onPress={() => router.push(href)}
            />
          ))}
          <SettingsLink
            icon={<Info size={19} />}
            title="About"
            onPress={() => router.push('/about')}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsLink
            icon={<LogOut size={19} />}
            danger
            title="Sign out"
            description="Sign out of Finapp on this browser"
            onPress={() => void leave()}
          />
        </SettingsGroup>
        {!!message && <Text role="status">{message}</Text>}
      </SettingsShell>
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
