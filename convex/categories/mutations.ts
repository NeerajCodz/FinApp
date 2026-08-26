import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireIdentity } from '../shared/auth';

export const create = mutation({
  args: {
    name: v.string(),
    kind: v.union(v.literal('expense'), v.literal('income')),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query('users')
      .withIndex('by_identityId', (q) => q.eq('identityId', identity.subject))
      .unique();
    if (!user || !args.name.trim()) throw new Error('INVALID_CATEGORY');
    const now = Date.now();
    return ctx.db.insert('categories', {
      ...args,
      ownerId: user._id,
      isSystem: false,
      sortOrder: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const archive = mutation({
  args: { categoryId: v.id('categories') },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query('users')
      .withIndex('by_identityId', (q) => q.eq('identityId', identity.subject))
      .unique();
    const category = await ctx.db.get(args.categoryId);
    if (!user || !category || category.ownerId !== user._id)
      throw new Error('INSUFFICIENT_PERMISSION');
    await ctx.db.patch(args.categoryId, { archivedAt: Date.now(), updatedAt: Date.now() });
    return args.categoryId;
  },
});
