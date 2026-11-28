'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { HubGroup, HubPerson } from '@finapp/ui/finance';
import { useGroupsOverview } from './useGroupsOverview';

/** People hub data: people (live), groups with balances (offline store) and unread counts. */
export function useHubData() {
  const overview = useGroupsOverview();
  const live = Boolean(overview.userId && overview.isConnected);
  const people = useQuery(api.social.queries.peopleHub, live ? {} : 'skip');
  const unread = useQuery(api.groups.queries.chatUnreadCounts, live ? {} : 'skip');
  const groups: HubGroup[] = overview.groups.map((group) => ({
    id: group.id,
    name: group.name,
    icon: group.icon,
    color: group.color,
    memberCount: group.memberCount,
    balanceLabel:
      group.balanceMeaning === 'Settled up'
        ? 'Settled up'
        : group.balanceMeaning === 'Owed to you'
          ? `You're owed ${group.balance}`
          : group.balanceMeaning === 'You owe'
            ? `You owe ${group.balance}`
            : undefined,
    balanceTone:
      group.balanceMeaning === 'Owed to you'
        ? 'positive'
        : group.balanceMeaning === 'You owe'
          ? 'negative'
          : 'neutral',
    unreadCount: unread && group.cloudId ? unread[group.cloudId] : undefined,
    unreadCapped: Boolean(unread && group.cloudId && unread[group.cloudId] >= 99),
  }));
  const hubPeople: HubPerson[] | undefined = live
    ? people?.people.map((person) => ({
        ...person,
        id: String(person.id),
        conversationId: person.conversationId ? String(person.conversationId) : null,
      }))
    : [];
  return {
    ...overview,
    people: hubPeople,
    peopleTruncated: people?.truncated ?? false,
    hubGroups: groups,
  };
}
