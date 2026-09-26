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

type Profile = LocalRecord & {
  displayName?: string;
  username?: string;
  defaultCurrency?: string;
  timezone?: string;
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

  async function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = displayName.trim();
    const normalizedUsername = username.trim().replace(/^@+/, '');
    const normalizedTimezone = timezone.trim();
    if (!normalized || !normalizedTimezone) {
      setError('Enter your name and time zone to continue.');
      return;
    }
    if (normalizedUsername && !/^[a-z0-9_]{3,32}$/i.test(normalizedUsername)) {
      setError('Usernames must be 3–32 letters, numbers, or underscores.');
      return;
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
      router.replace('/dashboard');
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
      description="Choose how Finapp greets you and the defaults it uses. You can change these later."
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
