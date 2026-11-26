import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { advanceReadPointer, type ChatScope } from './shared/chat';
import { foldBudgets } from './categories/fromBudgets';

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

/**
 * Budgets → category limits (v1.11.1). Run until `done`:
 * `npx convex run migrations:foldBudgetsIntoCategoryLimits '{"cursor":null}'`.
 * Walks users; each user's active budgets become category limits (see
 * `categories/fromBudgets.ts`): a single-category budget sets that category's monthly limit
 * when it has none (the category's own limit wins otherwise; of two budgets for one category
 * the larger wins); overall budgets are retired with a notification. Budgets in Trash are left
 * there (restoring one folds it in). Idempotent: handled budgets get `migratedAt`.
 */
export const foldBudgetsIntoCategoryLimits = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('users').paginate({ numItems: 50, cursor });
    const totals = { converted: 0, kept: 0, retired: 0, skipped: 0 };
    for (const user of page.page) {
      const budgets = await ctx.db
        .query('budgets')
        .withIndex('by_owner_period', (q) => q.eq('ownerId', user._id))
        .collect();
      if (!budgets.length) continue;
      const result = await foldBudgets(ctx, user._id, budgets);
      totals.converted += result.converted;
      totals.kept += result.kept;
      totals.retired += result.retired;
      totals.skipped += result.skipped;
      for (const line of result.log) console.log(`[foldBudgets] user ${String(user._id)}: ${line}`);
    }
    return { cursor: page.isDone ? null : page.continueCursor, done: page.isDone, ...totals };
  },
});
