import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { HubGroup, HubPerson } from '@finapp/ui/finance';
import { useGroupRecords, type GroupMemberSummary } from '@/hooks/useGroupRecords';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { recordId, recordIds } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Member = LocalRecord & { groupId?: string; deletedAt?: number };

/** People hub data: people (live), your groups and unread chat counts. */
export function useHubData() {
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const groupsState = useGroupRecords(userId, isConnected);
  const memberState = useLocalRecords<Member>(userId, 'groupMember');
  const people = useQuery(api.social.queries.peopleHub, live ? {} : 'skip');
  const unread = useQuery(api.groups.queries.chatUnreadCounts, live ? {} : 'skip');
  const groups = useMemo<HubGroup[]>(
    () =>
      (groupsState.data ?? []).map((group) => {
        const ids = recordIds(group);
        const cloudId =
          typeof group.cloudId === 'string'
            ? group.cloudId
            : typeof group._id === 'string'
              ? group._id
              : undefined;
        const details = cloudId
          ? (groupsState.groupDetails[`detail:${cloudId}`] as
              { members?: GroupMemberSummary[] } | undefined)
          : undefined;
        const localCount = (memberState.data ?? []).filter(
          (member) =>
            member.deletedAt === undefined &&
            typeof member.groupId === 'string' &&
            ids.includes(member.groupId),
        ).length;
        return {
          id: recordId(group),
          name: typeof group.name === 'string' ? group.name : 'Unnamed group',
          icon: typeof group.icon === 'string' ? group.icon : undefined,
          color: typeof group.color === 'string' ? group.color : undefined,
          memberCount: details?.members?.length ?? localCount,
          unreadCount: unread && cloudId ? unread[cloudId] : undefined,
          unreadCapped: Boolean(unread && cloudId && (unread[cloudId] ?? 0) >= 99),
        };
      }),
    [groupsState.data, groupsState.groupDetails, memberState.data, unread],
  );
  const hubPeople = useMemo<HubPerson[] | undefined>(
    () =>
      live
        ? people?.people.map((person) => ({
            ...person,
            id: String(person.id),
            conversationId: person.conversationId ? String(person.conversationId) : null,
          }))
        : [],
    [live, people],
  );
  return {
    userId,
    isConnected,
    people: hubPeople,
    peopleTruncated: people?.truncated ?? false,
    groups,
    loading: groupsState.loading,
  };
}
