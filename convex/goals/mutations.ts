import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';
import { publishMutationResult, recordSyncChange, replayMutationResult } from '../sync/common';
import { createNotification } from '../notifications/mutations';
import { applyContribution } from './domain';

const priority = v.union(v.literal('low'), v.literal('medium'), v.literal('high'));
const reminderFrequency = v.union(v.literal('none'), v.literal('weekly'), v.literal('monthly'));

export const create = mutation({
  args: {
    name: v.string(),
    targetAmountMinor: v.int64(),
    currency: v.string(),
    targetDate: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    goalType: v.optional(v.string()),
    monthlyContributionMinor: v.optional(v.int64()),
    accountId: v.optional(v.id('accounts')),
    priority: v.optional(priority),
    notes: v.optional(v.string()),
    reminderFrequency: v.optional(reminderFrequency),
    clientMutationId: v.string(),
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
    if (args.monthlyContributionMinor !== undefined && args.monthlyContributionMinor < 0n)
      throw new Error('INVALID_GOAL');
    if (args.accountId !== undefined) {
      const account = await ctx.db.get(args.accountId);
      if (!account || account.ownerId !== user._id || account.archivedAt !== undefined)
        throw new Error('INSUFFICIENT_PERMISSION');
      if (account.currency !== args.currency) throw new Error('CURRENCY_MISMATCH');
    }
    if (
      (args.icon !== undefined && (args.icon.length === 0 || args.icon.length > 80)) ||
      (args.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(args.color))
    )
      throw new Error('INVALID_GOAL');
    if (!name || (args.targetDate !== undefined && (!Number.isFinite(args.targetDate) || args.targetDate <= Date.now())))
      throw new Error('INVALID_GOAL');
    const now = Date.now();
    const record = {
      ownerId: user._id,
      name,
      targetAmountMinor: args.targetAmountMinor,
      currency: args.currency,
      targetDate: args.targetDate,
      createdAt: now,
      color: args.color,
      icon: args.icon,
      goalType: args.goalType,
      monthlyContributionMinor: args.monthlyContributionMinor,
      accountId: args.accountId,
      priority: args.priority,
      notes: args.notes,
      reminderFrequency: args.reminderFrequency,
      updatedAt: now,
    };
    const id = await ctx.db.insert('goals', record);
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'goal.create',
      id,
      'goals',
      String(id),
      now,
      { ...record, _id: id },
    );
    return id;
  },
});
export const setIcon = mutation({
  args: {
    goalId: v.id('goals'),
    icon: v.union(v.string(), v.null()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'goal.setIcon');
    if (replay.found) {
      const previousId = ctx.db.normalizeId('goals', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.ownerId !== user._id || goal.archivedAt !== undefined)
      throw new Error('INVALID_GOAL');
    if (args.icon !== null && (args.icon.length === 0 || args.icon.length > 80))
      throw new Error('INVALID_GOAL');
    const updatedAt = Date.now();
    await ctx.db.patch(args.goalId, { icon: args.icon ?? undefined, updatedAt });
    const updated = await ctx.db.get(args.goalId);
    if (!updated) throw new Error('INVALID_GOAL');
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'goal.setIcon',
      args.goalId,
      'goals',
      String(args.goalId),
      updatedAt,
      { ...updated, _id: args.goalId },
    );
    return args.goalId;
  },
});

export const update = mutation({
  args: {
    goalId: v.id('goals'),
    name: v.string(),
    targetAmountMinor: v.int64(),
    targetDate: v.optional(v.union(v.number(), v.null())),
    icon: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
    goalType: v.optional(v.union(v.string(), v.null())),
    monthlyContributionMinor: v.optional(v.union(v.int64(), v.null())),
    accountId: v.optional(v.union(v.id('accounts'), v.null())),
    priority: v.optional(priority),
    notes: v.optional(v.union(v.string(), v.null())),
    reminderFrequency: v.optional(reminderFrequency),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'goal.update');
    if (replay.found) {
      const id = ctx.db.normalizeId('goals', String(replay.result));
      if (!id) throw new Error('INVALID_MUTATION_RECEIPT');
      return id;
    }
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.ownerId !== user._id || goal.archivedAt !== undefined)
      throw new Error('INVALID_GOAL');
    const name = args.name.trim();
    assertPositiveAmount(args.targetAmountMinor);
    if (args.monthlyContributionMinor !== undefined && args.monthlyContributionMinor !== null && args.monthlyContributionMinor < 0n)
      throw new Error('INVALID_GOAL');
    if (args.accountId !== undefined && args.accountId !== null) {
      const account = await ctx.db.get(args.accountId);
      if (!account || account.ownerId !== user._id || account.archivedAt !== undefined)
        throw new Error('INSUFFICIENT_PERMISSION');
      if (account.currency !== goal.currency) throw new Error('CURRENCY_MISMATCH');
    }
    if (
      !name ||
      (args.targetDate !== undefined && args.targetDate !== null && (!Number.isFinite(args.targetDate) || args.targetDate <= Date.now())) ||
      (args.icon !== undefined && args.icon !== null && (args.icon.length === 0 || args.icon.length > 80)) ||
      (args.color !== undefined && args.color !== null && !/^#[0-9a-fA-F]{6}$/.test(args.color))
    )
      throw new Error('INVALID_GOAL');
    const updatedAt = Date.now();
    await ctx.db.patch(args.goalId, {
      name,
      targetAmountMinor: args.targetAmountMinor,
      ...(args.targetDate !== undefined ? { targetDate: args.targetDate ?? undefined } : {}),
      ...(args.icon !== undefined ? { icon: args.icon ?? undefined } : {}),
      ...(args.color !== undefined ? { color: args.color ?? undefined } : {}),
      ...(args.goalType !== undefined ? { goalType: args.goalType ?? undefined } : {}),
      ...(args.monthlyContributionMinor !== undefined ? { monthlyContributionMinor: args.monthlyContributionMinor ?? undefined } : {}),
      ...(args.accountId !== undefined ? { accountId: args.accountId ?? undefined } : {}),
      ...(args.priority !== undefined ? { priority: args.priority } : {}),
      ...(args.notes !== undefined ? { notes: args.notes ?? undefined } : {}),
      ...(args.reminderFrequency !== undefined ? { reminderFrequency: args.reminderFrequency } : {}),
      updatedAt,
    });
    const updated = await ctx.db.get(args.goalId);
    if (!updated) throw new Error('INVALID_GOAL');
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'goal.update',
      args.goalId,
      'goals',
      String(args.goalId),
      updatedAt,
      { ...updated, _id: args.goalId },
    );
    return args.goalId;
  },
});

export const archive = mutation({
  args: {
    goalId: v.id('goals'),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'goal.archive');
    if (replay.found) {
      const id = ctx.db.normalizeId('goals', String(replay.result));
      if (!id) throw new Error('INVALID_MUTATION_RECEIPT');
      return id;
    }
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.ownerId !== user._id) throw new Error('INVALID_GOAL');
    const updatedAt = Date.now();
    const archivedAt = goal.archivedAt ?? updatedAt;
    await ctx.db.patch(args.goalId, { archivedAt, updatedAt });
    const updated = await ctx.db.get(args.goalId);
    if (!updated) throw new Error('INVALID_GOAL');
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'goal.archive',
      args.goalId,
      'goals',
      String(args.goalId),
      updatedAt,
      { ...updated, _id: args.goalId },
    );
    return args.goalId;
  },
});

export const contribute = mutation({
  args: { goalId: v.id('goals'), amountMinor: v.int64(), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'goal.contribute',
    );
    if (replay.found) {
      const id = ctx.db.normalizeId('goalContributions', String(replay.result));
      if (!id) throw new Error('INVALID_MUTATION_RECEIPT');
      return id;
    }
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.ownerId !== user._id || goal.archivedAt !== undefined)
      throw new Error('INSUFFICIENT_PERMISSION');
    assertPositiveAmount(args.amountMinor);
    const contributions = await ctx.db
      .query('goalContributions')
      .withIndex('by_goal', (query) => query.eq('goalId', args.goalId))
      .collect();
    const previous = contributions.reduce((sum, entry) => sum + entry.amountMinor, 0n);
    const progress = applyContribution(previous, args.amountMinor, goal.targetAmountMinor);
    const now = Date.now();
    const record = {
      goalId: goal._id,
      ownerId: user._id,
      amountMinor: args.amountMinor,
      currency: goal.currency,
      occurredAt: now,
      createdAt: now,
    };
    const id = await ctx.db.insert('goalContributions', record);
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'goal.contribute',
      id,
      'goalContributions',
      String(id),
      now,
      { ...record, _id: id },
    );
    if (progress.complete && goal.completedAt === undefined) {
      await ctx.db.patch(goal._id, { completedAt: now, updatedAt: now });
      await recordSyncChange(ctx, user._id, 'goals', String(goal._id), now, {
        ...goal,
        completedAt: now,
        updatedAt: now,
      });
      await createNotification(
        ctx,
        user._id,
        `goal:${goal._id}:complete`,
        'goal',
        'goal',
        String(goal._id),
        `${goal.name} reached`,
        'Your contributions reached the target.',
      );
    }
    return id;
  },
});
