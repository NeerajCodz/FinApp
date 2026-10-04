import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { router } from 'expo-router';
import { formatMinor } from '@convex/shared/money';
import { formatTransactionDate } from '@finapp/ui/finance';
import { GroupsOverviewScreen, type GroupOverviewItem } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { recordId, recordIds } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';
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
  icon?: string;
  color?: string;
  archivedAt?: number;
  description?: string;
};
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  deletedAt?: number;
  displayName?: string;
  username?: string;
  name?: string;
  memberId?: string;
  avatarId?: string;
  avatarUrl?: string | null;
  role?: string;
};
type LedgerRecord = LocalRecord & {
  groupId?: string;
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
type OverviewLedger = {
  status: 'loading' | 'ready' | 'unavailable';
  balance?: bigint;
  currency?: string;
};
const asMinor = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?[0-9]+$/.test(value)
        ? BigInt(value)
        : 0n;

function GroupLedgerReporter({
  id,
  onUpdate,
}: {
  id: string;
  onUpdate: (id: string, ledger: OverviewLedger) => void;
}) {
  const state = useGroupLedger(id);
  const balance =
    state.userId && state.ledger ? (state.ledger.balances[state.userId] ?? 0n) : undefined;
  React.useEffect(() => {
    onUpdate(id, {
      status: state.error
        ? 'unavailable'
        : state.loading
          ? 'loading'
          : state.ledger
            ? 'ready'
            : 'unavailable',
      balance,
      currency: state.ledger?.currency,
    });
  }, [balance, id, onUpdate, state.error, state.ledger, state.loading]);
  return null;
}

export default function GroupsScreen() {
  const { userId, isConnected } = useLocalSync();
  const params = useLocalSearchParams<{ invitations?: string | string[] }>();
  const incomingInvitations = useQuery(
    api.groups.queries.incomingInvitations,
    userId && isConnected ? {} : 'skip',
  );
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
  const groupState = useLocalRecords<Group>(userId, 'group');
  const activeGroups = React.useMemo(
    () => (groupState.data ?? []).filter((group) => group.archivedAt === undefined),
    [groupState.data],
  );
  const memberState = useLocalRecords<Member>(userId, 'groupMember');
  const transactionState = useLocalRecords<LedgerRecord>(userId, 'transaction');
  const settlementState = useLocalRecords<LedgerRecord>(userId, 'settlement');
  const [ledgerByGroup, setLedgerByGroup] = React.useState<Record<string, OverviewLedger>>({});
  const onLedgerUpdate = React.useCallback((id: string, ledger: OverviewLedger) => {
    setLedgerByGroup((current) => {
      const previous = current[id];
      if (
        previous?.status === ledger.status &&
        previous.balance === ledger.balance &&
        previous.currency === ledger.currency
      )
        return current;
      return { ...current, [id]: ledger };
    });
  }, []);
  const groups: GroupOverviewItem[] = React.useMemo(
    () =>
      activeGroups.map((group) => {
        const groupIds = recordIds(group);
        const id = recordId(group);
        const groupMembers = (memberState.data ?? []).filter(
          (member) =>
            member.deletedAt === undefined &&
            typeof member.groupId === 'string' &&
            groupIds.includes(member.groupId),
        );
        const currentMember = groupMembers.find(
          (member) => (member.userId ?? member.memberId) === userId,
        );
        const ledger = ledgerByGroup[id];
        const currency =
          ledger?.currency ?? (typeof group.currency === 'string' ? group.currency : '');
        const balance = ledger?.balance;
        return {
          id,
          name: typeof group.name === 'string' ? group.name : 'Unnamed group',
          currency,
          icon: typeof group.icon === 'string' ? group.icon : undefined,
          color: typeof group.color === 'string' ? group.color : undefined,
          description: group.description,
          members: groupMembers.map((member) => ({
            name:
              member.displayName ??
              member.name ??
              (member.username ? `@${member.username}` : 'Group member'),
            avatarUrl: member.avatarUrl ?? undefined,
            avatarId: member.avatarId,
          })),
          role: currentMember?.role,
          memberCount: groupMembers.length,
          balance:
            ledger?.status === 'ready' && balance !== undefined && currency
              ? formatMinor(balance < 0n ? -balance : balance, currency)
              : ledger?.status === 'loading' || !ledger
                ? 'Loading…'
                : 'Unavailable',
          balanceMeaning:
            ledger?.status !== 'ready' || balance === undefined || !currency
              ? ledger?.status === 'loading' || !ledger
                ? 'Loading complete balance'
                : 'Complete balance unavailable'
              : balance > 0n
                ? 'Owed to you'
                : balance < 0n
                  ? 'You owe'
                  : 'Settled up',
        };
      }),
    [activeGroups, ledgerByGroup, memberState.data, userId],
  );
  const allLedgersReady =
    activeGroups.length > 0 &&
    activeGroups.every((group) => {
      const ledger = ledgerByGroup[recordId(group)];
      return ledger?.status === 'ready' && ledger.balance !== undefined && Boolean(ledger.currency);
    });
  const summaries: GroupOverviewSummary[] = React.useMemo(() => {
    if (!allLedgersReady) return [];
    const byCurrency = new Map<string, { owed: bigint; owing: bigint }>();
    for (const group of activeGroups) {
      const ledger = ledgerByGroup[recordId(group)];
      if (ledger?.status !== 'ready' || ledger.balance === undefined || !ledger.currency) continue;
      const total = byCurrency.get(ledger.currency) ?? { owed: 0n, owing: 0n };
      if (ledger.balance > 0n) total.owed += ledger.balance;
      else if (ledger.balance < 0n) total.owing -= ledger.balance;
      byCurrency.set(ledger.currency, total);
    }
    return [...byCurrency].map(([currency, value]) => ({
      currency,
      owed: formatMinor(value.owed, currency),
      owing: formatMinor(value.owing, currency),
    }));
  }, [allLedgersReady, activeGroups, ledgerByGroup]);
  const activities: GroupOverviewActivity[] = React.useMemo(() => {
    if (!allLedgersReady) return [];
    const rows = activeGroups.flatMap((group) => {
      const id = recordId(group);
      if (ledgerByGroup[id]?.status !== 'ready') return [];
      const groupIds = recordIds(group);
      const currency = group.currency ?? ledgerByGroup[id]?.currency ?? '';
      if (!currency) return [];
      const memberName = (memberId?: string) => {
        if (memberId === userId) return 'You';
        const member = (memberState.data ?? []).find(
          (candidate) =>
            candidate.userId === memberId &&
            typeof candidate.groupId === 'string' &&
            groupIds.includes(candidate.groupId),
        );
        return member?.displayName ?? (member?.username ? `@${member.username}` : 'Group member');
      };
      const expenses = (transactionState.data ?? []).filter(
        (record) =>
          typeof record.groupId === 'string' &&
          groupIds.includes(record.groupId) &&
          record.type === 'expense' &&
          record.status === 'posted' &&
          record.deletedAt === undefined &&
          record.currency === currency,
      );
      const settlements = (settlementState.data ?? []).filter(
        (record) =>
          typeof record.groupId === 'string' &&
          groupIds.includes(record.groupId) &&
          record.deletedAt === undefined &&
          record.currency === currency,
      );
      return [
        ...expenses.map((record) => ({
          id: `expense:${recordId(record)}`,
          title: String(record.title ?? 'Group expense'),
          groupName: String(group.name ?? 'Group'),
          kind: 'expense' as const,
          amount: formatMinor(asMinor(record.amountMinor), currency),
          date: formatTransactionDate(Number(record.occurredAt ?? 0), Boolean(record.hasTime)),
          timestamp: Number(record.occurredAt ?? 0),
        })),
        ...settlements.map((record) => ({
          id: `settlement:${recordId(record)}`,
          title: `${memberName(record.fromUserId)} paid ${memberName(record.toUserId)}`,
          groupName: String(group.name ?? 'Group'),
          kind: 'settlement' as const,
          amount: formatMinor(asMinor(record.amountMinor), currency),
          date: formatTransactionDate(Number(record.occurredAt ?? 0), Boolean(record.hasTime)),
          timestamp: Number(record.occurredAt ?? 0),
        })),
      ];
    });
    return rows
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 8)
      .map(({ timestamp: _timestamp, ...activity }) => activity);
  }, [
    allLedgersReady,
    activeGroups,
    ledgerByGroup,
    memberState.data,
    settlementState.data,
    transactionState.data,
    userId,
  ]);
  const recordsLoading =
    groupState.loading ||
    memberState.loading ||
    transactionState.loading ||
    settlementState.loading;
  const balancesLoading =
    recordsLoading ||
    groups.some(
      (group) => ledgerByGroup[group.id]?.status === 'loading' || !ledgerByGroup[group.id],
    );
  return (
    <>
      {activeGroups.map((group) => (
        <GroupLedgerReporter key={recordId(group)} id={recordId(group)} onUpdate={onLedgerUpdate} />
      ))}
      <GroupsOverviewScreen
        groups={groups}
        summaries={summaries}
        activities={activities}
        balancesLoading={balancesLoading}
        loading={recordsLoading}
        error={
          groupState.error?.message ??
          memberState.error?.message ??
          transactionState.error?.message ??
          settlementState.error?.message
        }
        onCreate={() => router.push('/groups/new' as never)}
        onOpenGroup={(id) => router.push(`/group/${encodeURIComponent(id)}` as never)}
        onOpenChat={(id) => router.push(`/group/${encodeURIComponent(id)}/chat` as never)}
        invitations={incomingInvitations}
        invitationsLoading={Boolean(userId && isConnected && incomingInvitations === undefined)}
        onRespondToInvitation={async (inviteId, response) => {
          if (!isConnected)
            throw new Error('You are offline. Reconnect to respond to this invitation.');
          await respondToInvitation({ inviteId: inviteId as Id<'groupInvites'>, response });
        }}
        invitationsError={
          userId && !isConnected ? 'Connect to the internet to view invitations.' : undefined
        }
        showInvitations={params.invitations === '1'}
      />
    </>
  );
}
