'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { ArrowRight } from 'lucide-react';
import { Button, Input, Label } from '@finapp/ui/web';
import { currencies } from '@convex/shared/validators';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { normalizePhone, validateProfileUpdate } from '@convex/users/domain';

type Profile = LocalRecord & {
  displayName?: string;
  username?: string;
  defaultCurrency?: string;
  timezone?: string;
  phone?: string;
};

export default function OnboardingPage() {
  const auth = useConvexAuth();
  const { userId } = useBrowserSync();
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const profile = profiles[0];
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [defaultCurrency, setDefaultCurrency] = React.useState<(typeof currencies)[number]>('INR');
  const [timezone, setTimezone] = React.useState('UTC');
  const [phone, setPhone] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [mode, setMode] = React.useState<'personal' | 'shared'>('personal');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!displayName && profile?.displayName) setDisplayName(profile.displayName);
  }, [displayName, profile?.displayName]);
  React.useEffect(() => {
    if (!username && profile?.username) setUsername(profile.username);
  }, [profile?.username, username]);
  React.useEffect(() => {
    if (
      profile?.defaultCurrency &&
      currencies.some((currency) => currency === profile.defaultCurrency)
    )
      setDefaultCurrency(profile.defaultCurrency as (typeof currencies)[number]);
  }, [profile?.defaultCurrency]);
  React.useEffect(() => {
    setTimezone(profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, [profile?.timezone]);
  React.useEffect(() => {
    if (!phone && profile?.phone) setPhone(profile.phone);
  }, [phone, profile?.phone]);

  async function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = displayName.trim();
    const normalizedUsername = username.trim().replace(/^@+/, '');
    const normalizedTimezone = timezone.trim();
    const normalizedPhone = normalizePhone(phone);
    const normalizedAccountName = accountName.trim();
    if (!normalized || !normalizedTimezone) {
      setError('Enter your name and time zone to continue.');
      return;
    }
    if (normalizedUsername && !/^[a-z0-9_]{3,32}$/i.test(normalizedUsername)) {
      setError('Usernames must be 3–32 letters, numbers, or underscores.');
      return;
    }
    if (normalizedPhone) {
      try {
        validateProfileUpdate({ phone: normalizedPhone });
      } catch {
        setError('Enter a valid international phone number or leave it blank.');
        return;
      }
    }
    if (!userId || !auth.isAuthenticated || saving) return;
    setSaving(true);
    setError('');
    try {
      const profileId = String(profile?.id ?? profile?._id ?? crypto.randomUUID());
      const update = {
        displayName: normalized,
        defaultCurrency,
        timezone: normalizedTimezone,
        ...(normalizedUsername ? { username: normalizedUsername } : {}),
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      };
      const record: LocalRecord = {
        ...(profile ?? {}),
        id: profileId,
        ownerId: userId,
        ...update,
      };
      await commitLocalWrite(userId, 'profile', 'user.update', record, update, {
        recordId: profileId,
      });
      if (normalizedAccountName) {
        const now = Date.now();
        await commitLocalWrite(
          userId,
          'account',
          'account.create',
          {
            ownerId: userId,
            name: normalizedAccountName,
            type: 'cash',
            currency: defaultCurrency,
            openingBalanceMinor: 0n,
            balanceMinor: 0n,
            isIncludedInTotal: true,
            createdAt: now,
            updatedAt: now,
          },
          {
            name: normalizedAccountName,
            type: 'cash',
            currency: defaultCurrency,
            openingBalanceMinor: 0n,
            isIncludedInTotal: true,
          },
        );
      }
      router.replace(mode === 'shared' ? '/groups' : '/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (auth.isLoading || (auth.isAuthenticated && !userId)) {
    return (
      <AuthFrame
        eyebrow="SETTING UP YOUR SPACE"
        title="Almost there."
        description="Connecting your private workspace."
        footer={<span>Your profile stays yours.</span>}
      >
        <p role="status" aria-live="polite">
          Preparing your account…
        </p>
      </AuthFrame>
    );
  }

  if (!auth.isAuthenticated || !userId) {
    return (
      <AuthFrame
        eyebrow="ACCOUNT SETUP"
        title="Sign in to continue."
        description="Your account session is needed to finish setup."
        footer={<Link href="/sign-in">Return to sign in</Link>}
      >
        <p role="alert">This setup link is only available after verifying your account.</p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      eyebrow="MAKE IT YOURS"
      title="Set up your profile."
      description="Set your profile, optional phone and first account, and choose whether to start with shared groups."
      footer={
        <span>
          Already know your way around? <Link href="/dashboard">Go to your overview</Link>
        </span>
      }
    >
      <form onSubmit={finish} noValidate className="auth-form">
        <div className="auth-field">
          <Label htmlFor="display-name">Your name</Label>
          <Input
            id="display-name"
            autoComplete="name"
            maxLength={80}
            value={displayName}
            onChangeText={setDisplayName}
            required
          />
        </div>
        <div className="auth-field">
          <Label htmlFor="username">Username (optional)</Label>
          <Input
            id="username"
            autoComplete="username"
            maxLength={32}
            value={username}
            onChangeText={setUsername}
            placeholder="your_name"
          />
        </div>
        <div className="auth-field">
          <Label htmlFor="phone">Phone number (optional)</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={24}
            value={phone}
            onChangeText={setPhone}
            placeholder="+14155550123"
          />
        </div>
        <div className="auth-field">
          <Label htmlFor="first-account">First account (optional)</Label>
          <Input
            id="first-account"
            autoComplete="off"
            maxLength={80}
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Cash, checking, savings"
          />
        </div>
        <div className="auth-field">
          <Label htmlFor="default-currency">Default currency</Label>
          <select
            id="default-currency"
            className="finapp-input finapp-select"
            value={defaultCurrency}
            onChange={(event) =>
              setDefaultCurrency(event.currentTarget.value as (typeof currencies)[number])
            }
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>
        <div className="auth-field">
          <Label htmlFor="time-zone">Time zone</Label>
          <Input
            id="time-zone"
            maxLength={100}
            value={timezone}
            onChangeText={setTimezone}
            required
          />
        </div>
        <div className="auth-field">
          <Label htmlFor="workspace-mode">How do you want to start?</Label>
          <select
            id="workspace-mode"
            className="finapp-input finapp-select"
            value={mode}
            onChange={(event) => setMode(event.currentTarget.value as typeof mode)}
          >
            <option value="personal">Personal finances</option>
            <option value="shared">Personal + groups</option>
          </select>
        </div>
        {error && (
          <p className="auth-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={saving || !displayName.trim() || !timezone.trim()}
          aria-busy={saving}
        >
          {saving ? 'Saving your space…' : 'Continue'} <ArrowRight size={16} />
        </Button>
      </form>
    </AuthFrame>
  );
}
