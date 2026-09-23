import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';

export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const name = args.name.trim();
    if (!name) throw new Error('INVALID_CATEGORY');
    if (args.parentId !== undefined) {
      const parentId = ctx.db.normalizeId('categories', args.parentId);
      const parent = parentId ? await ctx.db.get(parentId) : null;
      if (!parent || parent.ownerId !== user._id || parent.archivedAt !== undefined)
        throw new Error('INVALID_CATEGORY');
    }
    const now = Date.now();
    return ctx.db.insert('categories', {
      ...args,
      name,
      ownerId: user._id,
      isSystem: false,
      sortOrder: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { categoryId: v.id('categories'), name: v.string() },
  handler: async (ctx, { categoryId, name }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
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
    await ctx.db.patch(categoryId, { name: trimmed, updatedAt: Date.now() });
    return categoryId;
  },
});
export const setIcon = mutation({
  args: { categoryId: v.id('categories'), icon: v.union(v.string(), v.null()) },
  handler: async (ctx, { categoryId, icon }) => {
    const user = await requireUser(ctx);
    const category = await ctx.db.get(categoryId);
    if (!user || !category || category.ownerId !== user._id || category.archivedAt !== undefined)
      throw new Error('INVALID_CATEGORY');
    if (icon !== null && (icon.length === 0 || icon.length > 32))
      throw new Error('INVALID_CATEGORY');
    await ctx.db.patch(categoryId, { icon: icon ?? undefined, updatedAt: Date.now() });
    return categoryId;
  },
});

export const setLimit = mutation({
  args: {
    categoryId: v.id('categories'),
    amountMinor: v.union(v.int64(), v.null()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { categoryId, amountMinor, currency }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
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
    await ctx.db.patch(categoryId, {
      monthlyLimitMinor: amountMinor === null ? undefined : amountMinor,
      limitCurrency,
      updatedAt: Date.now(),
    });
    return categoryId;
  },
});

export const archive = mutation({
  args: { categoryId: v.id('categories') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!user || !category || category.ownerId !== user._id)
      throw new Error('INSUFFICIENT_PERMISSION');
    const now = Date.now();
    await ctx.db.patch(args.categoryId, { archivedAt: now, updatedAt: now });
    if (
      user.defaultExpenseCategoryId === args.categoryId ||
      user.defaultIncomeCategoryId === args.categoryId
    )
      await ctx.db.patch(user._id, {
        ...(user.defaultExpenseCategoryId === args.categoryId
          ? { defaultExpenseCategoryId: undefined }
          : {}),
        ...(user.defaultIncomeCategoryId === args.categoryId
          ? { defaultIncomeCategoryId: undefined }
          : {}),
        updatedAt: now,
      });
    return args.categoryId;
  },
});
