/**
 * Admin analytics: counts, rates, bytes and tokens only. Built from the usage counters
 * (./usage.ts), user/group metadata and security events. Never reads finance tables' content.
 */
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { query, type QueryCtx } from '../_generated/server';
import { requireAdminPermission, userCard } from './guard';
import {
  AGGREGATE_METRICS,
  dayStart,
  DAY_MS,
  FEATURE_METRICS,
  isFeatureMetric,
  isUsageMetric,
  type UsageMetric,
} from './usageMetrics';

const MAX_DAYS = 365;

function clampDays(days: number | undefined, fallback = 30) {
  return Math.min(MAX_DAYS, Math.max(1, Math.round(days ?? fallback)));
}

/** Sums of a metric per day (shards added up) for the last `days` days, oldest first. */
async function series(ctx: QueryCtx, metric: UsageMetric, days: number) {
  const today = dayStart(Date.now());
  const since = today - (days - 1) * DAY_MS;
  const rows = await ctx.db
    .query('usageDaily')
    .withIndex('by_metric_day_shard', (q) => q.eq('metric', metric).gte('day', since))
    .collect();
  const byDay = new Map<number, number>();
  for (const row of rows) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.count);
  return Array.from({ length: days }, (_, index) => {
    const day = since + index * DAY_MS;
    return { day, value: byDay.get(day) ?? 0 };
  });
}

/** Latest value of a daily snapshot metric (storage, users). */
async function latestSnapshot(ctx: QueryCtx, metric: UsageMetric) {
  const row = await ctx.db
    .query('usageDaily')
    .withIndex('by_metric_day_shard', (q) => q.eq('metric', metric))
    .order('desc')
    .first();
  return row ? { value: row.count, day: row.day } : null;
}

async function activeSince(ctx: QueryCtx, since: number) {
  const rows = await ctx.db
    .query('userActivity')
    .withIndex('by_lastActiveAt', (q) => q.gte('lastActiveAt', since))
    .collect();
  return rows;
}

async function signupsSince(ctx: QueryCtx, since: number) {
  const rows = await ctx.db
    .query('users')
    .withIndex('by_creation_time', (q) => q.gte('_creationTime', since))
    .collect();
  return rows.filter((user) => user.deletedAt === undefined && user.isAnonymous !== true);
}

const sum = (points: { value: number }[]) =>
  points.reduce((total, point) => total + point.value, 0);

/** Dashboard KPIs. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const now = Date.now();
    const [dau, wau, mau] = await Promise.all([
      activeSince(ctx, now - DAY_MS),
      activeSince(ctx, now - 7 * DAY_MS),
      activeSince(ctx, now - 30 * DAY_MS),
    ]);
    const signups30 = await signupsSince(ctx, now - 30 * DAY_MS);
    const signups7 = signups30.filter((user) => user._creationTime >= now - 7 * DAY_MS);
    const totalUsers = await latestSnapshot(ctx, 'users.total');
    const sessions = await series(ctx, 'session.start', 30);
    const aiChat = await series(ctx, 'ai.chat', 30);
    const mcp = await series(ctx, 'mcp.tool_call', 30);
    const storage = await latestSnapshot(ctx, 'storage.bytes');
    const openTickets = await ctx.db
      .query('supportTickets')
      .withIndex('by_status_updatedAt', (q) => q.eq('status', 'open'))
      .collect();
    const openReports = await ctx.db
      .query('reports')
      .withIndex('by_status_createdAt', (q) => q.eq('status', 'open'))
      .collect();
    return {
      totalUsers: totalUsers?.value ?? null,
      dau: dau.length,
      wau: wau.length,
      mau: mau.length,
      stickiness: mau.length ? dau.length / mau.length : 0,
      signups7: signups7.length,
      signups30: signups30.length,
      sessions30: sum(sessions),
      aiRequests30: sum(aiChat),
      mcpCalls30: sum(mcp),
      storageBytes: storage?.value ?? null,
      openTickets: openTickets.length,
      openReports: openReports.length,
    };
  },
});

/** Daily series for any whitelisted metric. */
export const timeSeries = query({
  args: { metrics: v.array(v.string()), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const days = clampDays(args.days);
    const metrics = args.metrics.filter(isUsageMetric).slice(0, 8);
    const all = await Promise.all(metrics.map((metric) => series(ctx, metric, days)));
    const start = dayStart(Date.now()) - (days - 1) * DAY_MS;
    return Array.from({ length: days }, (_, index) => {
      const point: Record<string, number> = { day: start + index * DAY_MS };
      metrics.forEach((metric, at) => (point[metric] = all[at]![index]!.value));
      return point;
    });
  },
});

/** Daily sign-ups and daily active users. */
export const growth = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const days = clampDays(args.days);
    const start = dayStart(Date.now()) - (days - 1) * DAY_MS;
    const signups = await signupsSince(ctx, start);
    const active = await series(ctx, 'app.active', days);
    const perDay = new Map<number, number>();
    for (const user of signups) {
      const day = dayStart(user._creationTime);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    return active.map((point) => ({
      day: point.day,
      active: point.value,
      signups: perDay.get(point.day) ?? 0,
    }));
  },
});

/** Feature adoption: events and distinct users per feature metric over `days`. */
export const featureAdoption = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const days = clampDays(args.days, 30);
    const since = dayStart(Date.now()) - (days - 1) * DAY_MS;
    const rows = await ctx.db
      .query('userUsageDaily')
      .withIndex('by_day', (q) => q.gte('day', since))
      .collect();
    const events = new Map<string, number>();
    const users = new Map<string, Set<string>>();
    const activeUsers = new Set<string>();
    for (const row of rows) {
      if (!isFeatureMetric(row.metric)) continue;
      if (row.metric === 'app.active') {
        activeUsers.add(String(row.userId));
        continue;
      }
      events.set(row.metric, (events.get(row.metric) ?? 0) + row.count);
      const set = users.get(row.metric) ?? new Set<string>();
      set.add(String(row.userId));
      users.set(row.metric, set);
    }
    const denominator = Math.max(1, activeUsers.size);
    return {
      activeUsers: activeUsers.size,
      metrics: Object.entries(FEATURE_METRICS)
        .filter(([metric]) => metric !== 'app.active')
        .map(([metric, meta]) => ({
          metric,
          label: meta.label,
          feature: meta.feature,
          events: events.get(metric) ?? 0,
          users: users.get(metric)?.size ?? 0,
          adoption: (users.get(metric)?.size ?? 0) / denominator,
        }))
        .sort((a, b) => b.events - a.events),
    };
  },
});

/** Platform split by users' last platform and by live sessions. */
export const platforms = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const now = Date.now();
    const active = await activeSince(ctx, now - 30 * DAY_MS);
    const byUser: Record<string, number> = {};
    for (const row of active) {
      const key = row.lastPlatform ?? 'unknown';
      byUser[key] = (byUser[key] ?? 0) + 1;
    }
    const devices = await ctx.db.query('sessionDevices').collect();
    const bySession: Record<string, number> = {};
    for (const device of devices) {
      if (now - device.lastSeenAt > 30 * DAY_MS) continue;
      bySession[device.platform] = (bySession[device.platform] ?? 0) + 1;
    }
    const toList = (record: Record<string, number>) =>
      Object.entries(record)
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count);
    return { users: toList(byUser), sessions: toList(bySession) };
  },
});

/**
 * Weekly retention cohorts: users who signed up in each of the last `weeks` weeks and the share
 * of them active in each following week (from the per-user `app.active` counter).
 */
export const retention = query({
  args: { weeks: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const weeks = Math.min(12, Math.max(2, Math.round(args.weeks ?? 8)));
    const WEEK = 7 * DAY_MS;
    const thisWeek = dayStart(Date.now()) - ((new Date().getUTCDay() + 6) % 7) * DAY_MS;
    const firstWeek = thisWeek - (weeks - 1) * WEEK;
    const signups = await signupsSince(ctx, firstWeek);
    const cohorts = [];
    for (let index = 0; index < weeks; index += 1) {
      const start = firstWeek + index * WEEK;
      const members = signups.filter(
        (user) => user._creationTime >= start && user._creationTime < start + WEEK,
      );
      const retained: number[] = [];
      for (let offset = 0; start + offset * WEEK <= thisWeek; offset += 1) {
        const from = start + offset * WEEK;
        let count = 0;
        for (const user of members) {
          const hit = await ctx.db
            .query('userUsageDaily')
            .withIndex('by_user_metric_day', (q) =>
              q
                .eq('userId', user._id)
                .eq('metric', 'app.active')
                .gte('day', from)
                .lt('day', from + WEEK),
            )
            .first();
          if (hit) count += 1;
        }
        retained.push(members.length ? count / members.length : 0);
      }
      cohorts.push({ week: start, size: members.length, retained });
    }
    return cohorts;
  },
});

/** Most active users by event count (usage counts only). */
export const topUsers = query({
  args: { days: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const days = clampDays(args.days, 30);
    const since = dayStart(Date.now()) - (days - 1) * DAY_MS;
    const rows = await ctx.db
      .query('userUsageDaily')
      .withIndex('by_day', (q) => q.gte('day', since))
      .collect();
    const totals = new Map<string, { events: number; days: Set<number> }>();
    for (const row of rows) {
      const entry = totals.get(String(row.userId)) ?? { events: 0, days: new Set<number>() };
      if (row.metric === 'app.active') entry.days.add(row.day);
      else entry.events += row.count;
      totals.set(String(row.userId), entry);
    }
    const top = [...totals.entries()]
      .sort((a, b) => b[1].events - a[1].events)
      .slice(0, Math.min(100, Math.max(1, args.limit ?? 20)));
    return Promise.all(
      top.map(async ([userId, entry]) => ({
        user: await userCard(ctx, userId as Id<'users'>),
        events: entry.events,
        activeDays: entry.days.size,
      })),
    );
  },
});

/** AI and MCP usage: requests, tokens and connection counts. */
export const aiUsage = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const days = clampDays(args.days, 30);
    const metrics: UsageMetric[] = [
      'ai.chat',
      'ai.ocr',
      'ai.decision',
      'ai.utility',
      'ai.support',
      'ai.tokens.prompt',
      'ai.tokens.output',
      'mcp.tool_call',
    ];
    const all = await Promise.all(metrics.map((metric) => series(ctx, metric, days)));
    const points = all[0]!.map((point, index) => {
      const row: Record<string, number> = { day: point.day };
      metrics.forEach((metric, at) => (row[metric] = all[at]![index]!.value));
      return row;
    });
    const grants = await ctx.db.query('mcpOAuthGrants').collect();
    const clients = await ctx.db.query('mcpOAuthClients').collect();
    const byokKeys = await ctx.db.query('aiProviderKeys').collect();
    return {
      series: points,
      totals: Object.fromEntries(metrics.map((metric, at) => [metric, sum(all[at]!)])),
      mcp: {
        activeConnections: grants.filter((grant) => grant.revokedAt === undefined).length,
        connectedUsers: new Set(
          grants.filter((grant) => grant.revokedAt === undefined).map((grant) => grant.userId),
        ).size,
        clients: clients.length,
      },
      byok: {
        keys: byokKeys.length,
        activeKeys: byokKeys.filter((key) => key.active).length,
        providers: Object.entries(
          byokKeys.reduce<Record<string, number>>((acc, key) => {
            acc[key.provider] = (acc[key.provider] ?? 0) + 1;
            return acc;
          }, {}),
        ).map(([provider, count]) => ({ provider, count })),
      },
    };
  },
});

/** Bandwidth (upload bytes per day) and storage snapshots. */
export const storage = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    const days = clampDays(args.days, 30);
    const [uploadBytes, uploadFiles, storageBytes, storageFiles] = await Promise.all([
      series(ctx, 'upload.bytes', days),
      series(ctx, 'upload.files', days),
      series(ctx, 'storage.bytes', days),
      series(ctx, 'storage.files', days),
    ]);
    return {
      series: uploadBytes.map((point, index) => ({
        day: point.day,
        uploadBytes: point.value,
        uploadFiles: uploadFiles[index]!.value,
        storageBytes: storageBytes[index]!.value,
        storageFiles: storageFiles[index]!.value,
      })),
      uploadedBytes: sum(uploadBytes),
      uploadedFiles: sum(uploadFiles),
      storage: await latestSnapshot(ctx, 'storage.bytes'),
      files: await latestSnapshot(ctx, 'storage.files'),
    };
  },
});

/** Metric catalog (labels) for the console's pickers. */
export const metricCatalog = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, 'VIEW_ANALYTICS');
    return {
      features: Object.entries(FEATURE_METRICS).map(([metric, meta]) => ({ metric, ...meta })),
      aggregates: Object.entries(AGGREGATE_METRICS).map(([metric, meta]) => ({
        metric,
        ...meta,
      })),
    };
  },
});
