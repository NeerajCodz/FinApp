import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { GroupInvitationJoinScreen } from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { isGroupInvitationOffline } from '@/lib/groupInvitationNetwork';
export default function GroupInvitationRoute() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? (params.token[0] ?? '') : (params.token ?? '');
  const validToken = /^[0-9a-f]{64}$/.test(token);
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { isConnected } = useLocalSync();
  const offline = isGroupInvitationOffline(useNetworkState());
  const preview = useQuery(
    api.groups.queries.previewInvitationLink,
    validToken && isAuthenticated ? { token } : 'skip',
  );
  const join = useMutation(api.groups.mutations.joinByInvitationLink);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState('');
  async function accept() {
    if (offline || !isConnected || !isAuthenticated || !validToken || !preview || joining) return;
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
  return (
    <GroupInvitationJoinScreen
      preview={preview}
      validToken={validToken}
      authLoading={authLoading}
      authenticated={isAuthenticated}
      offline={offline}
      connected={isConnected}
      joining={joining}
      error={error}
      onJoin={() => void accept()}
      onSignIn={() => {
        if (validToken)
          router.push({ pathname: '/(auth)/sign-in', params: { nextGroupInviteToken: token } });
      }}
    />
  );
}
