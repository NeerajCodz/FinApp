import { mutation, type MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency } from '../shared/validators';
import { balanceDeltas } from '../splits/domain';
import { publishMutationResult, replayMutationResult } from '../sync/common';
import { createNotification } from '../notifications/mutations';
import { formatMinor } from '../shared/money';
import { requireSettlementParticipant } from '../shared/permissions';
import { createSettlement, type Settlement } from './domain';
import { groupBalances, isGroupAdmin, recordLedgerEvent } from '../groups/ledger';

import { assertClientId, assertClientIdAvailable } from '../shared/clientId';
export function createSettlementRecord(
  actorId: string,
  fromUserId: string,
  toUserId: string,
  amountMinor: bigint,
): Settlement {
  requireSettlementParticipant(actorId, fromUserId, toUserId);
  return createSettlement(fromUserId, toUserId, amountMinor);
}

const maxNoteLength = 280;

/**
 * Users who may appear on a settlement: current members, plus former members who still have
 * a balance to clear (e.g. removed before balances were required to be settled).
 */
async function settlementParties(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  memberships: Doc<'groupMembers'>[],
): Promise<Set<string>> {
  const former = await ctx.db
    .query('formerGroupMembers')
    .withIndex('by_group', (q) => q.eq('groupId', groupId))
    .collect();
  return new Set<string>([
    ...memberships.map((member) => member.userId),
    ...former.map((member) => member.userId),
  ]);
}

/** Current members plus both parties, who may be former members. */
function syncScopes(
  memberships: Doc<'groupMembers'>[],
  fromUserId: Id<'users'>,
  toUserId: Id<'users'>,
): Id<'users'>[] {
  return [...new Set([...memberships.map((member) => member.userId), fromUserId, toUserId])];
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
    note: v.optional(v.string()),
    clientMutationId: v.string(),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    assertClientId(args.clientId);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'settlement.create',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('settlements', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    await assertClientIdAvailable(args.clientId, () =>
      ctx.db
        .query('settlements')
        .withIndex('by_clientId', (query) => query.eq('clientId', args.clientId!))
        .unique(),
    );
    createSettlementRecord(actor._id, args.fromUserId, args.toUserId, args.amountMinor);
    if (!Number.isFinite(args.occurredAt) || args.occurredAt < 0) throw new Error('INVALID_DATE');
    const note = args.note?.trim() || undefined;
    if (note && note.length > maxNoteLength) throw new Error('NOTE_TOO_LONG');
    const currency = args.currency.toUpperCase();
    assertCurrency(currency);
    const [group, account, memberships] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db.get(args.accountId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
        .collect(),
    ]);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    if (group.currency !== currency) throw new Error('CURRENCY_MISMATCH');
    if (
      !account ||
      account.ownerId !== actor._id ||
      account.archivedAt !== undefined ||
      account.currency !== currency
    )
      throw new Error('ACCOUNT_UNAVAILABLE');
    const parties = await settlementParties(ctx, args.groupId, memberships);
    if (!parties.has(actor._id) || !parties.has(args.fromUserId) || !parties.has(args.toUserId))
      throw new Error('NOT_MEMBER');

    // Check the current group ledger inside this mutation, so concurrent payments
    // cannot both clear the same debt.
    const balances = await groupBalances(ctx, args.groupId, currency);
    const payerDebt = -(balances[args.fromUserId] ?? 0n);
    const payeeCredit = balances[args.toUserId] ?? 0n;
    if (payerDebt < args.amountMinor || payeeCredit < args.amountMinor)
      throw new Error('SETTLEMENT_EXCEEDS_BALANCE');

    const now = Date.now();
    const settlementId = await ctx.db.insert('settlements', {
      clientId: args.clientId,
      groupId: args.groupId,
      fromUserId: args.fromUserId,
      toUserId: args.toUserId,
      accountId: args.accountId,
      amountMinor: args.amountMinor,
      currency,
      occurredAt: args.occurredAt,
      ...(note ? { note } : {}),
      createdBy: actor._id,
      createdAt: now,
    });
    await recordLedgerEvent(ctx, {
      groupId: args.groupId,
      actorId: actor._id,
      kind: 'settlement.created',
      entityType: 'settlement',
      entityId: String(settlementId),
      summary: `${formatMinor(args.amountMinor, currency)} settled`,
      balanceDeltas: { [args.fromUserId]: args.amountMinor, [args.toUserId]: -args.amountMinor },
      createdAt: now,
    });
    const settlement = await ctx.db.get(settlementId);
    await publishMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'settlement.create',
      settlementId,
      'settlements',
      String(settlementId),
      now,
      settlement,
      syncScopes(memberships, args.fromUserId, args.toUserId),
    );
    const otherUserId = actor._id === args.fromUserId ? args.toUserId : args.fromUserId;
    await createNotification(
      ctx,
      otherUserId,
      `settlement:${settlementId}`,
      'settlement',
      'settlement',
      String(args.groupId),
      'Settlement recorded',
      `${formatMinor(args.amountMinor, currency)} was recorded in ${group.name}.${note ? ` “${note}”` : ''}`,
    );
    return settlementId;
  },
});

/**
 * Undoes a recorded payment. Either party or a group admin may remove it; the debt it cleared
 * comes back, and the other party is notified.
 */
export const remove = mutation({
  args: {
    settlementId: v.id('settlements'),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'settlement.remove',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('settlements', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const settlement = await ctx.db.get(args.settlementId);
    if (!settlement || settlement.deletedAt !== undefined)
      throw new Error('INSUFFICIENT_PERMISSION');
    const [group, memberships] = await Promise.all([
      ctx.db.get(settlement.groupId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (q) => q.eq('groupId', settlement.groupId))
        .collect(),
    ]);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    const actorMembership = memberships.find((member) => member.userId === actor._id);
    const isParty = actor._id === settlement.fromUserId || actor._id === settlement.toUserId;
    if (!isParty && !isGroupAdmin(actorMembership?.role))
      throw new Error('INSUFFICIENT_PERMISSION');

    const now = Date.now();
    await ctx.db.patch(args.settlementId, { deletedAt: now, deletedBy: actor._id });
    await recordLedgerEvent(ctx, {
      groupId: settlement.groupId,
      actorId: actor._id,
      kind: 'settlement.deleted',
      entityType: 'settlement',
      entityId: String(args.settlementId),
      summary: `${formatMinor(settlement.amountMinor, settlement.currency)} payment undone`,
      balanceDeltas: balanceDeltas(
        { [settlement.fromUserId]: settlement.amountMinor, [settlement.toUserId]: 0n },
        { [settlement.fromUserId]: 0n, [settlement.toUserId]: settlement.amountMinor },
      ),
      createdAt: now,
    });
    const removed = await ctx.db.get(args.settlementId);
    await publishMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'settlement.remove',
      args.settlementId,
      'settlements',
      String(args.settlementId),
      now,
      removed,
      syncScopes(memberships, settlement.fromUserId, settlement.toUserId),
    );
    for (const userId of [settlement.fromUserId, settlement.toUserId]) {
      if (userId === actor._id) continue;
      await createNotification(
        ctx,
        userId,
        `settlement-removed:${args.settlementId}`,
        'settlement',
        'settlement',
        String(settlement.groupId),
        'Payment undone',
        `A ${formatMinor(settlement.amountMinor, settlement.currency)} payment in ${group.name} was removed, so that balance is open again.`,
      );
    }
    return args.settlementId;
  },
});
