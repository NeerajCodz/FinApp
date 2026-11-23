import { projectGroupBalances as projectLedger } from '@convex/splits/domain';
import type { LocalRecord } from '@/local/repository';
import { recordIds } from './ledger';

/**
 * Mobile view of the shared strict group projection: adds display names and a zero balance
 * for every member so settled members still appear.
 */
export function projectGroupBalances(
  group: LocalRecord,
  members: readonly LocalRecord[],
  transactions: readonly LocalRecord[],
  payerRecords: readonly LocalRecord[],
  participantRecords: readonly LocalRecord[],
  settlementRecords: readonly LocalRecord[],
) {
  const { currency, balances, expenses } = projectLedger(
    group,
    transactions,
    payerRecords,
    participantRecords,
    settlementRecords,
  );
  const groupIds = new Set(recordIds(group));
  const names = new Map<string, string>();
  for (const member of members) {
    if (typeof member.groupId !== 'string' || !groupIds.has(member.groupId)) continue;
    const memberId = member.userId ?? member.memberId;
    if (typeof memberId !== 'string') continue;
    names.set(
      memberId,
      typeof member.displayName === 'string'
        ? member.displayName
        : typeof member.name === 'string'
          ? member.name
          : `Member ${memberId.slice(-6)}`,
    );
    balances[memberId] ??= 0n;
  }
  return { currency: currency as string, balances, names, expenses };
}
