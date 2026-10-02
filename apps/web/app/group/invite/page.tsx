'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { clearPendingGroupInvitation, rememberPendingGroupInvitation } from '@/lib/authRoutes';
import { GroupInvitationJoinScreen } from '@finapp/ui/finance';

function GroupInvitationContent() {
  const token = useSearchParams().get('token') ?? '';
  const validToken = /^[0-9a-f]{64}$/.test(token);
  const router = useRouter();
  const { userId } = useBrowserSync();
  const preview = useQuery(
    api.groups.queries.previewInvitationLink,
    validToken ? { token } : 'skip',
  );
  const join = useMutation(api.groups.mutations.joinByInvitationLink);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState('');
  async function accept() {
    if (!userId || !validToken || !preview || joining) return;
    setJoining(true);
    setError('');
    try {
      const groupId = await join({ token });
      if (!groupId) {
        setError('This invitation is invalid, expired, or has been revoked.');
        return;
      }
      clearPendingGroupInvitation();
      router.replace(`/group/${encodeURIComponent(String(groupId))}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join this group.');
    } finally {
      setJoining(false);
    }
  }
  return (
    <GroupInvitationJoinScreen
      preview={validToken ? (preview ?? null) : null}
      loading={validToken && preview === undefined}
      authRequired={!userId}
      joining={joining}
      error={error}
      onJoin={() => void accept()}
      onSignIn={() => {
        if (validToken) {
          rememberPendingGroupInvitation(token);
          router.push('/sign-in');
        }
      }}
    />
  );
}

export default function GroupInvitationPage() {
  return (
    <React.Suspense fallback={<main role="status">Checking invitation…</main>}>
      <GroupInvitationContent />
    </React.Suspense>
  );
}
