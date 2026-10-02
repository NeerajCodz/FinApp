import { query } from '../_generated/server';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const avatars = await ctx.db.query('avatars').collect();
    return avatars
      .sort((left, right) => Number(left.avatarId.slice(2)) - Number(right.avatarId.slice(2)))
      .map(({ avatarId, gender }) => ({ avatarId, gender }));
  },
});
