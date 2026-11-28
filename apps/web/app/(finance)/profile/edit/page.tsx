'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { normalizeUsername, usernameProblem } from '@convex/users/domain';
import {
  ProfileEditScreen,
  deviceTimezone,
  profileDraftFrom,
  profileSaveErrorText,
  resolveDefaultCurrency,
  timezoneList,
  type ProfileChanges,
  type ProfileSaveResult,
  type ProfileDraft,
  type UsernameStatus,
} from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, upsertCloudPage, type LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & {
  displayName?: string;
  name?: string;
  username?: string;
  bio?: string;
  email?: string;
  phone?: string;
  phoneVerificationTime?: number;
  avatarId?: string;
  gender?: 'neutral' | 'male' | 'female';
  avatarUrl?: string | null;
  timezone?: string;
  defaultCurrency?: string;
};
type Settings = LocalRecord & { timezone?: string; currency?: string };

/** Debounces the typed username before asking the server whether it is free. */
function useUsernameStatus(saved: string | undefined, live: boolean) {
  const [typed, setTyped] = React.useState<string | null>(null);
  const [debounced, setDebounced] = React.useState<string | null>(null);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed), 350);
    return () => clearTimeout(timer);
  }, [typed]);
  const candidate =
    debounced !== null &&
    !usernameProblem(debounced) &&
    normalizeUsername(debounced) !== normalizeUsername(saved ?? '')
      ? normalizeUsername(debounced)
      : null;
  const result = useQuery(
    api.users.queries.usernameAvailability,
    live && candidate ? { username: candidate } : 'skip',
  );
  let status: UsernameStatus = 'idle';
  if (typed !== null && normalizeUsername(typed) !== normalizeUsername(saved ?? '')) {
    if (!live) status = 'offline';
    else if (usernameProblem(typed)) status = 'idle';
    else if (typed !== debounced || result === undefined) status = 'checking';
    else if (result?.status === 'taken') status = 'taken';
    else if (result?.status === 'available' || result?.status === 'current') status = 'available';
  }
  return { status, onChange: setTyped };
}

export default function EditProfilePage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const profileState = useLocalRecords<Profile>('profile');
  const settingsState = useLocalRecords<Settings>('settings');
  const profile = profileState.records[0];
  const settings = settingsState.records[0];
  const current = useQuery(api.users.queries.current, userId && isConnected ? {} : 'skip');
  const avatarCatalog = useQuery(api.avatars.queries.list, {});
  const updateUser = useMutation(api.users.mutations.update);
  const generateUploadUrl = useMutation(api.users.mutations.generateAvatarUploadUrl);
  const setUploadedAvatar = useMutation(api.users.mutations.setUploadedAvatar);
  const removeUploadedAvatar = useMutation(api.users.mutations.removeUploadedAvatar);
  const username = useUsernameStatus(profile?.username, Boolean(userId && isConnected));
  const timezones = React.useMemo(() => timezoneList(), []);
  const initial = React.useMemo(
    () =>
      profile
        ? profileDraftFrom(
            { ...profile, timezone: profile.timezone ?? settings?.timezone },
            deviceTimezone(),
          )
        : undefined,
    // The editor keeps its own draft once loaded; only the first snapshot matters.
    [Boolean(profile)],
  );

  if (!userId)
    return (
      <FinanceSignedOut
        section="PROFILE"
        title="Your money, in your hands."
        description="Sign in to view and edit your profile."
      />
    );
  const signedInUserId = userId;

  async function save(changes: ProfileChanges, draft: ProfileDraft): Promise<ProfileSaveResult> {
    if (!profile) throw new Error('Your profile is not available yet.');
    const recordId = String(profile.id ?? profile._id ?? signedInUserId);
    const warnings: string[] = [];
    const savedDraft: Partial<ProfileDraft> = {};
    const identity = { ...changes.identity };
    if (changes.avatar?.kind === 'preset') {
      identity.avatarId = changes.avatar.avatarId;
      identity.gender = changes.avatar.gender;
    }
    const needsServer =
      Boolean(changes.username || changes.avatar?.kind === 'upload') ||
      changes.avatar?.kind === 'remove';

    if (Object.keys(identity).length > 0) {
      const next: Profile = { ...profile, ...identity };
      if (identity.phone !== undefined && identity.phone !== profile.phone)
        next.phoneVerificationTime = undefined;
      await commitLocalWrite(signedInUserId, 'profile', 'user.update', next, identity, {
        recordId,
        ...(identity.timezone && settings
          ? {
              relatedRecords: [
                {
                  entityType: 'settings' as const,
                  record: { ...settings, timezone: identity.timezone },
                },
              ],
            }
          : {}),
      });
      for (const field of ['displayName', 'bio', 'phone', 'timezone'] as const)
        if (identity[field] !== undefined) savedDraft[field] = draft[field];
    }

    if (needsServer && !isConnected) {
      warnings.push('Reconnect to change your username or photo.');
    } else {
      if (changes.username) {
        try {
          const saved = await updateUser({ username: changes.username });
          await upsertCloudPage(signedInUserId, 'profile', [saved as unknown as LocalRecord]);
          savedDraft.username = draft.username;
        } catch (cause) {
          warnings.push(`Username not changed: ${profileSaveErrorText(cause)}`);
        }
      }
      try {
        let saved: unknown = null;
        if (changes.avatar?.kind === 'upload') {
          const file = changes.avatar.file as File;
          const uploadUrl = await generateUploadUrl({});
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type || 'image/jpeg' },
            body: file,
          });
          if (!response.ok) throw new Error('UPLOAD_FAILED');
          const { storageId } = (await response.json()) as { storageId: string };
          saved = await setUploadedAvatar({ storageId: storageId as Id<'_storage'> });
        } else if (changes.avatar?.kind === 'remove') {
          saved = await removeUploadedAvatar({});
        } else if (
          changes.avatar?.kind === 'preset' &&
          isConnected &&
          profile.avatarUrl &&
          !profile.avatarId
        ) {
          // Switching from an uploaded photo to a preset also deletes the stored photo.
          saved = await removeUploadedAvatar({ avatarId: changes.avatar.avatarId });
        }
        if (saved)
          await upsertCloudPage(signedInUserId, 'profile', [saved as unknown as LocalRecord]);
        if (changes.avatar) savedDraft.avatar = draft.avatar;
      } catch (cause) {
        warnings.push(`Photo not updated: ${profileSaveErrorText(cause)}`);
      }
    }

    if (warnings.length > 0) return { message: warnings.join(' '), tone: 'warning', savedDraft };
    return {
      message: isConnected
        ? 'Profile saved.'
        : 'Saved on this device. It syncs when you’re back online.',
    };
  }

  return (
    <ProfileEditScreen
      initial={initial}
      loadError={
        profileState.error
          ? 'Your profile could not be loaded from this browser.'
          : !profileState.loading && !profile
            ? 'Your profile is still being set up. Try again in a moment.'
            : null
      }
      email={profile?.email ?? current?.email}
      emailVerified={current ? current.emailVerificationTime !== undefined : undefined}
      phoneVerified={Boolean(current?.phoneVerificationTime ?? profile?.phoneVerificationTime)}
      defaultCurrency={resolveDefaultCurrency(profileState.records, settingsState.records)}
      avatars={avatarCatalog}
      offline={!isConnected}
      usernameStatus={username.status}
      onUsernameChange={username.onChange}
      timezones={timezones}
      onSave={(draft, changes) => save(changes, draft)}
      onBack={() => (window.history.length > 1 ? router.back() : router.push('/profile'))}
      onOpenCurrency={() => router.push('/settings/currency')}
    />
  );
}
