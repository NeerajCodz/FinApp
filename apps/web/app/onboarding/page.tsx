'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { ArrowRight } from 'lucide-react';
import { Button, Input, Label } from '@finapp/ui/web';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & { displayName?: string };

export default function OnboardingPage() {
  const auth = useConvexAuth();
  const { userId } = useBrowserSync();
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const profile = profiles[0];
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!displayName && profile?.displayName) setDisplayName(profile.displayName);
  }, [displayName, profile?.displayName]);

  async function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = displayName.trim();
    if (!userId || !auth.isAuthenticated || !normalized || saving) return;
    setSaving(true);
    setError('');
    try {
      const profileId = String(profile?.id ?? profile?._id ?? crypto.randomUUID());
      const record: LocalRecord = {
        ...(profile ?? {}),
        id: profileId,
        ownerId: userId,
        displayName: normalized,
      };
      await commitLocalWrite(
        userId,
        'profile',
        'user.update',
        record,
        { displayName: normalized },
        { recordId: profileId },
      );
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
      title="A name for your space."
      description="Choose how Finapp greets you. You can change this later."
      footer={
        <span>
          Already know your way around? <Link href="/dashboard">Go to your overview</Link>
        </span>
      }
    >
      <form onSubmit={finish} noValidate>
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
        {error && (
          <p className="auth-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={saving || !displayName.trim()} aria-busy={saving}>
          {saving ? 'Saving your space…' : 'Continue'} <ArrowRight size={16} />
        </Button>
      </form>
    </AuthFrame>
  );
}
