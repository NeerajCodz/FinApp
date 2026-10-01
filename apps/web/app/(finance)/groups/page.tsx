'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { projectGroupBalances } from '@convex/splits/domain';
import { formatMinor } from '@convex/shared/money';
import {
  formatTransactionDate,
  GroupsOverviewScreen,
  type GroupOverviewItem,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered, type LocalRecord } from '@/lib/offline/repository';

type GroupOverviewSummary = { currency: string; owed: string; owing: string };
type GroupOverviewActivity = {
  id: string;
  title: string;
  groupName: string;
  kind: 'expense' | 'settlement';
  amount: string;
  date: string;
};

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
  icon?: string;
  color?: string;
};
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  deletedAt?: number;
  displayName?: string;
  username?: string;
};
type LedgerRecord = LocalRecord & {
  groupId?: string;
  transactionId?: string;
  userId?: string;
  memberId?: string;
  fromUserId?: string;
  toUserId?: string;
  type?: string;
  status?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  hasTime?: boolean;
  title?: string;
  deletedAt?: number;
};
type RangeState = { status: 'loading' | 'loaded' | 'unavailable'; error?: string };
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? record.cloudId ?? '');
const asMinor = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?[0-9]+$/.test(value)
        ? BigInt(value)
        : 0n;

export default function GroupsPage() {
  const router = useRouter();
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const groupsState = useLocalRecords<Group>('group');
  const membersState = useLocalRecords<Member>('groupMember');
  const transactionsState = useLocalRecords<LedgerRecord>('transaction');
  const payersState = useLocalRecords<LedgerRecord>('expensePayer');
  const participantsState = useLocalRecords<LedgerRecord>('expenseParticipant');
  const settlementsState = useLocalRecords<LedgerRecord>('settlement');
  const { records: profiles } = useLocalRecords<LocalRecord>('profile');
  const [rangeStates, setRangeStates] = React.useState<Record<string, RangeState>>({});
  const rangeEndAt = React.useMemo(() => Date.now() + 1, []);
  const phoneVerified = Boolean(
    profiles[0]?.phone && profiles[0]?.phoneVerificationTime !== undefined,
  );
  const activeGroups = React.useMemo(
    () => groupsState.records.filter((group) => group.archivedAt === undefined),
    [groupsState.records],
  );
  React.useEffect(() => {
    if (!userId || groupsState.loading) {
      setRangeStates({});
      return;
    }
    let active = true;
    const targets = activeGroups
      .map((group) => ({ group, id: idOf(group) }))
      .filter((target) => target.id);
    setRangeStates((current) =>
      Object.fromEntries(targets.map(({ id }) => [id, current[id] ?? { status: 'loading' }])),
    );
    for (const { id } of targets) {
      void (async () => {
        try {
          const covered = await isGroupRangeCovered(userId, id, 0, rangeEndAt);
          if (!covered) {
            if (!isConnected) throw new Error('OFFLINE_GROUP_RANGE_INCOMPLETE');
            await fetchGroupRange(id, 0, rangeEndAt);
          }
          if (active) setRangeStates((current) => ({ ...current, [id]: { status: 'loaded' } }));
        } catch (cause) {
          if (active)
            setRangeStates((current) => ({
              ...current,
              [id]: {
                status: 'unavailable',
                error: cause instanceof Error ? cause.message : 'GROUP_RANGE_UNAVAILABLE',
              },
            }));
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [activeGroups, fetchGroupRange, groupsState.loading, isConnected, rangeEndAt, userId]);

  const recordsLoading =
    groupsState.loading ||
    membersState.loading ||
    transactionsState.loading ||
    payersState.loading ||
    participantsState.loading ||
    settlementsState.loading;
  const recordsError =
    groupsState.error ??
    membersState.error ??
    transactionsState.error ??
    payersState.error ??
    participantsState.error ??
    settlementsState.error;
  const balancesLoading =
    recordsLoading ||
    activeGroups.some(
      (group) => rangeStates[idOf(group)]?.status === 'loading' || !rangeStates[idOf(group)],
    );

  const { groups, summaries, activities } = React.useMemo(() => {
    const summaryByCurrency = new Map<string, { owed: bigint; owing: bigint }>();
    const overviewGroups: GroupOverviewItem[] = activeGroups.map((group) => {
      const id = idOf(group);
      const currency = typeof group.currency === 'string' ? group.currency : '';
      const groupIds = aliases(group);
      const memberCount = membersState.records.filter(
        (member) =>
          member.deletedAt === undefined &&
          typeof member.groupId === 'string' &&
          groupIds.includes(member.groupId),
      ).length;
      const status = rangeStates[id]?.status;
      let balance = status === 'loading' || !status ? 'Loading…' : 'Unavailable';
      let balanceMeaning =
        status === 'loading' || !status
          ? 'Loading complete balance'
          : 'Complete balance unavailable';
      if (
        status === 'loaded' &&
        currency &&
        !transactionsState.error &&
        !payersState.error &&
        !participantsState.error &&
        !settlementsState.error
      ) {
        try {
          const projected = projectGroupBalances(
            group,
            transactionsState.records,
            payersState.records,
            participantsState.records,
            settlementsState.records,
          );
          const net = userId ? (projected.balances[userId] ?? 0n) : 0n;
          balance = formatMinor(net < 0n ? -net : net, currency);
          balanceMeaning = net > 0n ? 'Owed to you' : net < 0n ? 'You owe' : 'Settled up';
          const totals = summaryByCurrency.get(currency) ?? { owed: 0n, owing: 0n };
          if (net > 0n) totals.owed += net;
          else if (net < 0n) totals.owing -= net;
          summaryByCurrency.set(currency, totals);
        } catch {
          balanceMeaning = 'Complete balance unavailable';
        }
      }
      return {
        id,
        name: typeof group.name === 'string' ? group.name : 'Unnamed group',
        currency,
        icon: typeof group.icon === 'string' ? group.icon : undefined,
        color: typeof group.color === 'string' ? group.color : undefined,
        memberCount,
        balance,
        balanceMeaning,
      };
    });
    const overviewComplete =
      overviewGroups.length > 0 &&
      overviewGroups.every((item) =>
        ['Owed to you', 'You owe', 'Settled up'].includes(item.balanceMeaning),
      );
    const completeGroups = overviewComplete ? activeGroups : [];
    const activityRows: GroupOverviewActivity[] = completeGroups
      .flatMap((group) => {
        const groupIds = aliases(group);
        const currency = typeof group.currency === 'string' ? group.currency : '';
        if (!currency) return [];
        const expenses = transactionsState.records.filter(
          (record) =>
            typeof record.groupId === 'string' &&
            groupIds.includes(record.groupId) &&
            record.type === 'expense' &&
            record.status === 'posted' &&
            record.deletedAt === undefined &&
            record.currency === currency,
        );
        const groupSettlements = settlementsState.records.filter(
          (record) =>
            typeof record.groupId === 'string' &&
            groupIds.includes(record.groupId) &&
            record.currency === currency &&
            record.deletedAt === undefined,
        );
        const memberName = (memberId?: string) => {
          if (memberId === userId) return 'You';
          const member = membersState.records.find(
            (candidate) =>
              candidate.userId === memberId &&
              typeof candidate.groupId === 'string' &&
              groupIds.includes(candidate.groupId),
          );
          return member?.displayName ?? (member?.username ? `@${member.username}` : 'Group member');
        };
        return [
          ...expenses.map((record) => ({
            id: `expense:${idOf(record)}`,
            title: String(record.title ?? 'Group expense'),
            groupName: String(group.name ?? 'Group'),
            kind: 'expense' as const,
            amount: formatMinor(asMinor(record.amountMinor), currency),
            occurredAt: Number(record.occurredAt ?? 0),
            date: formatTransactionDate(Number(record.occurredAt ?? 0), Boolean(record.hasTime)),
          })),
          ...groupSettlements.map((record) => ({
            id: `settlement:${idOf(record)}`,
            title: `${memberName(record.fromUserId)} paid ${memberName(record.toUserId)}`,
            groupName: String(group.name ?? 'Group'),
            kind: 'settlement' as const,
            amount: formatMinor(asMinor(record.amountMinor), currency),
            occurredAt: Number(record.occurredAt ?? 0),
            date: formatTransactionDate(Number(record.occurredAt ?? 0), Boolean(record.hasTime)),
          })),
        ];
      })
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .slice(0, 8)
      .map(({ occurredAt: _occurredAt, ...activity }) => activity);
    return {
      groups: overviewGroups,
      summaries: overviewComplete
        ? [...summaryByCurrency].map(([currency, value]): GroupOverviewSummary => ({
            currency,
            owed: formatMinor(value.owed, currency),
            owing: formatMinor(value.owing, currency),
          }))
        : [],
      activities: activityRows,
    };
  }, [
    activeGroups,
    membersState.records,
    transactionsState.records,
    transactionsState.error,
    payersState.records,
    payersState.error,
    participantsState.records,
    participantsState.error,
    settlementsState.records,
    settlementsState.error,
    rangeStates,
    userId,
  ]);

  return (
    <GroupsOverviewScreen
      groups={groups}
      summaries={summaries}
      activities={activities}
      balancesLoading={balancesLoading}
      loading={recordsLoading}
      error={recordsError ?? undefined}
      phoneVerified={phoneVerified}
      signedIn={Boolean(userId)}
      onSignIn={() => router.push('/sign-in')}
      onCreate={() => router.push('/groups/new')}
      onInvite={() => router.push('/groups/new')}
      onOpenGroup={(id) => router.push(`/group/${encodeURIComponent(id)}`)}
      onOpenChat={(id) => router.push(`/group/${encodeURIComponent(id)}/chat`)}
    />
  );
}
