import React, { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { GroupsOverviewScreen, type GroupOverviewItem } from '@finapp/ui/finance';
import { useGroupRecords, type GroupMemberSummary } from '@/hooks/useGroupRecords';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { recordId, recordIds } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type GroupOverviewActivity = {
  groupName: string;
  date: string;
};
type Group = LocalRecord & {
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  cloudId?: string;
};
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  deletedAt?: number;
  displayName?: string;
  name?: string;
  username?: string;
  avatarId?: string;
  avatarUrl?: string | null;
};
type ActivityRecord = LocalRecord & {
  groupId?: string;
  title?: string;
  type?: string;
  status?: string;
  deletedAt?: number;
  occurredAt?: number;
  amountMinor?: bigint | number | string;
  fromUserId?: string;
  toUserId?: string;
};
type GroupDetail = { members?: GroupMemberSummary[] };

function timeAgo(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return 'just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

export default function GroupsScreen() {
  const { userId, isConnected } = useLocalSync();
  const params = useLocalSearchParams<{ invitations?: string | string[] }>();
  const groupsState = useGroupRecords(userId, isConnected);
  const memberState = useLocalRecords<Member>(userId, 'groupMember');
  const transactionState = useLocalRecords<ActivityRecord>(userId, 'transaction');
  const settlementState = useLocalRecords<ActivityRecord>(userId, 'settlement');
  const invitations = useQuery(
    api.groups.queries.incomingInvitations,
    userId && isConnected ? {} : 'skip',
  );
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
  const groups = (groupsState.data ?? []) as Group[];
  const overviewGroups: GroupOverviewItem[] = useMemo(
    () =>
      groups.map((group) => {
        const groupIds = recordIds(group);
        const localMembers = (memberState.data ?? []).filter(
          (member) =>
            member.deletedAt === undefined &&
            typeof member.groupId === 'string' &&
            groupIds.includes(member.groupId),
        );
        const cloudId = group.cloudId ?? (typeof group._id === 'string' ? group._id : undefined);
        const details = cloudId
          ? (groupsState.groupDetails[`detail:${cloudId}`] as GroupDetail | undefined)
          : undefined;
        const members = details?.members
          ? details.members.map((member) => ({
              name: member.displayName,
              avatarUrl: member.avatarUrl ?? undefined,
              avatarId: member.avatarId,
            }))
          : localMembers.map((member) => ({
              name:
                member.displayName ??
                member.name ??
                (member.username ? `@${member.username}` : 'Group member'),
              avatarUrl: member.avatarUrl ?? undefined,
              avatarId: member.avatarId,
            }));
        return {
          id: recordId(group),
          name: typeof group.name === 'string' ? group.name : 'Unnamed group',
          icon: typeof group.icon === 'string' ? group.icon : undefined,
          color: typeof group.color === 'string' ? group.color : undefined,
          description: typeof group.description === 'string' ? group.description : undefined,
          members,
          memberCount: details?.members?.length ?? localMembers.length,
        };
      }),
    [groupsState.groupDetails, groups, memberState.data],
  );
  const activities: GroupOverviewActivity[] = useMemo(() => {
    const byAlias = new Map<string, Group>();
    for (const group of groups) for (const alias of recordIds(group)) byAlias.set(alias, group);
    return [
      ...(transactionState.data ?? []).filter(
        (record) => record.type === 'expense' && record.status === 'posted',
      ),
      ...(settlementState.data ?? []),
    ]
      .filter(
        (record) =>
          record.deletedAt === undefined &&
          typeof record.groupId === 'string' &&
          byAlias.has(record.groupId),
      )
      .sort((left, right) => (right.occurredAt ?? 0) - (left.occurredAt ?? 0))
      .slice(0, 8)
      .map((record) => {
        const group = byAlias.get(record.groupId!)!;
        return {
          groupName: String(group.name ?? 'Group'),
          date: timeAgo(record.occurredAt ?? 0),
        };
      });
  }, [groups, settlementState.data, transactionState.data]);
  const loading =
    groupsState.loading ||
    memberState.loading ||
    transactionState.loading ||
    settlementState.loading;
  const recordsError = groupsState.error?.message ?? memberState.error?.message ?? undefined;

  return (
    <GroupsOverviewScreen
      groups={overviewGroups}
      activities={activities}
      loading={loading}
      error={overviewGroups.length ? undefined : recordsError}
      onCreate={() => router.push('/groups/new' as never)}
      onOpenGroup={(id) => router.push(`/group/${encodeURIComponent(id)}` as never)}
      invitations={invitations}
      invitationsLoading={Boolean(userId && isConnected && invitations === undefined)}
      invitationsError={
        userId && !isConnected ? 'Connect to the internet to view invitations.' : undefined
      }
      onRespondToInvitation={async (inviteId, response) => {
        if (!isConnected)
          throw new Error('You are offline. Reconnect to respond to this invitation.');
        await respondToInvitation({ inviteId: inviteId as Id<'groupInvites'>, response });
      }}
      showInvitations={params.invitations === '1'}
    />
  );
}
