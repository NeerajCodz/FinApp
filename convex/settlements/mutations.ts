import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency } from '../shared/validators';
import { calculateNetBalances } from '../splits/domain';
import { publishMutationResult, replayMutationResult } from '../sync/common';
import { createNotification } from '../notifications/mutations';
import { formatMinor } from '../shared/money';
import { requireSettlementParticipant } from '../shared/permissions';
import { createSettlement, type Settlement } from './domain';

export function createSettlementRecord(
  actorId: string,
  fromUserId: string,
  toUserId: string,
  amountMinor: bigint,
): Settlement {
  requireSettlementParticipant(actorId, fromUserId, toUserId);
  return createSettlement(fromUserId, toUserId, amountMinor);
}

export const create = mutation({
  args: {
    groupId: v.id('groups'),
    fromUserId: v.id('users'),
    toUserId: v.id('users'),
    accountId: v.id('accounts'),
    amountMinor: v.int64(),
    currency: v.string(),
    occurredAt: v.number(),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, actor._id, args.clientMutationId, 'settlement.create');
    if (replay.found) {
      const previousId = ctx.db.normalizeId('settlements', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    createSettlementRecord(actor._id, args.fromUserId, args.toUserId, args.amountMinor);
    if (!Number.isFinite(args.occurredAt) || args.occurredAt < 0) throw new Error('INVALID_DATE');
    const currency = args.currency.toUpperCase();
    assertCurrency(currency);
    const [group, account, memberships] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db.get(args.accountId),
      ctx.db.query('groupMembers').withIndex('by_group', (q) => q.eq('groupId', args.groupId)).collect(),
    ]);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    if (group.currency !== currency) throw new Error('CURRENCY_MISMATCH');
    if (!account || account.ownerId !== actor._id || account.archivedAt !== undefined ||
      account.currency !== currency) throw new Error('ACCOUNT_UNAVAILABLE');
    const memberIds = new Set(memberships.map((member) => member.userId));
    if (!memberIds.has(actor._id) || !memberIds.has(args.fromUserId) ||
      !memberIds.has(args.toUserId)) throw new Error('NOT_MEMBER');

    // Check the current group ledger inside this mutation, so concurrent payments
    // cannot both clear the same debt.
    const [expenses, settlements] = await Promise.all([
      ctx.db.query('transactions').withIndex('by_group_occurredAt',
        (q) => q.eq('groupId', args.groupId)).collect(),
      ctx.db.query('settlements').withIndex('by_group', (q) => q.eq('groupId', args.groupId)).collect(),
    ]);
    const payers: { userId: string; amountMinor: bigint }[] = [];
    const participants: { userId: string; amountMinor: bigint }[] = [];
    for (const expense of expenses) {
      if (expense.type !== 'expense' || expense.status !== 'posted' ||
        expense.deletedAt !== undefined || expense.currency !== currency) continue;
      const [paid, shared] = await Promise.all([
        ctx.db.query('expensePayers').withIndex('by_transaction',
          (q) => q.eq('transactionId', expense._id)).collect(),
        ctx.db.query('expenseParticipants').withIndex('by_transaction',
          (q) => q.eq('transactionId', expense._id)).collect(),
      ]);
      if (!paid.length || !shared.length ||
        paid.reduce((sum, entry) => sum + entry.amountMinor, 0n) !== expense.amountMinor ||
        shared.reduce((sum, entry) => sum + entry.amountMinor, 0n) !== expense.amountMinor)
        throw new Error('INCOMPLETE_GROUP_SPLITS');
      payers.push(...paid);
      participants.push(...shared);
    }
    const balances = calculateNetBalances(payers, participants, settlements);
    const payerDebt = -(balances[args.fromUserId] ?? 0n);
    const payeeCredit = balances[args.toUserId] ?? 0n;
    if (payerDebt < args.amountMinor || payeeCredit < args.amountMinor)
      throw new Error('SETTLEMENT_EXCEEDS_BALANCE');

    const now = Date.now();
    const settlementId = await ctx.db.insert('settlements', {
      groupId: args.groupId,
      fromUserId: args.fromUserId,
      toUserId: args.toUserId,
      accountId: args.accountId,
      amountMinor: args.amountMinor,
      currency,
      occurredAt: args.occurredAt,
      createdAt: now,
    });
    const settlement = await ctx.db.get(settlementId);
    await publishMutationResult(ctx, actor._id, args.clientMutationId, 'settlement.create',
      settlementId, 'settlements', String(settlementId), now, settlement,
      memberships.map((member) => member.userId));
    const otherUserId = actor._id === args.fromUserId ? args.toUserId : args.fromUserId;
    await createNotification(ctx, otherUserId, `settlement:${settlementId}`,
      'settlement', 'settlement', String(args.groupId), 'Settlement recorded',
      `${formatMinor(args.amountMinor, currency)} was recorded in ${group.name}.`);
    return settlementId;
  },
});
