'use client';

import * as React from 'react';
import type { ExpenseLedger } from '@finapp/ui/finance/expense-impact';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered, type LocalRecord } from '@/lib/offline/repository';

export type GroupPerson = {
  userId: string;
  name: string;
  avatarId?: string;
  avatarUrl?: string | null;
  role?: string;
};

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
export const aliases = (record: LocalRecord | undefined) =>
  record
    ? [record.id, record._id, record.cloudId].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];
export const idOf = (record: LocalRecord) => aliases(record)[0] ?? '';

/**
 * Everything the expense composer, detail and impact preview need for one group, read from
 * the browser's offline store.
 */
export function useGroupLedger(groupId: string | undefined) {
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const groups = useLocalRecords('group');
  const memberships = useLocalRecords('groupMember');
  const profiles = useLocalRecords('profile');
  const transactions = useLocalRecords('transaction');
  const payers = useLocalRecords('expensePayer');
  const participants = useLocalRecords('expenseParticipant');
  const settlements = useLocalRecords('settlement');
  const accounts = useLocalRecords('account');
  const categories = useLocalRecords('category');
  const states = [
    groups,
    memberships,
    profiles,
    transactions,
    payers,
    participants,
    settlements,
    accounts,
    categories,
  ];
  const group = groupId
    ? groups.records.find((item) => aliases(item).includes(groupId))
    : undefined;
  const groupIds = aliases(group);
  const profile = profiles.records[0];
  const coverage = useAllTimeCoverage(
    userId,
    group ? idOf(group) : '',
    isConnected,
    fetchGroupRange,
  );
  const members: GroupPerson[] = [];
  for (const item of memberships.records) {
    const memberId = text(item.userId) ?? text(item.memberId);
    if (
      !memberId ||
      item.deletedAt !== undefined ||
      typeof item.groupId !== 'string' ||
      !groupIds.includes(item.groupId) ||
      members.some((member) => member.userId === memberId)
    )
      continue;
    const isMe = memberId === userId;
    members.push({
      userId: memberId,
      name:
        text(item.displayName) ??
        text(item.name) ??
        (isMe ? (text(profile?.displayName) ?? text(profile?.name)) : undefined) ??
        (text(item.username) ? `@${String(item.username)}` : `Member ${memberId.slice(-4)}`),
      avatarId: text(item.avatarId) ?? (isMe ? text(profile?.avatarId) : undefined),
      avatarUrl: text(item.avatarUrl) ?? (isMe ? (text(profile?.avatarUrl) ?? null) : null),
      role: text(item.role),
    });
  }
  if (userId && group && !members.some((member) => member.userId === userId))
    members.unshift({
      userId,
      name: text(profile?.displayName) ?? text(profile?.name) ?? 'You',
      avatarId: text(profile?.avatarId),
      avatarUrl: text(profile?.avatarUrl) ?? null,
      role: group.ownerId === userId ? 'owner' : undefined,
    });
  // Balances need every expense and settlement of the group: a ledger built from only the
  // cached sync window would show wrong balances, so it stays null until coverage is known.
  const ledger: ExpenseLedger | null =
    group && coverage.state === 'loaded'
      ? {
          group,
          transactions: transactions.records,
          payers: payers.records,
          participants: participants.records,
          settlements: settlements.records,
        }
      : null;
  return {
    userId,
    loading: states.some((state) => state.loading) || (!!group && coverage.state === 'loading'),
    error:
      states.find((state) => state.error)?.error ??
      (coverage.state === 'loaded' || coverage.state === 'loading' ? undefined : coverage.error),
    retryLedger: coverage.retry,
    groups: groups.records,
    group,
    members,
    roleOf: (id: string | null) => members.find((member) => member.userId === id)?.role,
    profile,
    transactions: transactions.records,
    payers: payers.records,
    participants: participants.records,
    accounts: accounts.records,
    categories: categories.records,
    ledger,
  };
}

/** Downloads (online) or verifies (offline) the group's all-time range. */
function useAllTimeCoverage(
  userId: string | null | undefined,
  groupId: string,
  isConnected: boolean,
  fetchGroupRange: (groupId: string, startAt: number, endAt: number) => Promise<unknown>,
) {
  const [attempt, setAttempt] = React.useState(0);
  const endAt = React.useMemo(() => Date.now() + 1, []);
  const scope = `${userId ?? ''}:${groupId}:${isConnected}:${attempt}`;
  const [result, setResult] = React.useState<{
    scope: string;
    state: 'loaded' | 'uncached' | 'error';
    error?: string;
  } | null>(null);
  React.useEffect(() => {
    if (!userId || !groupId) return;
    let active = true;
    const done = (state: 'loaded' | 'uncached' | 'error', error?: string) => {
      if (active) setResult({ scope, state, error });
    };
    if (!isConnected)
      void isGroupRangeCovered(userId, groupId, 0, endAt).then(
        (covered) =>
          done(
            covered ? 'loaded' : 'uncached',
            covered
              ? undefined
              : 'Offline. Balances are withheld because this group’s full history is not cached.',
          ),
        (cause: unknown) =>
          done('error', cause instanceof Error ? cause.message : 'History could not be checked.'),
      );
    else
      void fetchGroupRange(groupId, 0, endAt).then(
        () => done('loaded'),
        (cause: unknown) =>
          done('error', cause instanceof Error ? cause.message : 'Balances could not be loaded.'),
      );
    return () => {
      active = false;
    };
  }, [endAt, fetchGroupRange, groupId, isConnected, scope, userId]);
  const current = result?.scope === scope ? result : null;
  return {
    state: current?.state ?? ('loading' as const),
    error: current?.error,
    retry: () => setAttempt((value) => value + 1),
  };
}

/** Split rows (payers or participants) stored for one expense. */
export function rowsForExpense(rows: readonly LocalRecord[], expense: LocalRecord | undefined) {
  if (!expense) return [];
  const ids = aliases(expense);
  return rows.filter(
    (row) =>
      typeof row.transactionId === 'string' &&
      ids.includes(row.transactionId) &&
      row.deletedAt === undefined,
  );
}
