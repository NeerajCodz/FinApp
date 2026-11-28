import { v } from 'convex/values';
import { internalMutation, query, type MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { getOptionalUser } from '../shared/auth';

/** Developer audit retention; older events are removed by the hourly maintenance job. */
export const AUDIT_RETENTION_MS = 30 * 86_400_000;

export type AuditEntry = {
  kind: string;
  actorType: Doc<'developerAuditEvents'>['actorType'];
  tokenId?: Id<'personalAccessTokens'>;
  appId?: Id<'developerApps'>;
  grantId?: Id<'developerAppGrants'>;
  label?: string;
  method?: string;
  route?: string;
  status?: number;
  ipHash?: string;
};

/** Records usage metadata only: never tokens, bodies, query strings or IP addresses. */
export async function recordAudit(ctx: MutationCtx, userId: Id<'users'>, entry: AuditEntry) {
  await ctx.db.insert('developerAuditEvents', {
    userId,
    ...Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined)),
    kind: entry.kind,
    actorType: entry.actorType,
    createdAt: Date.now(),
  });
}

/** Scheduled by the HTTP gateway after each API response. */
export const recordRequest = internalMutation({
  args: {
    userId: v.id('users'),
    actorType: v.union(v.literal('pat'), v.literal('app')),
    tokenId: v.optional(v.id('personalAccessTokens')),
    grantId: v.optional(v.id('developerAppGrants')),
    appId: v.optional(v.id('developerApps')),
    label: v.optional(v.string()),
    method: v.string(),
    route: v.string(),
    status: v.number(),
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, { userId, ...entry }) => {
    await recordAudit(ctx, userId, { kind: 'api.request', ...entry });
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    kind: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) return [];
    const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 50)));
    const rows = await ctx.db
      .query('developerAuditEvents')
      .withIndex('by_user_createdAt', (index) => index.eq('userId', user._id))
      .order('desc')
      .take(args.kind ? 500 : limit);
    return rows
      .filter((row) => !args.kind || row.kind.startsWith(args.kind))
      .slice(0, limit)
      .map((row) => ({
        id: row._id,
        kind: row.kind,
        actorType: row.actorType,
        label: row.label,
        method: row.method,
        route: row.route,
        status: row.status,
        ipFingerprint: row.ipHash?.slice(0, 8),
        createdAt: row.createdAt,
      }));
  },
});
