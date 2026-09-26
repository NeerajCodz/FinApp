import { mutation } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';
import { publishMutationResult, recordSyncChange, replayMutationResult } from '../sync/common';
export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.string()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'category.create',
    );
    if (replay.found) return replay.result as Id<'categories'>;
    const name = args.name.trim();
    if (!name) throw new Error('INVALID_CATEGORY');
    if (args.parentId !== undefined) {
      const parentId = ctx.db.normalizeId('categories', args.parentId);
      const parent = parentId ? await ctx.db.get(parentId) : null;
      if (!parent || parent.ownerId !== user._id || parent.archivedAt !== undefined)
        throw new Error('INVALID_CATEGORY');
    }
    const now = Date.now();
    const { clientMutationId, ...categoryFields } = args;
    const categoryId = await ctx.db.insert('categories', {
      ...categoryFields,
      name,
      ownerId: user._id,
      isSystem: false,
      sortOrder: now,
      createdAt: now,
      updatedAt: now,
    });
    const category = await ctx.db.get(categoryId);
    if (!category) throw new Error('INVALID_CATEGORY');
    await publishMutationResult(
      ctx,
      user._id,
      clientMutationId,
      'category.create',
      categoryId,
      'categories',
      categoryId,
      now,
      category,
    );
    return categoryId;
  },
});

export const rename = mutation({
  args: {
    categoryId: v.id('categories'),
    name: v.string(),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, { categoryId, name, clientMutationId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, clientMutationId, 'category.rename');
    if (replay.found) return replay.result as typeof categoryId;
    const category = await ctx.db.get(categoryId);
    const trimmed = name.trim();
    if (
      !category ||
      category.ownerId !== user._id ||
      category.archivedAt !== undefined ||
      category.isSystem ||
      !trimmed
    )
      throw new Error('INVALID_CATEGORY');
    const updatedAt = Date.now();
    await ctx.db.patch(categoryId, { name: trimmed, updatedAt });
    const updated = await ctx.db.get(categoryId);
    if (!updated) throw new Error('INVALID_CATEGORY');
    await publishMutationResult(
      ctx,
      user._id,
      clientMutationId,
      'category.rename',
      categoryId,
      'categories',
      categoryId,
      updatedAt,
      updated,
    );
    return categoryId;
  },
});
export const setIcon = mutation({
  args: {
    categoryId: v.id('categories'),
    icon: v.union(v.string(), v.null()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, { categoryId, icon, clientMutationId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('INVALID_CATEGORY');
    const replay = await replayMutationResult(ctx, user._id, clientMutationId, 'category.setIcon');
    if (replay.found) return replay.result as typeof categoryId;
    const category = await ctx.db.get(categoryId);
    if (!category || category.ownerId !== user._id || category.archivedAt !== undefined)
      throw new Error('INVALID_CATEGORY');
    if (icon !== null && (icon.length === 0 || icon.length > 32))
      throw new Error('INVALID_CATEGORY');
    const updatedAt = Date.now();
    await ctx.db.patch(categoryId, { icon: icon ?? undefined, updatedAt });
    const updated = await ctx.db.get(categoryId);
    if (!updated) throw new Error('INVALID_CATEGORY');
    await publishMutationResult(
      ctx,
      user._id,
      clientMutationId,
      'category.setIcon',
      categoryId,
      'categories',
      categoryId,
      updatedAt,
      updated,
    );
    return categoryId;
  },
});

export const setLimit = mutation({
  args: {
    categoryId: v.id('categories'),
    amountMinor: v.union(v.int64(), v.null()),
    currency: v.optional(v.string()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, { categoryId, amountMinor, currency, clientMutationId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, clientMutationId, 'category.setLimit');
    if (replay.found) return replay.result as typeof categoryId;
    const category = await ctx.db.get(categoryId);
    if (!category || category.ownerId !== user._id || category.archivedAt !== undefined)
      throw new Error('INVALID_CATEGORY');
    if (currency !== undefined) assertCurrency(currency);
    if (amountMinor !== null) assertPositiveAmount(amountMinor);
    const limitCurrency =
      amountMinor === null
        ? undefined
        : (currency ?? category.limitCurrency ?? user.defaultCurrency);
    if (amountMinor !== null) {
      if (!limitCurrency) throw new Error('INVALID_CURRENCY');
      assertCurrency(limitCurrency);
    }
    const updatedAt = Date.now();
    await ctx.db.patch(categoryId, {
      monthlyLimitMinor: amountMinor === null ? undefined : amountMinor,
      limitCurrency,
      updatedAt,
    });
    const updated = await ctx.db.get(categoryId);
    if (!updated) throw new Error('INVALID_CATEGORY');
    await publishMutationResult(
      ctx,
      user._id,
      clientMutationId,
      'category.setLimit',
      categoryId,
      'categories',
      categoryId,
      updatedAt,
      updated,
    );
    return categoryId;
  },
});

export const archive = mutation({
  args: { categoryId: v.id('categories'), clientMutationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('INSUFFICIENT_PERMISSION');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'category.archive',
    );
    if (replay.found) return replay.result as typeof args.categoryId;
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.ownerId !== user._id) throw new Error('INSUFFICIENT_PERMISSION');
    const now = Date.now();
    await ctx.db.patch(args.categoryId, { archivedAt: now, updatedAt: now });
    const updated = await ctx.db.get(args.categoryId);
    if (!updated) throw new Error('INSUFFICIENT_PERMISSION');
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'category.archive',
      args.categoryId,
      'categories',
      args.categoryId,
      now,
      updated,
    );
    if (
      user.defaultExpenseCategoryId === args.categoryId ||
      user.defaultIncomeCategoryId === args.categoryId
    ) {
      const updatedUser = {
        ...user,
        ...(user.defaultExpenseCategoryId === args.categoryId
          ? { defaultExpenseCategoryId: undefined }
          : {}),
        ...(user.defaultIncomeCategoryId === args.categoryId
          ? { defaultIncomeCategoryId: undefined }
          : {}),
        updatedAt: now,
      };
      await ctx.db.patch(user._id, {
        ...(user.defaultExpenseCategoryId === args.categoryId
          ? { defaultExpenseCategoryId: undefined }
          : {}),
        ...(user.defaultIncomeCategoryId === args.categoryId
          ? { defaultIncomeCategoryId: undefined }
          : {}),
        updatedAt: now,
      });
      await recordSyncChange(ctx, user._id, 'users', String(user._id), now, updatedUser);
    }
    return args.categoryId;
  },
});
