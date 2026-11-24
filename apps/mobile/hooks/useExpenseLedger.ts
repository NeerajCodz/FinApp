import type { ExpenseLedger } from '@finapp/ui/finance/expense-impact';
import type { LocalRecord } from '@/local/repository';
import { useMemo } from 'react';
import { useLocalGroupRange, useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { recordId, recordIds } from '@/lib/ledger';

export type GroupPerson = {
  userId: string;
  name: string;
  avatarId?: string;
  avatarUrl?: string | null;
  role?: string;
};

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

/**
 * Everything the expense composer, detail and impact preview need for one group, read from
 * the local (offline-first) database.
 */
export function useExpenseLedger(userId: string | null, groupId: string | undefined) {
  const groups = useLocalRecords<LocalRecord>(userId, 'group');
  const memberships = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const profiles = useLocalRecords<LocalRecord>(userId, 'profile');
  const transactions = useLocalRecords<LocalRecord>(userId, 'transaction');
  const payers = useLocalRecords<LocalRecord>(userId, 'expensePayer');
  const participants = useLocalRecords<LocalRecord>(userId, 'expenseParticipant');
  const settlements = useLocalRecords<LocalRecord>(userId, 'settlement');
  const accounts = useLocalRecords<LocalRecord>(userId, 'account');
  const categories = useLocalRecords<LocalRecord>(userId, 'category');
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
    ? groups.data?.find((item) => recordIds(item).includes(groupId))
    : undefined;
  const groupIds = group ? recordIds(group) : [];
  // The whole group history (not just the device sync window), so balances are complete.
  const { fetchGroupRange } = useLocalSync();
  const endAt = useMemo(() => Date.now() + 1, []);
  const cloudIdentity = group?.cloudId ?? group?._id;
  const fetchPage = useMemo(
    () => (cloudIdentity ? fetchGroupRange : undefined),
    [cloudIdentity, fetchGroupRange],
  );
  const range = useLocalGroupRange<LocalRecord>(
    userId,
    group ? recordId(group) : null,
    0,
    endAt,
    fetchPage,
  );
  const profile = profiles.data?.[0];
  const members: GroupPerson[] = [];
  for (const item of memberships.data ?? []) {
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
  // Balances need the group's all-time history: until that range is covered (downloading, or
  // offline without it cached) there is no ledger rather than a wrong one from a partial window.
  const ledger: ExpenseLedger | null =
    group && range.covered && range.transactions && range.settlements
      ? {
          group,
          transactions: range.transactions,
          payers: payers.data ?? [],
          participants: participants.data ?? [],
          settlements: range.settlements,
        }
      : null;
  return {
    loading: states.some((state) => state.loading) || (!!group && !range.covered && !range.error),
    error: states.find((state) => state.error)?.error ?? range.error ?? undefined,
    refreshing: range.refreshing,
    retry: () => {
      states.forEach((state) => state.retry());
      range.retry();
    },
    groups: groups.data ?? [],
    group,
    members,
    roleOf: (id: string | null) => members.find((member) => member.userId === id)?.role,
    profile,
    transactions: transactions.data ?? [],
    payers: payers.data ?? [],
    participants: participants.data ?? [],
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    ledger,
  };
}

/** Split rows (payers or participants) stored for one expense. */
export function rowsForExpense(rows: readonly LocalRecord[], expense: LocalRecord | undefined) {
  if (!expense) return [];
  const ids = recordIds(expense);
  return rows.filter(
    (row) =>
      typeof row.transactionId === 'string' &&
      ids.includes(row.transactionId) &&
      row.deletedAt === undefined,
  );
}
