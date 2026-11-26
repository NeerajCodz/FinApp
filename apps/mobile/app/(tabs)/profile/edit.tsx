import React from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery } from 'convex/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { normalizeUsername, usernameProblem } from '@convex/users/domain';
import {
  ProfileEditScreen,
  avatarPhotoProblem,
  deviceTimezone,
  profileDraftFrom,
  profileSaveErrorText,
  resolveDefaultCurrency,
  timezoneList,
  type ProfileChanges,
  type ProfileSaveResult,
  type UsernameStatus,
} from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { upsertCloudPage, type LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Profile = LocalRecord & {
  displayName?: string;
  name?: string;
  username?: string;
  bio?: string;
  email?: string;
  phone?: string;
  gender?: 'neutral' | 'male' | 'female';
  avatarId?: string;
  avatarUrl?: string | null;
  phoneVerificationTime?: number;
  timezone?: string;
  defaultCurrency?: string;
};
type Settings = LocalRecord & { timezone?: string; currency?: string };
type PickedPhoto = { uri: string; mimeType: string };

function useUsernameStatus(saved: string | undefined, live: boolean) {
  const [typed, setTyped] = React.useState<string | null>(null);
  const [debounced, setDebounced] = React.useState<string | null>(null);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed), 350);
    return () => clearTimeout(timer);
  }, [typed]);
  const changed = (value: string | null) =>
    value !== null && normalizeUsername(value) !== normalizeUsername(saved ?? '');
  const candidate =
    debounced !== null && changed(debounced) && !usernameProblem(debounced)
      ? normalizeUsername(debounced)
      : null;
  const result = useQuery(
    api.users.queries.usernameAvailability,
    live && candidate ? { username: candidate } : 'skip',
  );
  let status: UsernameStatus = 'idle';
  if (typed !== null && changed(typed)) {
    if (!live) status = 'offline';
    else if (usernameProblem(typed)) status = 'idle';
    else if (typed !== debounced || result === undefined) status = 'checking';
    else if (result?.status === 'taken') status = 'taken';
    else if (result) status = 'available';
  }
  return { status, onChange: setTyped };
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const profileState = useLocalRecords<Profile>(userId, 'profile');
  const settingsState = useLocalRecords<Settings>(userId, 'settings');
  const profile = profileState.data?.[0];
  const settings = settingsState.data?.[0];
  const live = Boolean(userId && isConnected);
  const current = useQuery(api.users.queries.current, live ? {} : 'skip');
  const avatars = useQuery(api.avatars.queries.list, {});
  const updateUser = useMutation(api.users.mutations.update);
  const generateUploadUrl = useMutation(api.users.mutations.generateAvatarUploadUrl);
  const setUploadedAvatar = useMutation(api.users.mutations.setUploadedAvatar);
  const removeUploadedAvatar = useMutation(api.users.mutations.removeUploadedAvatar);
  const username = useUsernameStatus(profile?.username, live);
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
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as never);

  async function save(changes: ProfileChanges): Promise<ProfileSaveResult> {
    if (!userId || !profile) throw new Error('Your profile is not available yet.');
    const recordId = String(profile.id ?? profile._id ?? userId);
    const warnings: string[] = [];
    const identity = { ...changes.identity };
    if (changes.avatar?.kind === 'preset') {
      identity.avatarId = changes.avatar.avatarId;
      identity.gender = changes.avatar.gender;
    }
    if (Object.keys(identity).length > 0) {
      const next: Profile = { ...profile, ...identity };
      if (identity.phone !== undefined && identity.phone !== profile.phone)
        next.phoneVerificationTime = undefined;
      await commitLocalWrite(userId, 'profile', 'user.update', next, identity, {
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
    }
    const needsServer =
      Boolean(changes.username) ||
      changes.avatar?.kind === 'upload' ||
      changes.avatar?.kind === 'remove';
    if (needsServer && !isConnected) {
      warnings.push('Reconnect to change your username or photo.');
    } else {
      if (changes.username) {
        try {
          const saved = await updateUser({ username: changes.username });
          await upsertCloudPage(userId, 'profile', [saved as unknown as LocalRecord]);
        } catch (cause) {
          warnings.push(`Username not changed: ${profileSaveErrorText(cause)}`);
        }
      }
      try {
        let saved: unknown = null;
        if (changes.avatar?.kind === 'upload') {
          const photo = changes.avatar.file as PickedPhoto;
          const image = await (await fetch(photo.uri)).blob();
          const problem = avatarPhotoProblem({ type: photo.mimeType, size: image.size });
          if (problem) throw new Error(problem);
          const uploadUrl = await generateUploadUrl({});
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': photo.mimeType },
            body: image,
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
          saved = await removeUploadedAvatar({ avatarId: changes.avatar.avatarId });
        }
        if (saved) await upsertCloudPage(userId, 'profile', [saved as unknown as LocalRecord]);
      } catch (cause) {
        const text =
          cause instanceof Error && !/^[A-Z_]+$/.test(cause.message) && cause.message.includes(' ')
            ? cause.message
            : profileSaveErrorText(cause);
        warnings.push(`Photo not updated: ${text}`);
      }
    }
    if (warnings.length > 0) return { message: warnings.join(' '), tone: 'warning' };
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
          ? 'Your profile could not be loaded.'
          : !profileState.loading && profileState.data && !profile
            ? 'Your profile is still being set up. Try again in a moment.'
            : null
      }
      onRetry={profileState.retry}
      email={profile?.email ?? current?.email}
      emailVerified={current ? current.emailVerificationTime !== undefined : undefined}
      phoneVerified={Boolean(current?.phoneVerificationTime ?? profile?.phoneVerificationTime)}
      defaultCurrency={resolveDefaultCurrency(profileState.data ?? [], settingsState.data ?? [])}
      avatars={avatars}
      offline={!isConnected}
      usernameStatus={username.status}
      onUsernameChange={username.onChange}
      timezones={timezones}
      onPickPhoto={async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error('Allow photo access to choose a picture.');
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        const asset = result.canceled ? null : result.assets[0];
        if (!asset) return null;
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const problem = avatarPhotoProblem({ type: mimeType, size: asset.fileSize });
        if (problem) throw new Error(problem);
        return { previewUrl: asset.uri, file: { uri: asset.uri, mimeType } satisfies PickedPhoto };
      }}
      onSave={(_draft, changes) => save(changes)}
      onSaved={goBack}
      onBack={goBack}
      onOpenCurrency={() => router.push('/settings/currency' as never)}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}
