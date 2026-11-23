'use client';

import React from 'react';
import { projectGroupBalances } from '@convex/splits/domain';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered, type LocalRecord } from '@/lib/offline/repository';

export type LedgerGroup = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
  icon?: string;
  color?: string;
};
export type LedgerMember = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  role?: string;
  username?: string;
  displayName?: string;
  name?: string;
  avatarId?: string;
  avatarUrl?: string | null;
  joinedAt?: number;
  deletedAt?: number;
};
export type LedgerEntry = LocalRecord & {
  groupId?: string;
  transactionId?: string;
  userId?: string;
  memberId?: string;
  ownerId?: string;
  fromUserId?: string;
  toUserId?: string;
  type?: string;
  status?: string;
  title?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  hasTime?: boolean;
  categoryId?: string;
  accountId?: string;
  method?: string;
  basisValue?: string;
  note?: string;
  deletedAt?: number;
};

export const recordAliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
export const localRecordId = (record: LocalRecord) => String(record.id ?? record._id ?? '');
export const asMinor = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? BigInt(value)
        : 0n;

/**
 * Browser view of one group's all-time ledger: loads the full range (or confirms it is cached
 * offline) and projects strict balances from local records. Mirrors the mobile hook.
 */
export function useGroupLedger(routeId: string | undefined) {
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const groups = useLocalRecords<LedgerGroup>('group');
  const members = useLocalRecords<LedgerMember>('groupMember');
  const transactions = useLocalRecords<LedgerEntry>('transaction');
  const payers = useLocalRecords<LedgerEntry>('expensePayer');
  const participants = useLocalRecords<LedgerEntry>('expenseParticipant');
  const settlements = useLocalRecords<LedgerEntry>('settlement');
  const [range, setRange] = React.useState<{
    scope: string;
    state: 'loading' | 'loaded' | 'uncached' | 'error';
    error?: string;
  }>({ scope: '', state: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const group = routeId
    ? groups.records.find((item) => recordAliases(item).includes(routeId))
    : undefined;
  const groupId = group ? localRecordId(group) : (routeId ?? '');
  const groupReady = Boolean(group);
  const groupIdentity = group ? String(group.cloudId ?? group._id ?? '') : '';
  const endAt = React.useMemo(() => Date.now() + 1, []);
  const scope = `${userId ?? ''}:${groupId}:${attempt}`;

  React.useEffect(() => {
    if (!userId || !groupReady || !groupId) return;
    let active = true;
    const done = (state: 'loaded' | 'uncached' | 'error', error?: string) => {
      if (active) setRange({ scope, state, error });
    };
    setRange({ scope, state: 'loading' });
    if (!isConnected) {
      void isGroupRangeCovered(userId, groupId, 0, endAt).then(
        (covered) =>
          done(
            covered ? 'loaded' : 'uncached',
            covered
              ? undefined
              : 'Offline. Balances are withheld because the all-time range is not cached.',
          ),
        (cause: unknown) =>
          done('error', cause instanceof Error ? cause.message : 'Range could not be checked.'),
      );
    } else {
      void fetchGroupRange(groupId, 0, endAt).then(
        () => done('loaded'),
        (cause: unknown) =>
          done(
            'error',
            cause instanceof Error ? cause.message : 'All-time balances could not be loaded.',
          ),
      );
    }
    return () => {
      active = false;
    };
  }, [endAt, fetchGroupRange, groupId, groupIdentity, groupReady, isConnected, scope, userId]);

  const recordsLoading =
    transactions.loading || payers.loading || participants.loading || settlements.loading;
  const recordsError =
    transactions.error || payers.error || participants.error || settlements.error || '';
  const rangeState = range.scope === scope ? range.state : 'loading';
  const ledger = React.useMemo(() => {
    if (!group || rangeState !== 'loaded' || recordsLoading || recordsError) return null;
    try {
      return {
        value: projectGroupBalances(
          group,
          transactions.records,
          payers.records,
          participants.records,
          settlements.records,
        ),
      };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : 'Incomplete group ledger.' };
    }
  }, [
    group,
    rangeState,
    recordsLoading,
    recordsError,
    transactions.records,
    payers.records,
    participants.records,
    settlements.records,
  ]);
  const groupIds = group ? recordAliases(group) : [];
  const groupMembers = members.records.filter(
    (member) =>
      member.deletedAt === undefined &&
      typeof member.groupId === 'string' &&
      groupIds.includes(member.groupId),
  );
  const error =
    groups.error ||
    recordsError ||
    (range.scope === scope && range.state !== 'loaded' && range.state !== 'loading'
      ? range.error
      : '') ||
    ledger?.error ||
    '';
  const balances: Record<string, bigint> | null = ledger?.value
    ? { ...ledger.value.balances }
    : null;
  if (balances)
    for (const member of groupMembers) {
      const memberId = member.userId ?? member.memberId;
      if (memberId) balances[memberId] ??= 0n;
    }
  return {
    userId,
    isConnected,
    groups: groups.records,
    groupsLoading: groups.loading,
    group,
    groupId,
    cloudGroupId: groupIdentity,
    members: groupMembers,
    allMembers: members.records,
    transactions: transactions.records,
    participants: participants.records,
    payers: payers.records,
    settlements: settlements.records,
    balances,
    expenses: (ledger?.value?.expenses ?? []) as LedgerEntry[],
    currency: group?.currency ?? 'INR',
    status: (error
      ? 'unavailable'
      : !group || rangeState === 'loading' || recordsLoading || !ledger
        ? 'loading'
        : 'ready') as 'loading' | 'ready' | 'unavailable',
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
