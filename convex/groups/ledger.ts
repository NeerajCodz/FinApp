import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { calculateNetBalances, serializeBalances, type BalanceMap } from '../splits/domain';
import { trackGroupActivity } from '../admin/usage';

type Ctx = QueryCtx | MutationCtx;

export type GroupLedger = {
  expenses: Doc<'transactions'>[];
  payers: Doc<'expensePayers'>[];
  participants: Doc<'expenseParticipants'>[];
  settlements: Doc<'settlements'>[];
};

/** Loads the live (posted, non-deleted) ledger of a group in its currency. */
export async function loadGroupLedger(
  ctx: Ctx,
  groupId: Id<'groups'>,
  currency: string,
): Promise<GroupLedger> {
  const [transactions, settlementRows] = await Promise.all([
    ctx.db
      .query('transactions')
      .withIndex('by_group_occurredAt', (q) => q.eq('groupId', groupId))
      .collect(),
    ctx.db
      .query('settlements')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect(),
  ]);
  const expenses = transactions.filter(
    (expense) =>
      expense.type === 'expense' &&
      expense.status === 'posted' &&
      expense.deletedAt === undefined &&
      expense.currency === currency,
  );
  const rows = await Promise.all(
    expenses.map((expense) =>
      Promise.all([
        ctx.db
          .query('expensePayers')
          .withIndex('by_transaction', (q) => q.eq('transactionId', expense._id))
          .collect(),
        ctx.db
          .query('expenseParticipants')
          .withIndex('by_transaction', (q) => q.eq('transactionId', expense._id))
          .collect(),
      ]),
    ),
  );
  const payers: Doc<'expensePayers'>[] = [];
  const participants: Doc<'expenseParticipants'>[] = [];
  rows.forEach(([paid, shared], index) => {
    const expense = expenses[index]!;
    const total = (items: { amountMinor: bigint }[]) =>
      items.reduce((sum, item) => sum + item.amountMinor, 0n);
    if (
      !paid.length ||
      !shared.length ||
      total(paid) !== expense.amountMinor ||
      total(shared) !== expense.amountMinor
    )
      throw new Error('INCOMPLETE_GROUP_SPLITS');
    payers.push(...paid);
    participants.push(...shared);
  });
  const settlements = settlementRows.filter(
    (settlement) => settlement.deletedAt === undefined && settlement.currency === currency,
  );
  return { expenses, payers, participants, settlements };
}

export function ledgerBalances(ledger: GroupLedger): BalanceMap {
  return calculateNetBalances(ledger.payers, ledger.participants, ledger.settlements);
}

export async function groupBalances(
  ctx: Ctx,
  groupId: Id<'groups'>,
  currency: string,
): Promise<BalanceMap> {
  return ledgerBalances(await loadGroupLedger(ctx, groupId, currency));
}

/** Users who have taken part in any live settlement in the group. */
export function settledUsers(ledger: GroupLedger): Set<string> {
  return new Set(ledger.settlements.flatMap((item) => [item.fromUserId, item.toUserId]));
}

export async function recordLedgerEvent(
  ctx: MutationCtx,
  event: Omit<Doc<'ledgerEvents'>, '_id' | '_creationTime' | 'balanceDeltas'> & {
    balanceDeltas?: BalanceMap;
  },
): Promise<Id<'ledgerEvents'>> {
  const { balanceDeltas, ...rest } = event;
  await trackGroupActivity(ctx, rest.groupId);
  return ctx.db.insert('ledgerEvents', {
    ...rest,
    ...(balanceDeltas && Object.keys(balanceDeltas).length
      ? { balanceDeltas: serializeBalances(balanceDeltas) }
      : {}),
  });
}

export type GroupRole = Doc<'groupMembers'>['role'];

export function isGroupAdmin(role: GroupRole | undefined): boolean {
  return role === 'owner' || role === 'admin';
}
