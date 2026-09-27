import { allocateSplit, type SplitMethod } from '../shared/money';
import { DomainError } from '../shared/errors';

export type ParticipantAmount = { userId: string; amountMinor: bigint };
export type SplitLedger = {
  payers: ParticipantAmount[];
  participants: ParticipantAmount[];
  totalMinor: bigint;
  version: number;
};

function sum(items: readonly ParticipantAmount[]): bigint {
  return items.reduce((total, item) => total + item.amountMinor, 0n);
}

export function createSplit(
  totalMinor: bigint,
  payers: readonly ParticipantAmount[],
  participants: readonly ParticipantAmount[],
  version = 1,
): SplitLedger {
  if (
    totalMinor <= 0n ||
    payers.length === 0 ||
    participants.length === 0 ||
    payers.some((item) => item.amountMinor < 0n) ||
    participants.some((item) => item.amountMinor < 0n) ||
    sum(payers) !== totalMinor ||
    sum(participants) !== totalMinor
  )
    throw new DomainError('INVALID_SPLIT');
  const users = new Set([...payers, ...participants].map((item) => item.userId));
  if (users.size !== payers.length + participants.length && [...users].some((userId) => !userId))
    throw new DomainError('INVALID_SPLIT');
  return { payers: [...payers], participants: [...participants], totalMinor, version };
}

export function allocateParticipants(
  totalMinor: bigint,
  userIds: readonly string[],
  method: SplitMethod,
  values?: readonly (bigint | number)[],
): ParticipantAmount[] {
  return Object.entries(allocateSplit(totalMinor, userIds, { method, values })).map(
    ([userId, amountMinor]) => ({ userId, amountMinor }),
  );
}

export function assertSplitVersion(expectedVersion: number, currentVersion: number): void {
  if (expectedVersion !== currentVersion) throw new DomainError('TRANSACTION_CHANGED');
}

export function calculateNetBalances(
  payers: readonly ParticipantAmount[],
  participants: readonly ParticipantAmount[],
  settlements: readonly { fromUserId: string; toUserId: string; amountMinor: bigint }[],
): Record<string, bigint> {
  const balances: Record<string, bigint> = {};
  for (const item of payers)
    balances[item.userId] = (balances[item.userId] ?? 0n) + item.amountMinor;
  for (const item of participants)
    balances[item.userId] = (balances[item.userId] ?? 0n) - item.amountMinor;
  for (const settlement of settlements) {
    balances[settlement.fromUserId] =
      (balances[settlement.fromUserId] ?? 0n) + settlement.amountMinor;
    balances[settlement.toUserId] = (balances[settlement.toUserId] ?? 0n) - settlement.amountMinor;
  }
  return balances;
}
type GroupLedgerRecord = Record<string, unknown> & {
  id?: string;
  _id?: string;
  cloudId?: string;
};
type ParticipantAmountCandidate = { userId: string; amountMinor: unknown };
type SettlementAmount = { fromUserId: string; toUserId: string; amountMinor: bigint };
type SettlementAmountCandidate = Omit<SettlementAmount, 'amountMinor'> & { amountMinor: unknown };

function groupRecordIds(record: GroupLedgerRecord): Set<string> {
  return new Set(
    [record.id, record._id, record.cloudId].filter(
      (value): value is string => typeof value === 'string',
    ),
  );
}

function belongsToGroup(record: GroupLedgerRecord, field: string, ids: Set<string>): boolean {
  const value = record[field];
  return typeof value === 'string' && ids.has(value);
}

function isParticipantAmount(item: ParticipantAmountCandidate): item is ParticipantAmount {
  return Boolean(item.userId) && typeof item.amountMinor === 'bigint' && item.amountMinor >= 0n;
}

function isSettlementAmount(item: SettlementAmountCandidate): item is SettlementAmount {
  return (
    Boolean(item.fromUserId) &&
    Boolean(item.toUserId) &&
    typeof item.amountMinor === 'bigint' &&
    item.amountMinor >= 0n
  );
}

export function projectGroupBalances(
  group: GroupLedgerRecord,
  transactions: readonly GroupLedgerRecord[],
  payerRecords: readonly GroupLedgerRecord[],
  participantRecords: readonly GroupLedgerRecord[],
  settlementRecords: readonly GroupLedgerRecord[],
) {
  const groupIds = groupRecordIds(group);
  const currency = group.currency;
  if (!groupIds.size || typeof currency !== 'string') throw new Error('GROUP_UNAVAILABLE');
  const expenses = transactions.filter(
    (record) =>
      belongsToGroup(record, 'groupId', groupIds) &&
      record.type === 'expense' &&
      record.status === 'posted' &&
      record.deletedAt === undefined &&
      record.currency === currency,
  );
  const payers: ParticipantAmount[] = [];
  const participants: ParticipantAmount[] = [];
  for (const transaction of expenses) {
    const transactionIds = groupRecordIds(transaction);
    const paidRows = payerRecords.filter((record) =>
      belongsToGroup(record, 'transactionId', transactionIds),
    );
    const sharedRows = participantRecords.filter((record) =>
      belongsToGroup(record, 'transactionId', transactionIds),
    );
    const paidCandidates = paidRows.map((record) => ({
      userId: String(record.userId ?? record.memberId ?? ''),
      amountMinor: record.amountMinor,
    }));
    const sharedCandidates = sharedRows.map((record) => ({
      userId: String(record.userId ?? record.memberId ?? ''),
      amountMinor: record.amountMinor,
    }));
    const paid = paidCandidates.filter(isParticipantAmount);
    const shared = sharedCandidates.filter(isParticipantAmount);
    const expected = transaction.amountMinor;
    if (
      typeof expected !== 'bigint' ||
      paid.length !== paidCandidates.length ||
      shared.length !== sharedCandidates.length ||
      !paid.length ||
      !shared.length ||
      sum(paid) !== expected ||
      sum(shared) !== expected
    )
      throw new Error('INCOMPLETE_GROUP_SPLITS');
    payers.push(...paid);
    participants.push(...shared);
  }
  const settlementCandidates = settlementRecords
    .filter(
      (record) =>
        belongsToGroup(record, 'groupId', groupIds) &&
        record.currency === currency &&
        record.deletedAt === undefined,
    )
    .map((record) => ({
      fromUserId: String(record.fromUserId ?? ''),
      toUserId: String(record.toUserId ?? ''),
      amountMinor: record.amountMinor,
    }));
  const settlements = settlementCandidates.filter(isSettlementAmount);
  if (settlements.length !== settlementCandidates.length)
    throw new Error('INCOMPLETE_GROUP_SETTLEMENTS');
  return { currency, balances: calculateNetBalances(payers, participants, settlements), expenses };
}

function recordList(value: unknown): GroupLedgerRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (record): record is GroupLedgerRecord =>
          typeof record === 'object' && record !== null && !Array.isArray(record),
      )
    : [];
}

function minorAmount(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

export function calculateBilateralBalance(
  currentUserId: string,
  personId: string,
  groups: readonly GroupLedgerRecord[],
  transactions: readonly GroupLedgerRecord[],
  payerRecords: readonly GroupLedgerRecord[],
  participantRecords: readonly GroupLedgerRecord[],
  settlementRecords: readonly GroupLedgerRecord[],
): bigint {
  const groupIds = new Set(groups.flatMap((group) => [...groupRecordIds(group)]));
  let balance = 0n;
  const expenses = transactions.filter(
    (transaction) =>
      belongsToGroup(transaction, 'groupId', groupIds) &&
      transaction.type === 'expense' &&
      transaction.status === 'posted' &&
      transaction.deletedAt === undefined,
  );
  for (const expense of expenses) {
    const transactionIds = groupRecordIds(expense);
    const payerRows = payerRecords.filter((record) =>
      belongsToGroup(record, 'transactionId', transactionIds),
    );
    const participantRows = participantRecords.filter((record) =>
      belongsToGroup(record, 'transactionId', transactionIds),
    );
    const payers = payerRows.length
      ? payerRows
      : expense.payerUserId
        ? [
            {
              userId: expense.payerUserId,
              amountMinor: expense.payerAmountMinor ?? expense.amountMinor,
            },
          ]
        : [];
    const participants = participantRows.length
      ? participantRows
      : recordList(expense.participants);
    for (const payer of payers) {
      const payerId = String(payer.userId ?? payer.memberId ?? '');
      for (const participant of participants) {
        const participantId = String(participant.userId ?? participant.memberId ?? '');
        const amount = minorAmount(participant.amountMinor);
        if (payerId === currentUserId && participantId === personId) balance += amount;
        else if (payerId === personId && participantId === currentUserId) balance -= amount;
      }
    }
  }
  for (const settlement of settlementRecords) {
    if (!belongsToGroup(settlement, 'groupId', groupIds) || settlement.deletedAt !== undefined)
      continue;
    if (settlement.fromUserId === currentUserId && settlement.toUserId === personId)
      balance += minorAmount(settlement.amountMinor);
    else if (settlement.fromUserId === personId && settlement.toUserId === currentUserId)
      balance -= minorAmount(settlement.amountMinor);
  }
  return balance;
}
