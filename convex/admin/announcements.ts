/**
 * System announcements (staff → every user) and console settings.
 */
import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import { adminError, logAdminAction, requireAdminPermission, userCard } from './guard';

const severity = v.union(v.literal('info'), v.literal('warning'), v.literal('critical'));
const TITLE_MAX = 120;
const BODY_MAX = 2000;

/** Announcements shown in the apps right now (public; no user data). */
export const active = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query('announcements')
      .withIndex('by_active_startsAt', (q) => q.eq('active', true).lte('startsAt', now))
      .order('desc')
      .take(10);
    return rows
      .filter((row) => row.endsAt === undefined || row.endsAt > now)
      .map((row) => ({
        id: row._id,
        title: row.title,
        body: row.body,
        severity: row.severity,
        startsAt: row.startsAt,
      }));
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, 'MANAGE_ANNOUNCEMENTS');
    const rows = await ctx.db.query('announcements').order('desc').take(100);
    return Promise.all(
      rows.map(async (row) => ({
        id: row._id,
        title: row.title,
        body: row.body,
        severity: row.severity,
        active: row.active,
        startsAt: row.startsAt,
        endsAt: row.endsAt ?? null,
        createdAt: row.createdAt,
        author: await userCard(ctx, row.createdBy),
      })),
    );
  },
});

function clean(title: string, body: string) {
  const t = title.trim();
  const b = body.trim();
  if (!t || t.length > TITLE_MAX || !b || b.length > BODY_MAX)
    throw adminError('ADMIN_ANNOUNCEMENT_INVALID');
  return { title: t, body: b };
}

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    severity,
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_ANNOUNCEMENTS');
    const now = Date.now();
    const startsAt = args.startsAt ?? now;
    if (args.endsAt !== undefined && args.endsAt <= startsAt)
      throw adminError('ADMIN_ANNOUNCEMENT_INVALID');
    const id = await ctx.db.insert('announcements', {
      ...clean(args.title, args.body),
      severity: args.severity,
      active: true,
      startsAt,
      ...(args.endsAt !== undefined ? { endsAt: args.endsAt } : {}),
      createdBy: admin.user._id,
      createdAt: now,
      updatedAt: now,
    });
    await logAdminAction(ctx, admin.user._id, 'announcement.create', 'announcement', String(id));
    return id;
  },
});

export const setActive = mutation({
  args: { announcementId: v.id('announcements'), active: v.boolean() },
  handler: async (ctx, { announcementId, active }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_ANNOUNCEMENTS');
    if (!(await ctx.db.get(announcementId))) throw adminError('ADMIN_NOT_FOUND');
    await ctx.db.patch(announcementId, { active, updatedAt: Date.now() });
    await logAdminAction(
      ctx,
      admin.user._id,
      active ? 'announcement.activate' : 'announcement.deactivate',
      'announcement',
      String(announcementId),
    );
    return null;
  },
});

export const remove = mutation({
  args: { announcementId: v.id('announcements') },
  handler: async (ctx, { announcementId }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_ANNOUNCEMENTS');
    if (!(await ctx.db.get(announcementId))) return null;
    await ctx.db.delete(announcementId);
    await logAdminAction(
      ctx,
      admin.user._id,
      'announcement.delete',
      'announcement',
      String(announcementId),
    );
    return null;
  },
});

// ---------- Console settings ----------

/** Known settings with their defaults; anything else is rejected. */
export const SETTING_DEFAULTS = {
  /** Staff other than owners need a second sign-in factor to use the console. */
  requireStaffMfa: false,
  /** AI triage, summaries and suggested replies on support tickets. */
  supportAi: true,
  /** Users can open new support tickets. */
  supportOpen: true,
} as const;

type SettingKey = keyof typeof SETTING_DEFAULTS;

export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, null);
    const rows = await ctx.db.query('adminSettings').collect();
    const values: Record<string, unknown> = { ...SETTING_DEFAULTS };
    for (const row of rows) if (row.key in SETTING_DEFAULTS) values[row.key] = row.value;
    return values as Record<SettingKey, boolean>;
  },
});

export const updateSetting = mutation({
  args: { key: v.string(), value: v.boolean() },
  handler: async (ctx, { key, value }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_SETTINGS');
    if (!(key in SETTING_DEFAULTS)) throw adminError('ADMIN_SETTING_UNKNOWN');
    const row = await ctx.db
      .query('adminSettings')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { value, updatedAt: now, updatedBy: admin.user._id });
    else
      await ctx.db.insert('adminSettings', {
        key,
        value,
        updatedAt: now,
        updatedBy: admin.user._id,
      });
    await logAdminAction(ctx, admin.user._id, 'settings.update', 'setting', key, String(value));
    return null;
  },
});
