/**
 * Ban and suspension state. Kept free of other app imports because `shared/auth.ts` calls it
 * on every authenticated request.
 */
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

type Db = { db: QueryCtx['db'] };

export function isRestrictionActive(
  row: Pick<Doc<'accountRestrictions'>, 'liftedAt' | 'expiresAt'>,
  now: number,
): boolean {
  return row.liftedAt === undefined && (row.expiresAt === undefined || row.expiresAt > now);
}

/** The user's active ban or suspension (a ban wins over a suspension), or null. */
export async function activeRestriction(
  ctx: Db,
  userId: Id<'users'>,
  now = Date.now(),
): Promise<Doc<'accountRestrictions'> | null> {
  const rows = await ctx.db
    .query('accountRestrictions')
    .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
    .order('desc')
    .take(20);
  const active = rows.filter((row) => isRestrictionActive(row, now));
  return active.find((row) => row.kind === 'ban') ?? active[0] ?? null;
}
