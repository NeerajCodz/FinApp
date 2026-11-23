import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { advanceReadPointer, type ChatScope } from './shared/chat';

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

/**
 * Optional: folds legacy per-message receipts into chatReadPointers. Queries already fall back
 * to the newest legacy receipt, so this only removes that fallback read. Run per table until done.
 */
export const backfillChatReadPointers = internalMutation({
  args: {
    table: v.union(v.literal('groupMessageReads'), v.literal('directMessageReads')),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { table, cursor }) => {
    const page = await ctx.db.query(table).paginate({ numItems: 100, cursor });
    let advanced = 0;
    for (const receipt of page.page) {
      const message = await ctx.db.get(receipt.messageId);
      const readAt = message?.createdAt ?? receipt.seenAt;
      const scope: ChatScope =
        'groupId' in receipt
          ? { type: 'group', id: receipt.groupId }
          : { type: 'direct', id: receipt.conversationId };
      await advanceReadPointer(ctx, scope, receipt.userId, readAt);
      advanced += 1;
    }
    return { cursor: page.isDone ? null : page.continueCursor, done: page.isDone, advanced };
  },
});
