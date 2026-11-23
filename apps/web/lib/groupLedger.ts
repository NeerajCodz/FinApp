'use client';

import type { ExpenseLedger } from '@finapp/ui/finance/expense-impact';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

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
  const { userId } = useBrowserSync();
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
  const ledger: ExpenseLedger | null = group
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
    loading: states.some((state) => state.loading),
    error: states.find((state) => state.error)?.error ?? undefined,
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
