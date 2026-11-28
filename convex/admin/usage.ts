/**
 * Usage instrumentation. Call sites pass an event kind only:
 *
 *   await trackUsage(ctx, userId, 'transaction.create');
 *
 * which bumps the global daily counter (sharded), the user's daily counter for that metric and
 * the user's last-active time. Unknown metrics are ignored, and tracking never throws into the
 * caller's mutation. Rollups and pruning run from the daily cron below.
 */
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { internalMutation, type MutationCtx } from '../_generated/server';
import {
  dayStart,
  DAY_MS,
  isAggregateMetric,
  isFeatureMetric,
  metricForOperation,
  shardFor,
  type AggregateMetric,
  type FeatureMetric,
} from './usageMetrics';

const ACTIVE_TOUCH_MS = 5 * 60_000;

async function bumpGlobal(ctx: MutationCtx, metric: string, shardKey: string, amount: number) {
  if (!(amount > 0) || !Number.isFinite(amount)) return;
  const now = Date.now();
  const day = dayStart(now);
  const shard = shardFor(shardKey);
  const row = await ctx.db
    .query('usageDaily')
    .withIndex('by_metric_day_shard', (q) =>
      q.eq('metric', metric).eq('day', day).eq('shard', shard),
    )
    .unique();
  if (row) await ctx.db.patch(row._id, { count: row.count + amount, updatedAt: now });
  else await ctx.db.insert('usageDaily', { metric, day, shard, count: amount, updatedAt: now });
}

async function bumpUser(ctx: MutationCtx, userId: Id<'users'>, metric: FeatureMetric) {
  const day = dayStart(Date.now());
  const row = await ctx.db
    .query('userUsageDaily')
    .withIndex('by_user_metric_day', (q) =>
      q.eq('userId', userId).eq('metric', metric).eq('day', day),
    )
    .unique();
  if (row) await ctx.db.patch(row._id, { count: row.count + 1 });
  else await ctx.db.insert('userUsageDaily', { userId, metric, day, count: 1 });
}

/**
 * Marks the user active now (and on `platform`). The first activity of a UTC day also counts
 * the user once toward that day's active users.
 */
export async function trackActive(ctx: MutationCtx, userId: Id<'users'>, platform?: string) {
  try {
    const now = Date.now();
    const today = dayStart(now);
    const row = await ctx.db
      .query('userActivity')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!row) {
      await ctx.db.insert('userActivity', {
        userId,
        firstSeenAt: now,
        lastActiveAt: now,
        lastActiveDay: today,
        ...(platform ? { lastPlatform: platform } : {}),
      });
    } else if (
      row.lastActiveDay !== today ||
      now - row.lastActiveAt > ACTIVE_TOUCH_MS ||
      (platform && row.lastPlatform !== platform)
    ) {
      await ctx.db.patch(row._id, {
        lastActiveAt: now,
        lastActiveDay: today,
        ...(platform ? { lastPlatform: platform } : {}),
      });
    }
    if (!row || row.lastActiveDay !== today) {
      await bumpGlobal(ctx, 'app.active', String(userId), 1);
      await bumpUser(ctx, userId, 'app.active');
    }
  } catch {
    // Instrumentation must never break the caller.
  }
}

/** Counts one event of a whitelisted feature metric for the user. Payloads are never taken. */
export async function trackUsage(ctx: MutationCtx, userId: Id<'users'>, metric: string) {
  if (!isFeatureMetric(metric)) return;
  try {
    await bumpGlobal(ctx, metric, String(userId), 1);
    await bumpUser(ctx, userId, metric);
    await trackActive(ctx, userId);
  } catch {
    // Instrumentation must never break the caller.
  }
}

/** `trackUsage` for a sync operation name (`'account.rename'` …); uncounted ones are ignored. */
export async function trackOperation(ctx: MutationCtx, userId: Id<'users'>, operation: string) {
  const metric = metricForOperation(operation);
  if (metric) await trackUsage(ctx, userId, metric);
}

/** Adds to an aggregate metric (bytes, tokens). */
export async function trackAmount(
  ctx: MutationCtx,
  metric: AggregateMetric,
  amount: number,
  shardKey = 'global',
) {
  if (!isAggregateMetric(metric)) return;
  try {
    await bumpGlobal(ctx, metric, shardKey, amount);
  } catch {
    // Instrumentation must never break the caller.
  }
}

/** Counts an upload by size (bandwidth); the file itself is never read. */
export async function trackUpload(ctx: MutationCtx, userId: Id<'users'>, bytes: number) {
  if (!(bytes > 0)) return;
  await trackAmount(ctx, 'upload.bytes', bytes, String(userId));
  await trackAmount(ctx, 'upload.files', 1, String(userId));
}

/** One more activity on a group today (a message or a ledger event; never their content). */
export async function trackGroupActivity(ctx: MutationCtx, groupId: Id<'groups'>) {
  try {
    const day = dayStart(Date.now());
    const row = await ctx.db
      .query('groupActivityDaily')
      .withIndex('by_group_day', (q) => q.eq('groupId', groupId).eq('day', day))
      .unique();
    if (row) await ctx.db.patch(row._id, { count: row.count + 1 });
    else await ctx.db.insert('groupActivityDaily', { groupId, day, count: 1 });
  } catch {
    // Instrumentation must never break the caller.
  }
}

// ---------- Rollups and retention ----------

export const RETENTION = {
  userUsageDays: 120,
  groupActivityDays: 120,
  usageDailyDays: 730,
  securityEventDays: 365,
} as const;

const BATCH = 500;

async function setSnapshot(ctx: MutationCtx, metric: AggregateMetric, value: number) {
  const day = dayStart(Date.now());
  const rows = await ctx.db
    .query('usageDaily')
    .withIndex('by_metric_day_shard', (q) => q.eq('metric', metric).eq('day', day))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
  await ctx.db.insert('usageDaily', { metric, day, shard: 0, count: value, updatedAt: Date.now() });
}

/**
 * Daily snapshot of storage (sum of `_storage` sizes) and total users, walked in pages so it
 * stays inside one mutation's read limits.
 */
export const snapshotStorage = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    bytes: v.optional(v.number()),
    files: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, bytes = 0, files = 0 }) => {
    const page = await ctx.db.system
      .query('_storage')
      .paginate({ cursor: cursor ?? null, numItems: BATCH });
    for (const file of page.page) {
      bytes += file.size;
      files += 1;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.admin.usage.snapshotStorage, {
        cursor: page.continueCursor,
        bytes,
        files,
      });
      return null;
    }
    await setSnapshot(ctx, 'storage.bytes', bytes);
    await setSnapshot(ctx, 'storage.files', files);
    await ctx.scheduler.runAfter(0, internal.admin.usage.snapshotUsers, {});
    return null;
  },
});

export const snapshotUsers = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())), total: v.optional(v.number()) },
  handler: async (ctx, { cursor, total = 0 }) => {
    const page = await ctx.db.query('users').paginate({ cursor: cursor ?? null, numItems: BATCH });
    total += page.page.filter((user) => user.deletedAt === undefined).length;
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.admin.usage.snapshotUsers, {
        cursor: page.continueCursor,
        total,
      });
      return null;
    }
    await setSnapshot(ctx, 'users.total', total);
    return null;
  },
});

/** Deletes counters and events past retention, a batch at a time. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let more = false;
    const sweep = async <T extends { _id: Id<any> }>(rows: T[]) => {
      for (const row of rows) await ctx.db.delete(row._id);
      if (rows.length === BATCH) more = true;
    };
    await sweep(
      await ctx.db
        .query('userUsageDaily')
        .withIndex('by_day', (q) => q.lt('day', now - RETENTION.userUsageDays * DAY_MS))
        .take(BATCH),
    );
    await sweep(
      await ctx.db
        .query('groupActivityDaily')
        .withIndex('by_day', (q) => q.lt('day', now - RETENTION.groupActivityDays * DAY_MS))
        .take(BATCH),
    );
    await sweep(
      await ctx.db
        .query('usageDaily')
        .withIndex('by_day', (q) => q.lt('day', now - RETENTION.usageDailyDays * DAY_MS))
        .take(BATCH),
    );
    await sweep(
      await ctx.db
        .query('securityEvents')
        .withIndex('by_createdAt', (q) =>
          q.lt('createdAt', now - RETENTION.securityEventDays * DAY_MS),
        )
        .take(BATCH),
    );
    if (more) await ctx.scheduler.runAfter(0, internal.admin.usage.prune, {});
    return null;
  },
});

/** Cron entry point: prune, then snapshot storage and users. */
export const dailyRollup = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.admin.usage.prune, {});
    await ctx.scheduler.runAfter(0, internal.admin.usage.snapshotStorage, {});
    return null;
  },
});
