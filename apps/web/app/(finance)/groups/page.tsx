'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { GroupsOverviewScreen } from '@finapp/ui/finance';
import { useGroupsOverview } from '@/lib/groups/useGroupsOverview';

export default function GroupsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, isConnected, groups, summaries, activities, balancesLoading, loading, error } =
    useGroupsOverview();
  const incomingInvitations = useQuery(
    api.groups.queries.incomingInvitations,
    userId && isConnected ? {} : 'skip',
  );
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);

  return (
    <GroupsOverviewScreen
      groups={groups}
      summaries={summaries}
      activities={activities}
      balancesLoading={balancesLoading}
      loading={loading}
      error={error}
      signedIn={Boolean(userId)}
      onSignIn={() => router.push('/sign-in')}
      onCreate={() => router.push('/groups/new')}
      onOpenGroup={(id) => router.push(`/group/${encodeURIComponent(id)}`)}
      onOpenChat={(id) => router.push(`/group/${encodeURIComponent(id)}/chat`)}
      invitations={incomingInvitations}
      invitationsLoading={Boolean(userId && isConnected && incomingInvitations === undefined)}
      invitationsError={
        userId && !isConnected ? 'Connect to the internet to view invitations.' : undefined
      }
      onRespondToInvitation={async (inviteId, response) => {
        if (!isConnected)
          throw new Error('You are offline. Reconnect to respond to this invitation.');
        await respondToInvitation({ inviteId: inviteId as Id<'groupInvites'>, response });
      }}
      showInvitations={searchParams.get('invitations') === '1'}
    />
  );
}
