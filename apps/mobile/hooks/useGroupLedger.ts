import { useMemo } from 'react';
import { useLocalGroupRange, useLocalRecords } from './useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalRecord } from '@/local/repository';
import { recordId, recordIds } from '@/lib/ledger';
import { projectGroupBalances } from '@/lib/groupBalances';

export function useGroupLedger(id: string | undefined) {
  const { userId, fetchGroupRange } = useLocalSync();
  const groups = useLocalRecords<LocalRecord>(userId, 'group');
  const members = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const payers = useLocalRecords<LocalRecord>(userId, 'expensePayer');
  const participants = useLocalRecords<LocalRecord>(userId, 'expenseParticipant');
  const group = groups.data?.find((record) => id && recordIds(record).includes(id));
  const groupId = group ? recordId(group) : null;
  const endAt = useMemo(() => Date.now() + 1, []);
  const range = useLocalGroupRange<LocalRecord>(userId, groupId, 0, endAt, fetchGroupRange);
  const projected = useMemo(() => {
    if (
      !group ||
      !members.data ||
      !payers.data ||
      !participants.data ||
      !range.covered ||
      !range.transactions ||
      !range.settlements
    )
      return null;
    try {
      return {
        value: projectGroupBalances(
          group,
          members.data,
          range.transactions,
          payers.data,
          participants.data,
          range.settlements,
        ),
      };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('GROUP_LEDGER_UNAVAILABLE') };
    }
  }, [
    group,
    members.data,
    payers.data,
    participants.data,
    range.covered,
    range.transactions,
    range.settlements,
  ]);
  const error =
    groups.error ||
    members.error ||
    payers.error ||
    participants.error ||
    range.error ||
    projected?.error;
  return {
    group,
    members: members.data,
    ledger: projected?.value,
    error,
    loading:
      !!userId &&
      (!groups.data ||
        !members.data ||
        !payers.data ||
        !participants.data ||
        !range.covered ||
        !range.transactions ||
        !range.settlements) &&
      !error,
    refreshing: range.refreshing,
    retry: () => {
      groups.retry();
      members.retry();
      payers.retry();
      participants.retry();
      range.retry();
    },
    userId,
  };
}
