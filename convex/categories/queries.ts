import { query } from '../_generated/server';
import { getOptionalUser, requireIdentity } from '../shared/auth';

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    return ctx.db
      .query('categories')
      .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
      .collect();
  },
});
