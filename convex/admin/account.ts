/**
 * The user-facing side of moderation and the sign-in hooks:
 * - `status`: whether the signed-in account is suspended or banned (drives the app's
 *   "account suspended" screen; works for restricted accounts on purpose).
 * - `beforeSignIn` / `recordSignIn`: called from convex/auth.ts so restricted accounts can't
 *   sign in and sign-ins (and failures, by salted hash only) land in the security log.
 */
import { v } from 'convex/values';
import { internalMutation, internalQuery, query } from '../_generated/server';
import { getIdentityUser } from '../shared/auth';
import { cryptoContext, decryptOrPlaceholder, hashIdentifier } from './crypto';
import { recordSecurityEvent } from './guard';
import { activeRestriction } from './restrictions';
import { trackUsage } from './usage';

export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await getIdentityUser(ctx);
    if (!user) return null;
    const restriction = await activeRestriction(ctx, user._id);
    if (!restriction) return { state: 'active' as const };
    return {
      state: restriction.kind === 'ban' ? ('banned' as const) : ('suspended' as const),
      reason: await decryptOrPlaceholder(
        restriction.reason,
        cryptoContext.restriction(String(user._id)),
      ),
      since: restriction.createdAt,
      expiresAt: restriction.expiresAt ?? null,
    };
  },
});

/** Whether a user may sign in (no active ban or suspension). */
export const signInAllowed = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => !(await activeRestriction(ctx, userId)),
});

/**
 * Security log entry for a sign-in attempt. Failed attempts store a salted hash of the typed
 * identifier (never the identifier or password) and the user id only when it resolves.
 */
export const recordSignIn = internalMutation({
  args: {
    userId: v.optional(v.id('users')),
    ok: v.boolean(),
    identifier: v.optional(v.string()),
    blocked: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, ok, identifier, blocked }) => {
    let identifierHash: string | undefined;
    if (identifier) {
      try {
        identifierHash = await hashIdentifier(identifier);
      } catch {
        identifierHash = undefined;
      }
    }
    let resolved = userId;
    if (!resolved && identifier) {
      const value = identifier.trim().toLowerCase();
      const byEmail = await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', value))
        .unique();
      const byUsername = byEmail
        ? null
        : await ctx.db
            .query('users')
            .withIndex('by_username', (q) => q.eq('username', value.replace(/^@+/, '')))
            .unique();
      resolved = (byEmail ?? byUsername)?._id;
    }
    await recordSecurityEvent(ctx, {
      kind: blocked ? 'signin.blocked' : ok ? 'signin.success' : 'signin.failed',
      ...(resolved ? { userId: resolved } : {}),
      ...(identifierHash ? { identifierHash } : {}),
    });
    if (ok && resolved) await trackUsage(ctx, resolved, 'session.start');
    return null;
  },
});
