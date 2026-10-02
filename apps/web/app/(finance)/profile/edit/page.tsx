'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { normalizeUsername, type ProfileUpdate } from '@convex/users/domain';
import {
  Avatar,
  Button,
  Card,
  IconButton,
  Input,
  Label,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, upsertCloudPage, type LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & {
  displayName?: string;
  username?: string;
  phone?: string;
  phoneVerificationTime?: number;
  avatarId?: string;
  gender?: 'neutral' | 'male' | 'female';
  avatarUrl?: string | null;
};
const usernamePattern = /^[a-z0-9_]{3,32}$/;

export default function EditProfilePage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const { tokens } = useTheme();
  const { records, loading, error } = useLocalRecords<Profile>('profile');
  const profile = records[0];
  const avatarCatalog = useQuery(api.avatars.queries.list, {});
  const updateUser = useMutation(api.users.mutations.update);
  const [displayName, setDisplayName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [gender, setGender] = React.useState<'neutral' | 'male' | 'female'>('neutral');
  const [avatarId, setAvatarId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? '');
      setUsername(profile.username ?? '');
      setPhone(profile.phone ?? '');
      setGender(profile.gender ?? 'neutral');
      setAvatarId(profile.avatarId ?? '');
    }
  }, [profile]);
  const normalizedUsername = normalizeUsername(username);
  const usernameError =
    username.trim() && !usernamePattern.test(normalizedUsername)
      ? 'Use 3–32 letters, numbers, or underscores.'
      : '';
  if (!userId)
    return (
      <FinanceSignedOut
        section="PROFILE"
        title="Your money, in your hands."
        description="Sign in to view and edit your profile."
      />
    );
  const choices = (avatarCatalog ?? []).filter((item) => item.gender === gender);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy || loading || error || !profile) {
      if (!profile && !loading) setMessage('Your profile is not available yet. Please try again.');
      return;
    }
    if (!usernamePattern.test(normalizedUsername)) {
      setMessage('Use 3–32 letters, numbers, or underscores.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const selectedAvatar = (avatarCatalog ?? []).find((item) => item.avatarId === avatarId);
      const usernameChanged = normalizedUsername !== normalizeUsername(profile.username ?? '');
      const identity: ProfileUpdate = {
        displayName: displayName.trim(),
        phone: phone.trim() || undefined,
        ...(selectedAvatar
          ? { avatarId: selectedAvatar.avatarId, gender: selectedAvatar.gender }
          : {}),
      };
      if (usernameChanged && isConnected) {
        const savedProfile = await updateUser({ username: normalizedUsername });
        await upsertCloudPage(userId, 'profile', [savedProfile as unknown as LocalRecord]);
      }
      const localUpdate = {
        ...identity,
        ...(!isConnected || !usernameChanged ? { username: normalizedUsername } : {}),
      };
      const next: Profile = {
        ...profile,
        ...localUpdate,
        username: normalizedUsername,
      };
      if (phone !== profile.phone) next.phoneVerificationTime = undefined;
      await commitLocalWrite(userId, 'profile', 'user.update', next, localUpdate, {
        recordId: String(profile.id ?? profile._id ?? userId),
      });
      setMessage(
        isConnected && usernameChanged
          ? 'Profile saved to your account.'
          : 'Saved on this device. It will sync when connected.',
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save profile changes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="finance-page">
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton
          label="Go back to profile"
          variant="ghost"
          onPress={() => router.push('/profile')}
        >
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title">Edit profile</Typography>
      </header>
      {loading && <Text role="status">Loading your profile…</Text>}
      {error && <Text role="alert">Profile could not be loaded from this browser.</Text>}
      {!loading && !error && !profile && (
        <Text role="status">Setting up your profile… Try again once it is ready.</Text>
      )}
      {profile && (
        <form className="finance-form" onSubmit={save}>
          <Card
            variant="subtle"
            style={{ display: 'grid', gap: 14, padding: 18, borderRadius: 20 }}
          >
            <Label htmlFor="profile-display-name">Display name</Label>
            <Input
              id="profile-display-name"
              aria-label="Display name"
              autoComplete="name"
              maxLength={80}
              value={displayName}
              onChangeText={setDisplayName}
              required
            />
            <Label htmlFor="profile-username">Username</Label>
            <Input
              id="profile-username"
              aria-label="Username"
              autoComplete="username"
              maxLength={64}
              value={username}
              onChangeText={setUsername}
              aria-invalid={Boolean(usernameError)}
              required
            />
            {usernameError && <Text role="alert">{usernameError}</Text>}
            <Text>3–32 letters, numbers, or underscores.</Text>
            <Label htmlFor="profile-phone">Phone number</Label>
            <Input
              id="profile-phone"
              aria-label="Phone number"
              autoComplete="tel"
              maxLength={24}
              value={phone}
              onChangeText={setPhone}
            />
            <Text>
              {profile.phone
                ? `Current number: ${profile.phone} · ${profile.phoneVerificationTime ? 'Verified' : 'Unverified'}.`
                : 'Use an international format. Contacts require a manually verified number.'}
            </Text>
          </Card>
          <Card
            variant="subtle"
            style={{ display: 'grid', gap: 14, padding: 18, borderRadius: 20 }}
          >
            <Typography variant="heading">Avatar</Typography>
            <div
              role="group"
              aria-label="Choose avatar gender"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
            >
              {(['neutral', 'male', 'female'] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={gender === value ? 'primary' : 'outline'}
                  aria-pressed={gender === value}
                  onPress={() => {
                    setGender(value);
                    const first = (avatarCatalog ?? []).find((item) => item.gender === value);
                    if (first) setAvatarId(first.avatarId);
                  }}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </Button>
              ))}
            </div>
            {!avatarCatalog && <Text role="status">Loading avatar choices…</Text>}
            <div
              role="group"
              aria-label={`${gender} avatar choices`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
                gap: 8,
              }}
            >
              {choices.map((item) => (
                <button
                  key={item.avatarId}
                  type="button"
                  aria-label={`Select avatar ${item.avatarId}`}
                  aria-pressed={avatarId === item.avatarId}
                  onClick={() => setAvatarId(item.avatarId)}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    padding: 4,
                    borderRadius: '50%',
                    border:
                      avatarId === item.avatarId
                        ? `2px solid ${tokens.primary}`
                        : '2px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar initials="" label={item.avatarId} avatarId={item.avatarId} size={48} />
                </button>
              ))}
            </div>
          </Card>
          {!!message && <Text role="status">{message}</Text>}
          <Button
            type="submit"
            disabled={
              busy || loading || Boolean(error) || !profile || Boolean(usernameError) || !avatarId
            }
          >
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      )}
    </div>
  );
}
