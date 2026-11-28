import { query } from '../_generated/server';
import { getOptionalUser } from '../shared/auth';
import { MAX_ACTIVE_TOKENS } from '../publicApi/principal';

/** Your personal access tokens: metadata only (never the token or its digest). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) return { tokens: [], limit: MAX_ACTIVE_TOKENS };
    const now = Date.now();
    const rows = await ctx.db
      .query('personalAccessTokens')
      .withIndex('by_user_createdAt', (index) => index.eq('userId', user._id))
      .order('desc')
      .take(100);
    return {
      limit: MAX_ACTIVE_TOKENS,
      tokens: rows.map((row) => ({
        id: row._id,
        name: row.name,
        tokenPrefix: row.tokenPrefix,
        scopes: row.scopes,
        createdAt: row.createdAt,
        regeneratedAt: row.regeneratedAt,
        expiresAt: row.expiresAt,
        lastUsedAt: row.lastUsedAt,
        lastUsedIpFingerprint: row.lastUsedIpHash?.slice(0, 8),
        revokedAt: row.revokedAt,
        status:
          row.revokedAt !== undefined
            ? ('revoked' as const)
            : row.expiresAt !== undefined && row.expiresAt <= now
              ? ('expired' as const)
              : ('active' as const),
      })),
    };
  },
});
