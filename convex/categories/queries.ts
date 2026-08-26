import { query } from '../_generated/server';
import { requireIdentity } from '../shared/auth';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query('users')
      .withIndex('by_identityId', (q) => q.eq('identityId', identity.subject))
      .unique();
    if (!user) return [];
    return ctx.db
      .query('categories')
      .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
      .collect();
  },
});
