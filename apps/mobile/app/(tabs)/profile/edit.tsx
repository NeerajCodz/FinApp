import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useConvexConnectionState, useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Avatar, Button, IconButton, Input, Text, Typography, useTheme } from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeUsername } from '@convex/users/domain';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { upsertCloudPage, type LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Profile = LocalRecord & {
  displayName?: string;
  username?: string;
  phone?: string;
  gender?: 'neutral' | 'male' | 'female';
  avatarId?: string;
  avatarUrl?: string | null;
  phoneVerificationTime?: number;
};
type AvatarChoice = { avatarId: string; gender: NonNullable<Profile['gender']> };
const usernamePattern = /^[a-z0-9_]{3,32}$/;

export default function EditProfileScreen() {
  const { userId } = useLocalSync();
  const { data, loading, error: profileError, retry } = useLocalRecords<Profile>(userId, 'profile');
  const profile = data?.[0];
  const avatars = useQuery(api.avatars.queries.list, {});
  const updateUser = useMutation(api.users.mutations.update);
  const connection = useConvexConnectionState();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = React.useState<Partial<Profile>>({});
  const [initialized, setInitialized] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    if (!profile || initialized) return;
    setDraft({
      displayName: profile.displayName ?? '',
      username: profile.username ?? '',
      phone: profile.phone ?? '',
      gender: profile.gender ?? 'neutral',
      avatarId: profile.avatarId ?? '',
    });
    setInitialized(true);
  }, [profile, initialized]);
  const normalizedUsername = normalizeUsername(draft.username ?? '');
  const invalidUsername = !usernamePattern.test(normalizedUsername);
  async function save() {
    if (
      !userId ||
      !profile ||
      saving ||
      invalidUsername ||
      !String(draft.displayName ?? '').trim() ||
      !String(draft.avatarId ?? '').trim()
    )
      return;
    setSaving(true);
    setError('');
    try {
      const update = {
        displayName: (draft.displayName ?? '').trim(),
        phone: (draft.phone ?? '').trim() || undefined,
        gender: draft.gender || undefined,
        avatarId: draft.avatarId || undefined,
      };
      const usernameChanged =
        normalizedUsername !== normalizeUsername(profile.username ?? '');
      const next: Profile = { ...profile, ...update };
      const identityChanged =
        update.displayName !== profile.displayName ||
        update.phone !== profile.phone ||
        update.gender !== profile.gender ||
        update.avatarId !== profile.avatarId;
      if (update.phone !== profile.phone) next.phoneVerificationTime = undefined;
      const recordId = String(profile.id ?? profile._id ?? userId);
      if (identityChanged) {
        await commitLocalWrite(userId, 'profile', 'user.update', next, update, { recordId });
      }
      if (usernameChanged) {
        if (!connection.isWebSocketConnected) {
          setError(
            identityChanged
              ? 'Profile details saved on this device. A live Convex connection is required to change your username.'
              : 'A live Convex connection is required to change your username.',
          );
          return;
        }
        try {
          const updated = await updateUser({ ...update, username: normalizedUsername });
          await upsertCloudPage(userId, 'profile', [updated as unknown as LocalRecord]);
        } catch (cause) {
          const detail = connection.isWebSocketConnected
            ? cause instanceof Error
              ? cause.message
              : 'The server could not update your username.'
            : 'A live Convex connection is required to change your username.';
          setError(
            identityChanged
              ? `Profile details saved on this device, but the username was not changed: ${detail}`
              : `Could not change your username: ${detail}`,
          );
          return;
        }
      }
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton
          label="Go back"
          variant="ghost"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as never)
          }
        >
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Edit profile</Typography>
      </View>
      {loading && <Typography variant="small">Loading your profile…</Typography>}
      {profileError && (
        <View style={{ gap: 8 }}>
          <Typography accessibilityRole="alert">Profile could not be loaded.</Typography>
          <Button variant="outline" onPress={retry}>
            Try again
          </Button>
        </View>
      )}
      {!loading && !profileError && !profile && (
        <Typography variant="small">Your profile is not available yet.</Typography>
      )}
      {profile && (
        <View style={{ gap: 12 }}>
          <Typography variant="label">Display name</Typography>
          <Input
            accessibilityLabel="Display name"
            value={String(draft.displayName ?? '')}
            onChangeText={(value) => setDraft((current) => ({ ...current, displayName: value }))}
            placeholder="Your name"
          />
          <Typography variant="label">Username</Typography>
          <Input
            accessibilityLabel="Username"
            autoCapitalize="none"
            value={String(draft.username ?? '')}
            onChangeText={(value) => setDraft((current) => ({ ...current, username: value }))}
            editable={connection.isWebSocketConnected}
            placeholder="username"
          />
          {!connection.isWebSocketConnected && (
            <Typography variant="caption">
              Username changes require a live Convex connection.
            </Typography>
          )}
          {invalidUsername && (
            <Typography style={{ color: tokens.destructive }}>
              Use 3–32 letters, numbers, or underscores.
            </Typography>
          )}
          <Typography variant="caption">3–32 letters, numbers, or underscores.</Typography>
          <Typography variant="label">Phone number</Typography>
          <Input
            accessibilityLabel="Phone number"
            keyboardType="phone-pad"
            value={String(draft.phone ?? '')}
            onChangeText={(value) => setDraft((current) => ({ ...current, phone: value }))}
            placeholder="+1 555 0100"
          />
          <Typography variant="label">Avatar</Typography>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(avatars ?? []).map((avatar: AvatarChoice) => (
              <Button
                key={avatar.avatarId}
                size="sm"
                variant={draft.avatarId === avatar.avatarId ? 'primary' : 'outline'}
                accessibilityLabel={`Select avatar ${avatar.avatarId}`}
                accessibilityState={{ selected: draft.avatarId === avatar.avatarId }}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    avatarId: avatar.avatarId,
                    gender: avatar.gender || current.gender,
                  }))
                }
              >
                <Avatar initials="" label={avatar.avatarId} avatarId={avatar.avatarId} size={48} />
              </Button>
            ))}
          </View>
          {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
          <Button
            size="lg"
            disabled={
              !profile ||
              saving ||
              invalidUsername ||
              !String(draft.displayName ?? '').trim() ||
              !String(draft.avatarId ?? '').trim()
            }
            onPress={save}
          >
            <Text>{saving ? 'Saving…' : 'Save changes'}</Text>
          </Button>
        </View>
      )}
    </ScrollView>
  );
}
