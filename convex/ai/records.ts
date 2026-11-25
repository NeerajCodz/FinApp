/** Owner-checked reads used by FinAI's confirmed actions to merge partial edits. */
import { v } from 'convex/values';
import { internalQuery } from '../_generated/server';

const kind = v.union(
  v.literal('transaction'),
  v.literal('account'),
  v.literal('category'),
  v.literal('budget'),
  v.literal('goal'),
  v.literal('recurring'),
);
const TABLE = {
  transaction: 'transactions',
  account: 'accounts',
  category: 'categories',
  budget: 'budgets',
  goal: 'goals',
  recurring: 'recurringRules',
} as const;

/** The record when `userId` owns it (and it isn't a group expense), else null. */
export const owned = internalQuery({
  args: { userId: v.id('users'), kind, id: v.string() },
  handler: async (ctx, args) => {
    const table = TABLE[args.kind];
    const docId = ctx.db.normalizeId(table, args.id);
    if (!docId) return null;
    const doc = (await ctx.db.get(docId)) as
      (Record<string, unknown> & { _id: string; ownerId: string }) | null;
    if (!doc || doc.ownerId !== args.userId) return null;
    if (args.kind === 'transaction' && doc.groupId !== undefined) return null;
    return doc;
  },
});
