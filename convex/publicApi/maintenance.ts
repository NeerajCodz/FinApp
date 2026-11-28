import { internalMutation } from '../_generated/server';
import { AUDIT_RETENTION_MS } from './audit';

const BATCH = 500;
const DELIVERY_RETENTION_MS = 30 * 86_400_000;
const IDLE_BUCKET_MS = 86_400_000;

/** Hourly: drops expired idempotency keys, codes, idle rate buckets and old logs. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const removed: Record<string, number> = {};
    const drop = async (table: string, rows: { _id: never }[]) => {
      for (const row of rows) await ctx.db.delete(row._id);
      removed[table] = rows.length;
    };
    await drop(
      'apiIdempotencyKeys',
      (await ctx.db
        .query('apiIdempotencyKeys')
        .withIndex('by_expiresAt', (index) => index.lt('expiresAt', now))
        .take(BATCH)) as never,
    );
    await drop(
      'developerAppCodes',
      (await ctx.db
        .query('developerAppCodes')
        .withIndex('by_expiresAt', (index) => index.lt('expiresAt', now - 3_600_000))
        .take(BATCH)) as never,
    );
    await drop(
      'apiRateLimits',
      (await ctx.db
        .query('apiRateLimits')
        .withIndex('by_updatedAt', (index) => index.lt('updatedAt', now - IDLE_BUCKET_MS))
        .take(BATCH)) as never,
    );
    await drop(
      'developerAuditEvents',
      (await ctx.db
        .query('developerAuditEvents')
        .withIndex('by_createdAt', (index) => index.lt('createdAt', now - AUDIT_RETENTION_MS))
        .take(BATCH)) as never,
    );
    await drop(
      'webhookDeliveries',
      (await ctx.db
        .query('webhookDeliveries')
        .withIndex('by_createdAt', (index) => index.lt('createdAt', now - DELIVERY_RETENTION_MS))
        .take(BATCH)) as never,
    );
    await drop(
      'webhookEvents',
      (await ctx.db
        .query('webhookEvents')
        .withIndex('by_createdAt', (index) => index.lt('createdAt', now - DELIVERY_RETENTION_MS))
        .take(BATCH)) as never,
    );
    return removed;
  },
});
