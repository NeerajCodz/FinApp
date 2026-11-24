/**
 * Per-user AI rate limits: one `aiUsage` row per user, kind and UTC day counts requests (and
 * tokens). `consumeAiQuota` runs inside a mutation so the check and the increment are atomic.
 */
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { internalMutation, type MutationCtx } from '../_generated/server';
import { aiLimits, type AiUsageKind } from './config';
import { aiError } from './errors';

const DAY_MS = 24 * 60 * 60 * 1000;

export function usageWindowStart(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS;
}

/** Counts one request of `kind` for the user, or throws `AI_RATE_LIMITED` past the daily limit. */
export async function consumeAiQuota(
  ctx: MutationCtx,
  userId: Id<'users'>,
  kind: AiUsageKind,
  now = Date.now(),
): Promise<{ used: number; limit: number }> {
  const windowStart = usageWindowStart(now);
  const limit = aiLimits[kind].perDay;
  const row = await ctx.db
    .query('aiUsage')
    .withIndex('by_user_kind_window', (q) =>
      q.eq('userId', userId).eq('kind', kind).eq('windowStart', windowStart),
    )
    .unique();
  const used = row?.count ?? 0;
  if (used >= limit)
    throw aiError('AI_RATE_LIMITED', undefined, { retryAfterMs: windowStart + DAY_MS - now });
  if (row) await ctx.db.patch(row._id, { count: used + 1, updatedAt: now });
  else await ctx.db.insert('aiUsage', { userId, kind, windowStart, count: 1, updatedAt: now });
  return { used: used + 1, limit };
}

const kindValidator = v.union(
  v.literal('ocr'),
  v.literal('chat'),
  v.literal('decision'),
  v.literal('utility'),
);

/** Adds token usage from a finished Gemini call to today's row (best effort, for reporting). */
export const recordTokens = internalMutation({
  args: {
    userId: v.id('users'),
    kind: kindValidator,
    promptTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, { userId, kind, promptTokens, outputTokens }) => {
    const now = Date.now();
    const windowStart = usageWindowStart(now);
    const row = await ctx.db
      .query('aiUsage')
      .withIndex('by_user_kind_window', (q) =>
        q.eq('userId', userId).eq('kind', kind).eq('windowStart', windowStart),
      )
      .unique();
    if (!row) return;
    await ctx.db.patch(row._id, {
      promptTokens: (row.promptTokens ?? 0) + promptTokens,
      outputTokens: (row.outputTokens ?? 0) + outputTokens,
      updatedAt: now,
    });
  },
});
