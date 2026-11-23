/**
 * Previews what editing or deleting a group expense does to everyone's balance, computed
 * locally from the same projection the server uses. Settlements stay as real payments, so a
 * member who already settled and now owes less is shown as being owed money back.
 */
import {
  balanceDeltas,
  projectGroupBalances,
  settledImpact,
  type BalanceMap,
  type SettledImpact,
} from '@convex/splits/domain';

type LedgerRecord = Record<string, unknown>;
export type ExpenseLedger = {
  group: LedgerRecord;
  transactions: readonly LedgerRecord[];
  payers: readonly LedgerRecord[];
  participants: readonly LedgerRecord[];
  settlements: readonly LedgerRecord[];
};
export type ExpenseChange =
  | {
      kind: 'update';
      amountMinor: bigint;
      payers: readonly { userId: string; amountMinor: bigint }[];
      participants: readonly { userId: string; amountMinor: bigint }[];
    }
  | { kind: 'delete' };
export type MemberImpact = { userId: string; before: bigint; after: bigint; delta: bigint };
export type ExpenseImpact =
  | {
      status: 'ready';
      currency: string;
      before: BalanceMap;
      after: BalanceMap;
      /** Members whose balance moves, biggest change first. */
      changes: MemberImpact[];
      /** Members who already recorded a settlement in this group and are affected. */
      settled: SettledImpact[];
    }
  | { status: 'unavailable'; reason: string };

export function recordAliases(record: LedgerRecord | undefined): string[] {
  if (!record) return [];
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

function belongsTo(record: LedgerRecord, field: string, ids: readonly string[]): boolean {
  const value = record[field];
  return typeof value === 'string' && ids.includes(value);
}

/** Current balances of a group, or null when the local ledger is incomplete. */
export function currentGroupBalances(ledger: ExpenseLedger): BalanceMap | null {
  try {
    return projectGroupBalances(
      ledger.group,
      ledger.transactions,
      ledger.payers,
      ledger.participants,
      ledger.settlements,
    ).balances;
  } catch {
    return null;
  }
}

/** Members who took part in a live (not undone) settlement in the group. */
export function settledMemberIds(ledger: ExpenseLedger): Set<string> {
  const groupIds = recordAliases(ledger.group);
  const ids = new Set<string>();
  for (const settlement of ledger.settlements) {
    if (!belongsTo(settlement, 'groupId', groupIds) || settlement.deletedAt !== undefined) continue;
    if (settlement.currency !== undefined && settlement.currency !== ledger.group.currency)
      continue;
    if (typeof settlement.fromUserId === 'string') ids.add(settlement.fromUserId);
    if (typeof settlement.toUserId === 'string') ids.add(settlement.toUserId);
  }
  return ids;
}

/**
 * Projects balances before and after replacing (or deleting) one expense. `transactionId` may
 * be any of the expense's local or cloud ids.
 */
export function projectExpenseImpact(
  ledger: ExpenseLedger,
  transactionId: string,
  change: ExpenseChange,
): ExpenseImpact {
  const target = ledger.transactions.find((record) =>
    recordAliases(record).includes(transactionId),
  );
  if (!target) return { status: 'unavailable', reason: 'EXPENSE_NOT_FOUND' };
  const targetIds = recordAliases(target);
  const anchorId = targetIds[0]!;
  const ownRow = (row: LedgerRecord) => belongsTo(row, 'transactionId', targetIds);
  try {
    const before = projectGroupBalances(
      ledger.group,
      ledger.transactions,
      ledger.payers,
      ledger.participants,
      ledger.settlements,
    );
    const transactions = ledger.transactions.map((record) =>
      record === target
        ? change.kind === 'delete'
          ? { ...record, deletedAt: Date.now() }
          : { ...record, amountMinor: change.amountMinor }
        : record,
    );
    const replacement = (rows: readonly { userId: string; amountMinor: bigint }[]) =>
      rows.map((row) => ({
        transactionId: anchorId,
        userId: row.userId,
        amountMinor: row.amountMinor,
      }));
    const payers = [
      ...ledger.payers.filter((row) => !ownRow(row)),
      ...(change.kind === 'update' ? replacement(change.payers) : []),
    ];
    const participants = [
      ...ledger.participants.filter((row) => !ownRow(row)),
      ...(change.kind === 'update' ? replacement(change.participants) : []),
    ];
    const after = projectGroupBalances(
      ledger.group,
      transactions,
      payers,
      participants,
      ledger.settlements,
    );
    const deltas = balanceDeltas(before.balances, after.balances);
    const changes = Object.entries(deltas)
      .map(([userId, delta]) => ({
        userId,
        delta,
        before: before.balances[userId] ?? 0n,
        after: after.balances[userId] ?? 0n,
      }))
      .sort((left, right) => {
        const leftSize = left.delta < 0n ? -left.delta : left.delta;
        const rightSize = right.delta < 0n ? -right.delta : right.delta;
        return leftSize === rightSize
          ? left.userId.localeCompare(right.userId)
          : rightSize > leftSize
            ? 1
            : -1;
      });
    return {
      status: 'ready',
      currency: String(before.currency),
      before: before.balances,
      after: after.balances,
      changes,
      settled: settledImpact(before.balances, after.balances, settledMemberIds(ledger)),
    };
  } catch (cause) {
    return {
      status: 'unavailable',
      reason: cause instanceof Error ? cause.message : 'IMPACT_UNAVAILABLE',
    };
  }
}

export type ShareStatus = 'paid' | 'settled' | 'owes' | 'owed';

/**
 * Where a member of an expense stands in the group right now: the person who paid, someone
 * who still owes the group, someone owed money back, or someone who is settled up.
 */
export function shareStatus(
  userId: string,
  payerIds: readonly string[],
  balances: BalanceMap | null,
): ShareStatus | null {
  if (payerIds.includes(userId)) return 'paid';
  if (!balances) return null;
  const balance = balances[userId] ?? 0n;
  return balance < 0n ? 'owes' : balance > 0n ? 'owed' : 'settled';
}
