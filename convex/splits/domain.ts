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

/** Methods stored on expense participant rows: the allocation methods plus `itemized`. */
export type ParticipantSplitMethod = Exclude<SplitMethod, 'adjustment'> | 'itemized';

/** A line item embedded on a transaction. `amountMinor` is the line total. */
export type LineItem = {
  id: string;
  title: string;
  amountMinor: bigint;
  quantity?: number;
  /** Who shares this item in an itemized group split; absent/empty means everyone. */
  participantIds?: readonly string[];
};

export const MAX_LINE_ITEMS = 100;
export const MAX_LINE_ITEM_TITLE = 80;
const MAX_LINE_ITEM_ID = 64;

function itemsError(): DomainError {
  return new DomainError('INVALID_ITEMS');
}

/**
 * Validates and normalizes line items against a transaction total: titles are trimmed
 * (1-80 chars), amounts are positive, quantities are positive integers, ids are unique and
 * the amounts add up to `totalMinor` (`ITEMS_TOTAL_MISMATCH` otherwise). An empty list
 * returns `[]`, meaning "no items".
 */
export function normalizeLineItems<Item extends LineItem>(
  items: readonly Item[],
  totalMinor: bigint,
): Item[] {
  if (!items.length) return [];
  if (items.length > MAX_LINE_ITEMS) throw itemsError();
  const ids = new Set<string>();
  const normalized = items.map((item) => {
    const title = item.title.trim();
    const id = item.id.trim();
    if (
      !id ||
      id.length > MAX_LINE_ITEM_ID ||
      ids.has(id) ||
      !title ||
      title.length > MAX_LINE_ITEM_TITLE ||
      item.amountMinor <= 0n ||
      (item.quantity !== undefined &&
        (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)) ||
      (item.participantIds !== undefined &&
        new Set(item.participantIds).size !== item.participantIds.length)
    )
      throw itemsError();
    ids.add(id);
    const next = { ...item, id, title };
    if (item.quantity === undefined) delete next.quantity;
    if (!item.participantIds?.length) delete next.participantIds;
    return next;
  });
  if (normalized.reduce((total, item) => total + item.amountMinor, 0n) !== totalMinor)
    throw new DomainError('ITEMS_TOTAL_MISMATCH');
  return normalized;
}

/**
 * Splits line items between participants: each item is shared equally (deterministic
 * `allocateParticipants`) by its `participantIds`, or by everyone when that is absent or
 * empty. A participant's amount is the sum of their item shares; rows follow
 * `participantIds` order and add up to the items' total. Throws `INVALID_SPLIT` for an item
 * naming someone outside `participantIds`, a non-positive amount or no participants.
 */
export function allocateItemized(
  items: readonly Pick<LineItem, 'amountMinor' | 'participantIds'>[],
  participantIds: readonly string[],
): ParticipantAmount[] {
  if (
    !items.length ||
    !participantIds.length ||
    new Set(participantIds).size !== participantIds.length ||
    participantIds.some((id) => !id)
  )
    throw new DomainError('INVALID_SPLIT');
  const allowed = new Set(participantIds);
  const totals = new Map<string, bigint>(participantIds.map((id) => [id, 0n]));
  for (const item of items) {
    const sharers = item.participantIds?.length ? item.participantIds : participantIds;
    if (
      item.amountMinor <= 0n ||
      new Set(sharers).size !== sharers.length ||
      sharers.some((id) => !allowed.has(id))
    )
      throw new DomainError('INVALID_SPLIT');
    for (const share of allocateParticipants(item.amountMinor, sharers, 'equal'))
      totals.set(share.userId, totals.get(share.userId)! + share.amountMinor);
  }
  return participantIds.map((userId) => ({ userId, amountMinor: totals.get(userId)! }));
}

/** True when participant rows equal the itemized allocation of `items`. */
export function matchesItemizedAllocation(
  totalMinor: bigint,
  rows: readonly { userId: string; amountMinor: bigint }[],
  items: readonly Pick<LineItem, 'amountMinor' | 'participantIds'>[],
): boolean {
  try {
    if (items.reduce((total, item) => total + item.amountMinor, 0n) !== totalMinor) return false;
    const allocation = allocateItemized(
      items,
      rows.map((row) => row.userId),
    );
    return allocation.every((item, index) => item.amountMinor === rows[index]?.amountMinor);
  } catch {
    return false;
  }
}

/** Existing items survive an edit that omits `items` only while they still match the total. */
export function keptLineItems<Item extends { amountMinor: bigint }>(
  items: readonly Item[] | undefined,
  amountMinor: bigint,
): Item[] | undefined {
  if (!items?.length) return undefined;
  return items.reduce((total, item) => total + item.amountMinor, 0n) === amountMinor
    ? [...items]
    : undefined;
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
    const paidBy = [...new Set(payers.map(userOf))].map((userId): [string, bigint] => [
      userId,
      amountFor(payers, userId),
    ]);
    if (paidBy.reduce((total, [, paid]) => total + paid, 0n) <= 0n) continue;
    const owedBy = [...new Set(participants.map(userOf))].map((userId): [string, bigint] => [
      userId,
      amountFor(participants, userId),
    ]);
    // One payment matrix for the whole expense: every share and every payment is preserved,
    // so no pair is credited a remainder that another pair also took.
    const matrix = paymentMatrix(owedBy, paidBy);
    balance +=
      (matrix.get(personId)?.get(currentUserId) ?? 0n) -
      (matrix.get(currentUserId)?.get(personId) ?? 0n);
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

/**
 * Splits `amount` across `weights` in proportion, largest remainder first (ties by id), so the
 * parts always add up to `amount`.
 */
export function allocateProportionally(
  amount: bigint,
  weights: readonly (readonly [string, bigint])[],
): Map<string, bigint> {
  const positive = weights.filter(([, weight]) => weight > 0n);
  const total = positive.reduce((sum, [, weight]) => sum + weight, 0n);
  const parts = new Map<string, bigint>();
  if (total <= 0n || amount === 0n) return parts;
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const rows = positive.map(([id, weight]) => ({
    id,
    floor: (absolute * weight) / total,
    rest: (absolute * weight) % total,
  }));
  let remainder = absolute - rows.reduce((sum, row) => sum + row.floor, 0n);
  const order = [...rows].sort((a, b) =>
    a.rest === b.rest ? (a.id < b.id ? -1 : 1) : a.rest > b.rest ? -1 : 1,
  );
  for (const row of order) {
    if (remainder <= 0n) break;
    row.floor += 1n;
    remainder -= 1n;
  }
  for (const row of rows) parts.set(row.id, negative ? -row.floor : row.floor);
  return parts;
}

/**
 * One bilateral balance per currency of the shared groups (amounts are never mixed), sorted
 * with non-zero balances first, then by currency.
 */
export function bilateralBalancesByCurrency(
  currentUserId: string,
  personId: string,
  groups: readonly GroupLedgerRecord[],
  transactions: readonly GroupLedgerRecord[],
  payerRecords: readonly GroupLedgerRecord[],
  participantRecords: readonly GroupLedgerRecord[],
  settlementRecords: readonly GroupLedgerRecord[],
): { currency: string; balanceMinor: bigint }[] {
  const currencies = [
    ...new Set(
      groups
        .map((group) => group.currency)
        .filter((currency): currency is string => typeof currency === 'string'),
    ),
  ].sort();
  return currencies
    .map((currency) => ({
      currency,
      balanceMinor: calculateBilateralBalance(
        currentUserId,
        personId,
        groups,
        transactions,
        payerRecords,
        participantRecords,
        settlementRecords,
        currency,
      ),
    }))
    .sort((left, right) => Number(right.balanceMinor !== 0n) - Number(left.balanceMinor !== 0n));
}

/**
 * Who funded whose share in one expense: `matrix.get(participant).get(payer)`. Each row sums
 * to the participant's share and each column to what the payer paid (when shares and payments
 * have the same total). Built from proportional floors, then remainders by largest fraction
 * (ties by id) wherever both the row and the column still need units.
 */
export function paymentMatrix(
  shares: readonly (readonly [string, bigint])[],
  payments: readonly (readonly [string, bigint])[],
): Map<string, Map<string, bigint>> {
  const payers = payments.filter(([, paid]) => paid > 0n);
  const totalPaid = payers.reduce((sum, [, paid]) => sum + paid, 0n);
  const matrix = new Map<string, Map<string, bigint>>();
  if (totalPaid <= 0n) return matrix;
  const rowNeed = new Map<string, bigint>();
  const colNeed = new Map(payers.map(([id, paid]) => [id, paid] as [string, bigint]));
  const cells: { participant: string; payer: string; rest: bigint }[] = [];
  for (const [participant, share] of shares) {
    if (share <= 0n) continue;
    const row = new Map<string, bigint>();
    let used = 0n;
    for (const [payer, paid] of payers) {
      const floor = (share * paid) / totalPaid;
      row.set(payer, floor);
      used += floor;
      colNeed.set(payer, colNeed.get(payer)! - floor);
      cells.push({ participant, payer, rest: (share * paid) % totalPaid });
    }
    matrix.set(participant, row);
    rowNeed.set(participant, share - used);
  }
  const give = (participant: string, payer: string) => {
    const row = matrix.get(participant)!;
    row.set(payer, row.get(payer)! + 1n);
    rowNeed.set(participant, rowNeed.get(participant)! - 1n);
    colNeed.set(payer, colNeed.get(payer)! - 1n);
  };
  cells.sort((a, b) =>
    a.rest === b.rest
      ? a.participant === b.participant
        ? a.payer < b.payer
          ? -1
          : 1
        : a.participant < b.participant
          ? -1
          : 1
      : a.rest > b.rest
        ? -1
        : 1,
  );
  for (const cell of cells)
    if (rowNeed.get(cell.participant)! > 0n && colNeed.get(cell.payer)! > 0n)
      give(cell.participant, cell.payer);
  // Anything left (only possible when shares and payments differ) goes to any open column.
  for (const [participant] of matrix)
    for (const [payer] of payers)
      while (rowNeed.get(participant)! > 0n && colNeed.get(payer)! > 0n) give(participant, payer);
  return matrix;
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

export type SuggestedTransfer = { fromUserId: string; toUserId: string; amountMinor: bigint };

/** Exact search is used up to this many non-zero members (2^n subsets). */
const EXACT_PLAN_MAX_MEMBERS = 12;

/**
 * Splits members into the most groups whose balances each sum to zero (each group of k then
 * settles in k-1 transfers, so more groups means fewer transfers). Classic subset DP.
 */
function zeroSumGroups(ids: readonly string[], amounts: readonly bigint[]): string[][] {
  const count = ids.length;
  const full = (1 << count) - 1;
  const sums: bigint[] = new Array(full + 1).fill(0n);
  const best = new Int8Array(full + 1);
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    sums[mask] = sums[mask ^ low]! + amounts[31 - Math.clz32(low)]!;
    let most = 0;
    for (let bit = 0; bit < count; bit++)
      if (mask & (1 << bit)) most = Math.max(most, best[mask ^ (1 << bit)]!);
    best[mask] = most + (sums[mask] === 0n ? 1 : 0);
  }
  const groups: string[][] = [];
  let remaining = full;
  while (remaining) {
    let chosen = remaining;
    for (let sub = remaining; sub; sub = (sub - 1) & remaining) {
      if (sums[sub] !== 0n || best[remaining ^ sub] !== best[remaining]! - 1) continue;
      // Prefer the smallest such group; ties are irrelevant to the transfer count.
      if (popcount(sub) < popcount(chosen)) chosen = sub;
    }
    groups.push(ids.filter((_, bit) => chosen & (1 << bit)));
    remaining ^= chosen;
  }
  return groups;
}

function popcount(value: number): number {
  let bits = 0;
  for (let rest = value; rest; rest &= rest - 1) bits++;
  return bits;
}

/**
 * The fewest transfers that clear every balance. Members are first split into the most
 * zero-sum groups (exact for up to 12 members with a balance, greedy beyond); inside each
 * group the largest debtor pays the largest creditor. Ties break by user id, so the plan is
 * stable.
 */
export function simplifyDebts(balances: BalanceMap): SuggestedTransfer[] {
  const owing = Object.entries(balances)
    .filter(([, amount]) => amount !== 0n)
    .sort(([left], [right]) => (left < right ? -1 : 1));
  if (owing.length < 3 || owing.length > EXACT_PLAN_MAX_MEMBERS) return greedyTransfers(balances);
  return zeroSumGroups(
    owing.map(([userId]) => userId),
    owing.map(([, amount]) => amount),
  ).flatMap((group) =>
    greedyTransfers(Object.fromEntries(group.map((userId) => [userId, balances[userId]!]))),
  );
}

/** Largest debtor pays largest creditor until one side reaches zero (at most n-1 transfers). */
function greedyTransfers(balances: BalanceMap): SuggestedTransfer[] {
  const byAmount = (left: [string, bigint], right: [string, bigint]) =>
    right[1] === left[1] ? (left[0] < right[0] ? -1 : 1) : right[1] > left[1] ? 1 : -1;
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0n)
    .sort(byAmount);
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0n)
    .map(([userId, amount]): [string, bigint] => [userId, -amount])
    .sort(byAmount);
  const transfers: SuggestedTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]!;
    const debtor = debtors[debtorIndex]!;
    const amountMinor = creditor[1] < debtor[1] ? creditor[1] : debtor[1];
    transfers.push({ fromUserId: debtor[0], toUserId: creditor[0], amountMinor });
    creditor[1] -= amountMinor;
    debtor[1] -= amountMinor;
    if (creditor[1] === 0n) creditorIndex += 1;
    if (debtor[1] === 0n) debtorIndex += 1;
  }
  return transfers;
}
