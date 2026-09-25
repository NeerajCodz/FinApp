import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';
import { publishMutationResult, recordSyncChange, replayMutationResult } from '../sync/common';
import { createNotification } from '../notifications/mutations';
import { applyContribution } from './domain';

export const create = mutation({
  args: {
    name: v.string(), targetAmountMinor: v.int64(), currency: v.string(),
    targetDate: v.optional(v.number()), clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'goal.create');
    if (replay.found) {
      const id = ctx.db.normalizeId('goals', String(replay.result));
      if (!id) throw new Error('INVALID_MUTATION_RECEIPT');
      return id;
    }
    const name = args.name.trim();
    assertPositiveAmount(args.targetAmountMinor);
    assertCurrency(args.currency);
    if (!name || (args.targetDate !== undefined && args.targetDate <= Date.now())) throw new Error('INVALID_GOAL');
    const now = Date.now();
    const record = { ownerId: user._id, name, targetAmountMinor: args.targetAmountMinor,
      currency: args.currency, targetDate: args.targetDate, createdAt: now, updatedAt: now };
    const id = await ctx.db.insert('goals', record);
    await publishMutationResult(ctx, user._id, args.clientMutationId, 'goal.create', id,
      'goals', String(id), now, { ...record, _id: id });
    return id;
  },
});

export const contribute = mutation({
  args: { goalId: v.id('goals'), amountMinor: v.int64(), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'goal.contribute');
    if (replay.found) {
      const id = ctx.db.normalizeId('goalContributions', String(replay.result));
      if (!id) throw new Error('INVALID_MUTATION_RECEIPT');
      return id;
    }
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.ownerId !== user._id || goal.archivedAt !== undefined) throw new Error('INSUFFICIENT_PERMISSION');
    assertPositiveAmount(args.amountMinor);
    const contributions = await ctx.db.query('goalContributions')
      .withIndex('by_goal', (query) => query.eq('goalId', args.goalId)).collect();
    const previous = contributions.reduce((sum, entry) => sum + entry.amountMinor, 0n);
    const progress = applyContribution(previous, args.amountMinor, goal.targetAmountMinor);
    const now = Date.now();
    const record = { goalId: goal._id, ownerId: user._id, amountMinor: args.amountMinor,
      currency: goal.currency, occurredAt: now, createdAt: now };
    const id = await ctx.db.insert('goalContributions', record);
    await publishMutationResult(ctx, user._id, args.clientMutationId, 'goal.contribute', id,
      'goalContributions', String(id), now, { ...record, _id: id });
    if (progress.complete && goal.completedAt === undefined) {
      await ctx.db.patch(goal._id, { completedAt: now, updatedAt: now });
      await recordSyncChange(ctx, user._id, 'goals', String(goal._id), now,
        { ...goal, completedAt: now, updatedAt: now });
      await createNotification(ctx, user._id, `goal:${goal._id}:complete`, 'goal', 'goal',
        String(goal._id), `${goal.name} reached`, 'Your contributions reached the target.');
    }
    return id;
  },
});
