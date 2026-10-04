import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { GroupInvitationJoinScreen } from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
export default function GroupInvitationRoute() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? (params.token[0] ?? '') : (params.token ?? '');
  const validToken = /^[0-9a-f]{64}$/.test(token);
  const { userId, isConnected } = useLocalSync();
  const preview = useQuery(
    api.groups.queries.previewInvitationLink,
    validToken && isConnected ? { token } : 'skip',
  );
  const join = useMutation(api.groups.mutations.joinByInvitationLink);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState('');
  async function accept() {
    if (!isConnected) {
      setError('You are offline. Reconnect to verify and accept this invitation.');
      return;
    }
    if (!userId || !validToken || !preview || joining) return;
    setJoining(true);
    setError('');
    try {
      const groupId = await join({ token });
      if (!groupId) {
        setError('This invitation is invalid, expired, or has been revoked.');
        return;
      }
      router.replace(`/group/${encodeURIComponent(String(groupId))}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join this group.');
    } finally {
      setJoining(false);
    }
  }
  const busy = Boolean(validToken && isConnected) && preview === undefined;
  return (
    <GroupInvitationJoinScreen
      preview={validToken ? (preview ?? null) : null}
      loading={busy}
      authRequired={!userId}
      joining={joining}
      error={
        error || (!isConnected ? 'You are offline. Reconnect to verify and accept this invitation.' : '')
      }
      onJoin={() => void accept()}
      onSignIn={() => {
        if (validToken)
          router.push({ pathname: '/(auth)/sign-in', params: { nextGroupInviteToken: token } });
      }}
    />
  );
}
