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
  // A user may both pay and participate, but must not appear twice on either side.
  const unique = (items: readonly ParticipantAmount[]) =>
    items.every((item) => item.userId) &&
    new Set(items.map((item) => item.userId)).size === items.length;
  if (!unique(payers) || !unique(participants)) throw new DomainError('INVALID_SPLIT');
  return { payers: [...payers], participants: [...participants], totalMinor, version };
}

/**
 * Allocates a total across participants. Leftover minor units are assigned in a stable
 * user-id order, so the result never depends on the order people were selected in.
 * The returned rows follow the input order.
 */
export function allocateParticipants(
  totalMinor: bigint,
  userIds: readonly string[],
  method: SplitMethod,
  values?: readonly (bigint | number)[],
): ParticipantAmount[] {
  const order = userIds
    .map((_, index) => index)
    .sort((left, right) => (userIds[left]! < userIds[right]! ? -1 : 1));
  const allocated = allocateSplit(
    totalMinor,
    order.map((index) => userIds[index]!),
    { method, values: values ? order.map((index) => values[index]!) : undefined },
  );
  return userIds.map((userId) => ({ userId, amountMinor: allocated[userId]! }));
}

function allocateInSelectionOrder(
  totalMinor: bigint,
  userIds: readonly string[],
  method: SplitMethod,
  values?: readonly (bigint | number)[],
): ParticipantAmount[] {
  const allocated = allocateSplit(totalMinor, userIds, { method, values });
  return userIds.map((userId) => ({ userId, amountMinor: allocated[userId]! }));
}

/**
 * Validates client-computed participant amounts. Accepts the deterministic allocation and
 * the legacy selection-order one, so mutations queued offline by older clients still apply.
 */
export function matchesAllocation(
  totalMinor: bigint,
  rows: readonly { userId: string; amountMinor: bigint }[],
  method: SplitMethod,
  values?: readonly (bigint | number)[],
): boolean {
  const userIds = rows.map((row) => row.userId);
  const same = (allocation: ParticipantAmount[]) =>
    allocation.every((item, index) => item.amountMinor === rows[index]?.amountMinor);
  try {
    return (
      same(allocateParticipants(totalMinor, userIds, method, values)) ||
      same(allocateInSelectionOrder(totalMinor, userIds, method, values))
    );
  } catch {
    return false;
  }
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

function toMinorUnits(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

function participantAmount(item: ParticipantAmountCandidate): ParticipantAmount | null {
  const amountMinor = toMinorUnits(item.amountMinor);
  return item.userId && amountMinor !== null && amountMinor >= 0n
    ? { userId: item.userId, amountMinor }
    : null;
}

function settlementAmount(item: SettlementAmountCandidate): SettlementAmount | null {
  const amountMinor = toMinorUnits(item.amountMinor);
  return item.fromUserId && item.toUserId && amountMinor !== null && amountMinor >= 0n
    ? { fromUserId: item.fromUserId, toUserId: item.toUserId, amountMinor }
    : null;
}

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
    const paidCandidates = paidRows.map((record) =>
      participantAmount({
        userId: String(record.userId ?? record.memberId ?? ''),
        amountMinor: record.amountMinor,
      }),
    );
    const sharedCandidates = sharedRows.map((record) =>
      participantAmount({
        userId: String(record.userId ?? record.memberId ?? ''),
        amountMinor: record.amountMinor,
      }),
    );
    const paid = paidCandidates.filter((item): item is ParticipantAmount => item !== null);
    const shared = sharedCandidates.filter((item): item is ParticipantAmount => item !== null);
    const expected = toMinorUnits(transaction.amountMinor);
    if (
      expected === null ||
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
    .map((record) =>
      settlementAmount({
        fromUserId: String(record.fromUserId ?? ''),
        toUserId: String(record.toUserId ?? ''),
        amountMinor: record.amountMinor,
      }),
    );
  const settlements = settlementCandidates.filter(
    (item): item is SettlementAmount => item !== null,
  );
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

/**
 * Net amount `personId` owes `currentUserId` across shared groups (negative: you owe them).
 *
 * Within an expense, each participant owes every payer in proportion to what that payer
 * covered, so multi-payer expenses are not double counted. When `currency` is given, only
 * groups and records in that currency are included, so amounts are never mixed.
 */
export function calculateBilateralBalance(
  currentUserId: string,
  personId: string,
  groups: readonly GroupLedgerRecord[],
  transactions: readonly GroupLedgerRecord[],
  payerRecords: readonly GroupLedgerRecord[],
  participantRecords: readonly GroupLedgerRecord[],
  settlementRecords: readonly GroupLedgerRecord[],
  currency?: string,
): bigint {
  const inCurrency = (record: GroupLedgerRecord) =>
    currency === undefined || record.currency === undefined || record.currency === currency;
  const groupIds = new Set(
    groups.filter(inCurrency).flatMap((group) => [...groupRecordIds(group)]),
  );
  let balance = 0n;
  const expenses = transactions.filter(
    (transaction) =>
      belongsToGroup(transaction, 'groupId', groupIds) &&
      transaction.type === 'expense' &&
      transaction.status === 'posted' &&
      transaction.deletedAt === undefined &&
      inCurrency(transaction),
  );
  const userOf = (row: Record<string, unknown>) => String(row.userId ?? row.memberId ?? '');
  for (const expense of expenses) {
    const transactionIds = groupRecordIds(expense);
    const payerRows = payerRecords.filter((record) =>
      belongsToGroup(record, 'transactionId', transactionIds),
    );
    const participantRows = participantRecords.filter((record) =>
      belongsToGroup(record, 'transactionId', transactionIds),
    );
    const payers: Record<string, unknown>[] = payerRows.length
      ? payerRows
      : expense.payerUserId
        ? [
            {
              userId: expense.payerUserId,
              amountMinor: expense.payerAmountMinor ?? expense.amountMinor,
            },
          ]
        : [];
    const participants: Record<string, unknown>[] = participantRows.length
      ? participantRows
      : recordList(expense.participants);
    const amountFor = (rows: Record<string, unknown>[], userId: string) =>
      rows
        .filter((row) => userOf(row) === userId)
        .reduce((total, row) => total + minorAmount(row.amountMinor), 0n);
    const totalPaid = payers.reduce((total, row) => total + minorAmount(row.amountMinor), 0n);
    if (totalPaid <= 0n) continue;
    // person's share funded by me, minus my share funded by person.
    const numerator =
      amountFor(participants, personId) * amountFor(payers, currentUserId) -
      amountFor(participants, currentUserId) * amountFor(payers, personId);
    balance += numerator / totalPaid;
  }
  for (const settlement of settlementRecords) {
    if (
      !belongsToGroup(settlement, 'groupId', groupIds) ||
      settlement.deletedAt !== undefined ||
      !inCurrency(settlement)
    )
      continue;
    if (settlement.fromUserId === currentUserId && settlement.toUserId === personId)
      balance += minorAmount(settlement.amountMinor);
    else if (settlement.fromUserId === personId && settlement.toUserId === currentUserId)
      balance -= minorAmount(settlement.amountMinor);
  }
  return balance;
}

export type BalanceMap = Record<string, bigint>;

/** Non-zero per-member balance changes between two projections. */
export function balanceDeltas(before: BalanceMap, after: BalanceMap): BalanceMap {
  const deltas: BalanceMap = {};
  for (const userId of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const delta = (after[userId] ?? 0n) - (before[userId] ?? 0n);
    if (delta !== 0n) deltas[userId] = delta;
  }
  return deltas;
}

export type SettledImpact = {
  userId: string;
  before: bigint;
  after: bigint;
  /** The member had settled up and the edit now leaves them owed money back. */
  credit: boolean;
};

/**
 * Members whose balance an edit changes after they already recorded a settlement in the
 * group. Settlements stay as real payments, so a lowered share becomes a credit.
 */
export function settledImpact(
  before: BalanceMap,
  after: BalanceMap,
  settledUserIds: Iterable<string>,
): SettledImpact[] {
  const deltas = balanceDeltas(before, after);
  return [...new Set(settledUserIds)]
    .filter((userId) => deltas[userId] !== undefined)
    .sort()
    .map((userId) => {
      const previous = before[userId] ?? 0n;
      const next = after[userId] ?? 0n;
      return { userId, before: previous, after: next, credit: next > 0n && previous <= 0n };
    });
}

/** Serializes balances for storage, e.g. in ledger events. */
export function serializeBalances(balances: BalanceMap): Record<string, string> {
  return Object.fromEntries(Object.entries(balances).map(([key, value]) => [key, String(value)]));
}
