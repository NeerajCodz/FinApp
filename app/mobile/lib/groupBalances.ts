import { calculateNetBalances } from '../../../convex/splits/domain';
import type { LocalRecord } from '@/local/repository';
import { recordIds } from './ledger';

function belongsTo(record: LocalRecord, field: string, ids: Set<string>) {
  return typeof record[field] === 'string' && ids.has(record[field] as string);
}

export function projectGroupBalances(
  group: LocalRecord,
  members: readonly LocalRecord[],
  transactions: readonly LocalRecord[],
  payerRecords: readonly LocalRecord[],
  participantRecords: readonly LocalRecord[],
  settlementRecords: readonly LocalRecord[],
) {
  const groupIds = new Set(recordIds(group));
  const currency = group.currency;
  if (!groupIds.size || typeof currency !== 'string') throw new Error('GROUP_UNAVAILABLE');
  const eligible = transactions.filter((record) =>
    belongsTo(record, 'groupId', groupIds) && record.type === 'expense' &&
    record.status === 'posted' && record.deletedAt === undefined && record.currency === currency,
  );
  const payers: { userId: string; amountMinor: bigint }[] = [];
  const participants: { userId: string; amountMinor: bigint }[] = [];
  for (const transaction of eligible) {
    const ids = new Set(recordIds(transaction));
    const transactionPayers = payerRecords.filter((item) => belongsTo(item, 'transactionId', ids));
    const transactionParticipants = participantRecords.filter((item) => belongsTo(item, 'transactionId', ids));
    const project = (records: readonly LocalRecord[]) => records.map((record) => ({
      userId: String(record.userId ?? record.memberId ?? ''), amountMinor: record.amountMinor as bigint,
    }));
    const paid = project(transactionPayers);
    const shared = project(transactionParticipants);
    const expected = transaction.amountMinor;
    if (typeof expected !== 'bigint' || !paid.length || !shared.length ||
      [...paid, ...shared].some((item) => !item.userId || typeof item.amountMinor !== 'bigint' || item.amountMinor < 0n) ||
      paid.reduce((sum, item) => sum + item.amountMinor, 0n) !== expected ||
      shared.reduce((sum, item) => sum + item.amountMinor, 0n) !== expected)
      throw new Error('INCOMPLETE_GROUP_SPLITS');
    payers.push(...paid);
    participants.push(...shared);
  }
  const settlements = settlementRecords.filter((record) =>
    belongsTo(record, 'groupId', groupIds) && record.currency === currency && record.deletedAt === undefined,
  ).map((record) => ({
    fromUserId: String(record.fromUserId ?? ''), toUserId: String(record.toUserId ?? ''),
    amountMinor: record.amountMinor as bigint,
  }));
  if (settlements.some((item) => !item.fromUserId || !item.toUserId ||
    typeof item.amountMinor !== 'bigint' || item.amountMinor < 0n)) throw new Error('INCOMPLETE_GROUP_SETTLEMENTS');
  const balances = calculateNetBalances(payers, participants, settlements);
  const names = new Map<string, string>();
  for (const member of members) {
    if (!belongsTo(member, 'groupId', groupIds)) continue;
    const memberId = member.userId ?? member.memberId;
    if (typeof memberId !== 'string') continue;
    names.set(memberId, typeof member.displayName === 'string' ? member.displayName :
      typeof member.name === 'string' ? member.name : `Member ${memberId.slice(-6)}`);
    balances[memberId] ??= 0n;
  }
  return { currency, balances, names, expenses: eligible };
}
