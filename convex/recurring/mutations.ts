import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';
import { publishMutationResult, replayMutationResult } from '../sync/common';

const recurrence = v.union(
  v.literal('daily'),
  v.literal('weekly'),
  v.literal('monthly'),
  v.literal('yearly'),
);

export const create = mutation({
  args: {
    name: v.string(),
    amountMinor: v.int64(),
    currency: v.string(),
    accountId: v.id('accounts'),
    frequency: recurrence,
    nextOccurrence: v.number(),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'recurring.create',
    );
    if (replay.found) {
      const id = ctx.db.normalizeId('recurringRules', String(replay.result));
      if (!id) throw new Error('INVALID_MUTATION_RECEIPT');
      return id;
    }
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== user._id || account.archivedAt !== undefined)
      throw new Error('INVALID_ACCOUNT');
    assertPositiveAmount(args.amountMinor);
    assertCurrency(args.currency);
    if (
      account.currency !== args.currency ||
      !args.name.trim() ||
      args.nextOccurrence <= Date.now()
    )
      throw new Error('INVALID_RECURRING_RULE');
    const now = Date.now();
    const record = {
      ownerId: user._id,
      name: args.name.trim(),
      template: {
        type: 'expense',
        title: args.name.trim(),
        accountId: args.accountId,
        amountMinor: args.amountMinor,
        currency: args.currency,
      },
      frequency: args.frequency,
      interval: 1,
      nextOccurrence: args.nextOccurrence,
      autoCreate: false,
      reminderSettings: { enabled: true },
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    const id = await ctx.db.insert('recurringRules', record);
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'recurring.create',
      id,
      'recurringRules',
      String(id),
      now,
      { ...record, _id: id },
    );
    return id;
  },
});

export const setEnabled = mutation({
  args: { ruleId: v.id('recurringRules'), enabled: v.boolean(), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'recurring.setEnabled',
    );
    if (replay.found) return replay.result;
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.ownerId !== user._id) throw new Error('INSUFFICIENT_PERMISSION');
    const now = Date.now();
    await ctx.db.patch(rule._id, { enabled: args.enabled, updatedAt: now });
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'recurring.setEnabled',
      rule._id,
      'recurringRules',
      String(rule._id),
      now,
      { ...rule, enabled: args.enabled, updatedAt: now },
    );
    return rule._id;
  },
});
