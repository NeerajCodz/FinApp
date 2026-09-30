'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@convex/_generated/api';
import {
  ArrowRight,
  Bell,
  ChartNoAxesCombined,
  CircleUserRound,
  Coins,
  LogOut,
  Palette,
  Phone,
  ReceiptText,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wallet,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  IconButton,
  Input,
  Label,
  Sheet,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/web';
import { SettingsRow } from '@finapp/ui/finance';
import { currencies } from '@convex/shared/validators';
import { normalizeUsername, type ProfileUpdate } from '@convex/users/domain';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, upsertCloudPage, type LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & {
  displayName?: string;
  email?: string;
  username?: string;
  phone?: string;
  phoneVerificationTime?: number;
  defaultCurrency?: string;
  avatarId?: string;
  gender?: 'neutral' | 'male' | 'female';
  avatarUrl?: string | null;
};
type Editor = 'username' | 'phone' | null;
const usernamePattern = /^[a-z0-9_]{3,32}$/;

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
  { label: 'Export data', href: '/settings/privacy', icon: ReceiptText },
  { label: 'Privacy', href: '/settings/privacy', icon: ShieldCheck },
];

export default function ProfilePage() {
  const { signOut } = useAuthActions();
  const updateUser = useMutation(api.users.mutations.update);
  const avatarCatalog = useQuery(api.avatars.queries.list, {});
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const { tokens, appearance } = useTheme();
  const { records, loading, error } = useLocalRecords<Profile>('profile');
  const profile = records[0];
  const [editor, setEditor] = React.useState<Editor>(null);
  const [draft, setDraft] = React.useState('');
  const [currencyOpen, setCurrencyOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const normalizedUsername = normalizeUsername(draft);
  const usernameError =
    editor === 'username' && draft.trim().length > 0 && !usernamePattern.test(normalizedUsername)
      ? 'Use 3–32 letters, numbers, or underscores.'
      : '';
  if (!userId)
    return (
      <FinanceSignedOut
        section="PROFILE"
        title="Your money, in your hands."
        description="Sign in to view your profile and edit the details used across your private ledger."
      />
    );

  async function save(update: ProfileUpdate) {
    if (!userId) throw new Error('AUTH_REQUIRED');
    const current: Profile = profile ?? { id: userId, displayName: 'Your profile' };
    if (update.username !== undefined && isConnected) {
      const savedProfile = await updateUser({ username: update.username });
      await upsertCloudPage(userId, 'profile', [savedProfile as unknown as LocalRecord]);
      return;
    }
    const next = { ...current, ...update };
    if (update.phone !== undefined && update.phone !== profile?.phone)
      next.phoneVerificationTime = undefined;
    await commitLocalWrite(userId, 'profile', 'user.update', next, update, {
      recordId: String(current.id ?? current._id ?? userId),
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const update: ProfileUpdate =
        editor === 'username' ? { username: normalizedUsername } : { phone: draft };
      if (editor === 'username' && !usernamePattern.test(normalizedUsername)) return;
      await save(update);
      setEditor(null);
      setMessage(
        update.username !== undefined && isConnected
          ? 'Username saved to your account.'
          : 'Saved on this device. It will sync when connected.',
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save profile changes.');
    } finally {
      setBusy(false);
    }
  }

  function openEditor(value: Exclude<Editor, null>) {
    setMessage('');
    setEditor(value);
    setDraft(value === 'username' ? (profile?.username ?? '') : (profile?.phone ?? ''));
  }
  async function changeCurrency(value: string) {
    setMessage('');
    try {
      await save({ defaultCurrency: value });
      setCurrencyOpen(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save currency.');
    }
  }
  async function selectAvatar(avatarId: string, gender: 'neutral' | 'male' | 'female') {
    if (!userId || busy) return;
    const avatar = (avatarCatalog ?? []).find((entry) => entry.avatarId === avatarId);
    if (!avatar) return;
    setBusy(true);
    setMessage('');
    try {
      const update = { avatarId, gender };
      const current: Profile = profile ?? { id: userId, displayName: 'Your profile' };
      await commitLocalWrite(
        userId,
        'profile',
        'user.update',
        { ...current, ...update, avatarUrl: avatar.url },
        update,
        { recordId: String(current.id ?? current._id ?? userId) },
      );
      setMessage('Avatar saved.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save avatar.');
    } finally {
      setBusy(false);
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
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingTop: 16,
              borderTop: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'grid',
                width: 42,
                height: 42,
                flex: '0 0 42px',
                placeItems: 'center',
                borderRadius: 13,
                background: tokens.controlDisabledBackground,
              }}
            >
              <UsersRound size={20} color={tokens.primary} />
            </span>
            <span style={{ display: 'grid', flex: 1, gap: 2 }}>
              <Typography variant="caption">YOUR SHARE TAG</Typography>
              <Typography
                variant="bodyLarge"
                style={{ color: profile?.username ? tokens.primary : tokens.foreground }}
              >
                {profile?.username ? `@${profile.username}` : 'Set username'}
              </Typography>
            </span>
            <Button
              size="sm"
              variant="outline"
              onPress={() => openEditor('username')}
              style={{ width: 82 }}
            >
              Edit
            </Button>
          </div>
        </Card>
        <Card variant="subtle" style={{ display: 'grid', gap: 16, padding: 18, borderRadius: 20 }}>
          <div>
            <Typography variant="heading">Your avatar</Typography>
            <Text>Choose how you appear in groups and shared activity.</Text>
          </div>
          <div role="group" aria-label="Choose gender" style={{ display: 'flex', gap: 8 }}>
            {(['neutral', 'male', 'female'] as const).map((gender) => (
              <Button
                key={gender}
                variant={(profile?.gender ?? 'neutral') === gender ? 'primary' : 'outline'}
                aria-pressed={(profile?.gender ?? 'neutral') === gender}
                disabled={busy || !avatarCatalog}
                onPress={() => {
                  const first = (avatarCatalog ?? []).find((entry) => entry.gender === gender);
                  if (first) void selectAvatar(first.avatarId, gender);
                }}
              >
                {gender[0].toUpperCase() + gender.slice(1)}
              </Button>
            ))}
          </div>
          <div
            role="group"
            aria-label={`${profile?.gender ?? 'neutral'} avatar choices`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(54px, 1fr))',
              gap: 8,
              maxHeight: 246,
              overflowY: 'auto',
            }}
          >
            {(avatarCatalog ?? [])
              .filter((entry) => entry.gender === (profile?.gender ?? 'neutral'))
              .map((entry) => (
                <button
                  key={entry.avatarId}
                  type="button"
                  aria-label={`Select avatar ${entry.avatarId}`}
                  aria-pressed={profile?.avatarId === entry.avatarId}
                  disabled={busy}
                  onClick={() => void selectAvatar(entry.avatarId, entry.gender)}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    padding: 3,
                    borderRadius: '50%',
                    border:
                      profile?.avatarId === entry.avatarId
                        ? `2px solid ${tokens.primary}`
                        : '2px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar initials="" label={entry.avatarId} imageUrl={entry.url} size={46} />
                </button>
              ))}
          </div>
        </Card>

        {(loading || error) && (
          <div style={{ display: 'grid', gap: 10 }}>
            {loading && <Text role="status">Loading your local profile…</Text>}
            {error && (
              <>
                <Text role="alert">Profile could not be loaded from this browser.</Text>
                <Button variant="outline" onPress={() => window.location.reload()}>
                  Reload profile
                </Button>
              </>
            )}
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
            leadingIcon={<CircleUserRound size={19} color={tokens.foreground} />}
            label="Username"
            value={profile?.username ? `@${profile.username}` : 'Set username'}
            onPress={() => openEditor('username')}
          />
          <SettingsRow
            leadingIcon={<Phone size={19} color={tokens.foreground} />}
            label="Phone number"
            value={
              profile?.phone
                ? profile.phoneVerificationTime
                  ? 'Verified'
                  : 'Unverified'
                : 'Add phone number'
            }
            onPress={() => openEditor('phone')}
          />
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

        {!editor && !!message && <Text role="status">{message}</Text>}
        <Button variant="destructive" size="lg" onPress={() => void leave()}>
          <LogOut size={16} aria-hidden="true" /> Sign out
          <ArrowRight size={18} aria-hidden="true" style={{ marginLeft: 'auto' }} />
        </Button>
      </div>

      <Sheet
        visible={editor !== null}
        onClose={() => setEditor(null)}
        title={editor === 'username' ? 'Edit username' : 'Add phone number'}
      >
        <form className="finance-form" onSubmit={submit}>
          <Label>{editor === 'username' ? 'Username' : 'Phone number'}</Label>
          <Input
            autoFocus
            autoComplete={editor === 'username' ? 'username' : 'tel'}
            aria-label={editor === 'username' ? 'Username' : 'Phone number'}
            aria-invalid={Boolean(usernameError)}
            onChangeText={(value) => {
              setDraft(value);
              setMessage('');
            }}
            maxLength={editor === 'username' ? 64 : 24}
            placeholder={editor === 'username' ? '@neeraj' : '+91 98765 43210'}
            required
            value={draft}
          />
          {!!usernameError && <Text role="alert">{usernameError}</Text>}
          <Text>
            {editor === 'username'
              ? '3–32 letters, numbers, or underscores.'
              : profile?.phone
                ? `Current number: ${profile.phone} · ${profile.phoneVerificationTime ? 'Verified' : 'Unverified'}. Contacts require a manually verified number.`
                : 'Use an international format. Contacts require a manually verified number.'}
          </Text>
          {!!message && <Text role="alert">{message}</Text>}
          <Button type="submit" disabled={busy || !draft.trim()}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </Sheet>

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
