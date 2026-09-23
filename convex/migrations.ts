import { internalMutation } from './_generated/server';
import { v } from 'convex/values';

export const removeLegacyCategoryKind = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('categories').paginate({ numItems: 100, cursor });
    let removed = 0;
    for (const category of page.page) {
      if (category.kind === undefined) continue;
      await ctx.db.patch(category._id, { kind: undefined });
      removed += 1;
    }
    return {
      cursor: page.isDone ? null : page.continueCursor,
      done: page.isDone,
      removed,
    };
  },
});
