/**
 * Trash: deleting a transaction, account, category, goal or recurring rule moves it here
 * (the record keeps `deletedAt` / `archivedAt`). Items can be restored or deleted for good;
 * a daily job deletes items older than the user's retention (Settings → Trash, default 30 days).
 * Budgets trashed before budgets became category limits stay listed; restoring one sets its
 * category's limit instead of bringing the budget back. Chat messages are not part of Trash.
 */
import { v } from 'convex/values';
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { getOptionalUser, requireUser } from './shared/auth';
import { recordSyncChange } from './sync/common';
import { formatMinor } from './shared/money';
import { foldBudgets } from './categories/fromBudgets';

export const TRASH_KINDS = [
  'transaction',
  'account',
  'category',
  'budget',
  'goal',
  'recurring',
] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];
export const TRASH_RETENTION_OPTIONS = [1, 7, 14, 30, 60, 90, 0] as const;
export const DEFAULT_TRASH_RETENTION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 200;

type TableOf = {
  transaction: 'transactions';
  account: 'accounts';
  category: 'categories';
  budget: 'budgets';
  goal: 'goals';
  recurring: 'recurringRules';
};
const TABLE: TableOf = {
  transaction: 'transactions',
  account: 'accounts',
  category: 'categories',
  budget: 'budgets',
  goal: 'goals',
  recurring: 'recurringRules',
};

const kindValidator = v.union(
  v.literal('transaction'),
  v.literal('account'),
  v.literal('category'),
  v.literal('budget'),
  v.literal('goal'),
  v.literal('recurring'),
);

export type TrashItem = {
  kind: TrashKind;
  id: string;
  title: string;
  subtitle: string;
  deletedAt: number;
  /** When it will be deleted for good; null when retention is "never". */
  purgeAt: number | null;
};

export async function retentionDays(ctx: QueryCtx, userId: Id<'users'>): Promise<number> {
  const settings = await ctx.db
    .query('userSettings')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  const days = settings?.trashRetentionDays;
  return typeof days === 'number' && days >= 0 ? days : DEFAULT_TRASH_RETENTION_DAYS;
}

const deletedAtOf = (kind: TrashKind, doc: Record<string, unknown>) =>
  Number((kind === 'transaction' ? doc.deletedAt : doc.archivedAt) ?? 0);

function describe(
  kind: TrashKind,
  doc: Record<string, unknown>,
): { title: string; subtitle: string } {
  switch (kind) {
    case 'transaction': {
      const amount =
        typeof doc.amountMinor === 'bigint' && typeof doc.currency === 'string'
          ? formatMinor(doc.amountMinor, doc.currency)
          : '';
      const when = new Date(Number(doc.occurredAt ?? 0)).toISOString().slice(0, 10);
      return {
        title: String(doc.title || doc.merchant || 'Transaction'),
        subtitle: [amount, String(doc.type ?? ''), when].filter(Boolean).join(' · '),
      };
    }
    case 'account':
      return {
        title: String(doc.name ?? 'Account'),
        subtitle: `Account · ${String(doc.currency ?? '')}`,
      };
    case 'category':
      return {
        title: String(doc.name ?? 'Category'),
        subtitle: `Category · ${String(doc.kind ?? 'expense')}`,
      };
    case 'budget':
      // Budgets are now category limits: restoring one sets its category's limit.
      return {
        title: String(doc.name ?? 'Budget'),
        subtitle: 'Budget · restores as a category limit',
      };
    case 'goal': {
      const target =
        typeof doc.targetAmountMinor === 'bigint' && typeof doc.currency === 'string'
          ? formatMinor(doc.targetAmountMinor, doc.currency)
          : '';
      return {
        title: String(doc.name ?? 'Goal'),
        subtitle: ['Goal', target].filter(Boolean).join(' · '),
      };
    }
    case 'recurring':
      return {
        title: String(doc.name ?? 'Recurring'),
        subtitle: `Recurring · ${String(doc.frequency ?? '')}`,
      };
  }
}

async function trashedOfKind(ctx: QueryCtx, userId: Id<'users'>, kind: TrashKind, limit: number) {
  if (kind === 'transaction')
    return ctx.db
      .query('transactions')
      .withIndex('by_owner_deletedAt', (q) => q.eq('ownerId', userId).gt('deletedAt', 0))
      .order('desc')
      .take(limit);
  const table = TABLE[kind] as 'accounts' | 'categories' | 'budgets' | 'goals' | 'recurringRules';
  return ctx.db
    .query(table)
    .withIndex('by_owner_archivedAt', (q) => q.eq('ownerId', userId).gt('archivedAt', 0))
    .order('desc')
    .take(limit);
}

/** Everything in your Trash, newest first, with when each item will be deleted for good. */
export const list = query({
  args: { kind: v.optional(kindValidator) },
  handler: async (ctx, { kind }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return { items: [] as TrashItem[], retentionDays: DEFAULT_TRASH_RETENTION_DAYS };
    const days = await retentionDays(ctx, user._id);
    const kinds = kind ? [kind] : TRASH_KINDS;
    const items: TrashItem[] = [];
    for (const each of kinds) {
      const rows = await trashedOfKind(ctx, user._id, each, LIST_LIMIT);
      for (const row of rows) {
        const doc = row as unknown as Record<string, unknown>;
        // Group expenses are deleted through the group, not Trash.
        if (each === 'transaction' && doc.groupId !== undefined) continue;
        const deletedAt = deletedAtOf(each, doc);
        items.push({
          kind: each,
          id: String(row._id),
          ...describe(each, doc),
          deletedAt,
          purgeAt: days > 0 ? deletedAt + days * DAY : null,
        });
      }
    }
    items.sort((a, b) => b.deletedAt - a.deletedAt);
    return { items: items.slice(0, LIST_LIMIT), retentionDays: days };
  },
});
/**
 * A bounded page across Trash tables. Each source is paged independently, then merged;
 * cursors advance only through rows included in the response.
 */
export const listPage = query({
  args: { kind: v.optional(kindValidator), cursor: v.optional(v.string()) },
  handler: async (ctx, { kind, cursor }) => {
    const user = await getOptionalUser(ctx);
    if (!user)
      return {
        items: [] as TrashItem[],
        retentionDays: DEFAULT_TRASH_RETENTION_DAYS,
        cursor: null,
      };
    const days = await retentionDays(ctx, user._id);
    let cursors: Partial<Record<TrashKind, string | null>> = {};
    if (cursor) {
      try {
        const parsed: unknown = JSON.parse(cursor);
        if (
          parsed &&
          typeof parsed === 'object' &&
          TRASH_KINDS.every((each) => {
            const value = (parsed as Record<string, unknown>)[each];
            return value === undefined || value === null || typeof value === 'string';
          })
        )
          cursors = parsed as Partial<Record<TrashKind, string | null>>;
      } catch {
        cursors = {};
      }
    }

    const kinds = kind ? [kind] : TRASH_KINDS;
    const pages = await Promise.all(
      kinds.map(async (each) => {
        const initialCursor = cursors[each] ?? null;
        const paginationOpts = { numItems: 40, cursor: initialCursor };
        const page =
          each === 'transaction'
            ? await ctx.db
                .query('transactions')
                .withIndex('by_owner_deletedAt', (q) =>
                  q.eq('ownerId', user._id).gt('deletedAt', 0),
                )
                .order('desc')
                .paginate(paginationOpts)
            : await ctx.db
                .query(TABLE[each] as 'accounts' | 'categories' | 'budgets' | 'goals' | 'recurringRules')
                .withIndex('by_owner_archivedAt', (q) =>
                  q.eq('ownerId', user._id).gt('archivedAt', 0),
                )
                .order('desc')
                .paginate(paginationOpts);
        const entries = page.page.flatMap((row, index) => {
          const doc = row as unknown as Record<string, unknown>;
          if (each === 'transaction' && doc.groupId !== undefined) return [];
          const deletedAt = deletedAtOf(each, doc);
          return [{
            item: {
              kind: each,
              id: String(row._id),
              ...describe(each, doc),
              deletedAt,
              purgeAt: days > 0 ? deletedAt + days * DAY : null,
            } satisfies TrashItem,
            index,
          }];
        });
        return { kind: each, page, entries, initialCursor };
      }),
    );

    const entries = pages
      .flatMap(({ entries }) => entries)
      .sort((a, b) => b.item.deletedAt - a.item.deletedAt);
    const selected = entries.slice(0, 40);
    const items = selected.map(({ item }) => item);
    const nextCursors: Partial<Record<TrashKind, string | null>> = {};
    await Promise.all(
      pages.map(async ({ kind: each, page, entries: sourceEntries, initialCursor }) => {
        const selectedEntries = selected.filter((entry) => entry.item.kind === each);
        const consumed = selectedEntries.length
          ? selectedEntries[selectedEntries.length - 1]!.index + 1
          : sourceEntries.length === 0
            ? page.page.length
            : 0;
        if (consumed === page.page.length) {
          nextCursors[each] = page.continueCursor;
        } else if (consumed === 0) {
          nextCursors[each] = initialCursor;
        } else {
          const advanced =
            each === 'transaction'
              ? await ctx.db
                  .query('transactions')
                  .withIndex('by_owner_deletedAt', (q) =>
                    q.eq('ownerId', user._id).gt('deletedAt', 0),
                  )
                  .order('desc')
                  .paginate({ numItems: consumed, cursor: initialCursor })
              : await ctx.db
                  .query(TABLE[each] as 'accounts' | 'categories' | 'budgets' | 'goals' | 'recurringRules')
                  .withIndex('by_owner_archivedAt', (q) =>
                    q.eq('ownerId', user._id).gt('archivedAt', 0),
                  )
                  .order('desc')
                  .paginate({ numItems: consumed, cursor: initialCursor });
          nextCursors[each] = advanced.continueCursor;
        }
      }),
    );
    const more = pages.some(({ page }) => !page.isDone) || entries.length > items.length;
    return {
      items,
      retentionDays: days,
      cursor: more ? JSON.stringify(nextCursors) : null,
    };
  },
});

export const setRetention = mutation({
  args: { days: v.number() },
  handler: async (ctx, { days }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    if (!(TRASH_RETENTION_OPTIONS as readonly number[]).includes(days))
      throw new Error('INVALID_RETENTION');
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    if (!settings) throw new Error('SETTINGS_NOT_FOUND');
    const now = Date.now();
    await ctx.db.patch(settings._id, { trashRetentionDays: days, updatedAt: now });
    const updated = await ctx.db.get(settings._id);
    await recordSyncChange(ctx, user._id, 'userSettings', String(settings._id), now, updated);
    return days;
  },
});

async function owned(ctx: QueryCtx, userId: Id<'users'>, kind: TrashKind, id: string) {
  const table = TABLE[kind];
  const docId = ctx.db.normalizeId(table, id);
  if (!docId) return null;
  const doc = (await ctx.db.get(docId)) as
    (Doc<TableOf[TrashKind]> & { ownerId: Id<'users'> }) | null;
  if (!doc || doc.ownerId !== userId) return null;
  return doc;
}

/** Moves a record out of Trash (and anything trashed together with it). */
export async function restoreItem(
  ctx: MutationCtx,
  userId: Id<'users'>,
  kind: TrashKind,
  id: string,
) {
  const doc = await owned(ctx, userId, kind, id);
  if (!doc) throw new Error('NOT_FOUND');
  const record = doc as unknown as Record<string, unknown>;
  if (!deletedAtOf(kind, record)) return { restored: 0 };
  if (kind === 'budget') {
    // Budgets were folded into category limits: bring it back as its category's limit.
    await foldBudgets(ctx, userId, [doc as Doc<'budgets'>], { includeTrashed: true });
    return { restored: 1 };
  }
  const now = Date.now();
  if (kind === 'transaction') {
    const account = await ctx.db.get(record.accountId as Id<'accounts'>);
    if (!account || account.archivedAt !== undefined) throw new Error('ACCOUNT_IN_TRASH');
  }
  const patch: Record<string, unknown> =
    kind === 'transaction'
      ? { deletedAt: undefined, deletedBy: undefined, trashedWith: undefined, updatedAt: now }
      : kind === 'recurring'
        ? {
            archivedAt: undefined,
            enabled: record.enabledBeforeTrash ?? true,
            enabledBeforeTrash: undefined,
            updatedAt: now,
          }
        : { archivedAt: undefined, updatedAt: now };
  await ctx.db.patch(doc._id, patch as never);
  const updated = await ctx.db.get(doc._id);
  await recordSyncChange(ctx, userId, TABLE[kind], String(doc._id), now, updated);
  let restored = 1;
  // A category or account brings back the transactions that were trashed with it.
  if (kind === 'category' || kind === 'account') {
    const companions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_deletedAt', (q) => q.eq('ownerId', userId).gt('deletedAt', 0))
      .collect();
    for (const row of companions) {
      if (row.trashedWith !== `${kind}:${String(doc._id)}`) continue;
      await ctx.db.patch(row._id, { deletedAt: undefined, trashedWith: undefined, updatedAt: now });
      await recordSyncChange(
        ctx,
        userId,
        'transactions',
        String(row._id),
        now,
        await ctx.db.get(row._id),
      );
      restored += 1;
    }
  }
  return { restored };
}

/** Deletes a trashed record for good (with dependents that can't exist without it). */
export async function purgeItem(
  ctx: MutationCtx,
  userId: Id<'users'>,
  kind: TrashKind,
  id: string,
) {
  const doc = await owned(ctx, userId, kind, id);
  if (!doc) return { purged: 0 };
  const record = doc as unknown as Record<string, unknown>;
  if (!deletedAtOf(kind, record)) throw new Error('NOT_IN_TRASH');
  const now = Date.now();
  let purged = 0;
  if (kind === 'account') {
    // An account's transactions can't outlive it.
    const rows = await ctx.db
      .query('transactions')
      .withIndex('by_account', (q) => q.eq('accountId', doc._id as Id<'accounts'>))
      .collect();
    for (const row of rows) {
      if (row.ownerId !== userId) continue;
      if (row.deletedAt === undefined)
        await recordSyncChange(
          ctx,
          userId,
          'transactions',
          String(row._id),
          now,
          { ...row, deletedAt: now },
          now,
        );
      await ctx.db.delete(row._id);
      purged += 1;
    }
  }
  if (kind === 'goal') {
    const contributions = await ctx.db
      .query('goalContributions')
      .withIndex('by_goal', (q) => q.eq('goalId', doc._id as Id<'goals'>))
      .collect();
    for (const row of contributions) {
      await recordSyncChange(
        ctx,
        userId,
        'goalContributions',
        String(row._id),
        now,
        undefined,
        now,
      );
      await ctx.db.delete(row._id);
    }
  }
  await recordSyncChange(
    ctx,
    userId,
    TABLE[kind],
    String(doc._id),
    now,
    { ...doc, purgedAt: now },
    now,
  );
  await ctx.db.delete(doc._id);
  return { purged: purged + 1 };
}

export const restore = mutation({
  args: { kind: kindValidator, id: v.string() },
  handler: async (ctx, { kind, id }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    return restoreItem(ctx, user._id, kind as TrashKind, id);
  },
});

export const purge = mutation({
  args: { kind: kindValidator, id: v.string() },
  handler: async (ctx, { kind, id }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    return purgeItem(ctx, user._id, kind as TrashKind, id);
  },
});

/** Deletes everything in Trash for good (up to 100 items per call; `more` asks for another). */
export const empty = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    let purged = 0;
    let more = false;
    for (const kind of TRASH_KINDS) {
      const rows = await trashedOfKind(ctx, user._id, kind, 100 - purged + 1);
      for (const row of rows) {
        if (purged >= 100) {
          more = true;
          break;
        }
        const doc = row as unknown as Record<string, unknown>;
        if (kind === 'transaction' && doc.groupId !== undefined) continue;
        await purgeItem(ctx, user._id, kind, String(row._id));
        purged += 1;
      }
      if (more) break;
    }
    return { purged, more };
  },
});

/** Daily: deletes items whose owner's retention has passed. Reschedules itself while busy. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - DAY; // the shortest retention is one day
    const retention = new Map<string, number>();
    let processed = 0;
    for (const kind of TRASH_KINDS) {
      const rows =
        kind === 'transaction'
          ? await ctx.db
              .query('transactions')
              .withIndex('by_deletedAt', (q) => q.gt('deletedAt', 0).lt('deletedAt', cutoff))
              .take(100)
          : await ctx.db
              .query(
                TABLE[kind] as 'accounts' | 'categories' | 'budgets' | 'goals' | 'recurringRules',
              )
              .withIndex('by_archivedAt', (q) => q.gt('archivedAt', 0).lt('archivedAt', cutoff))
              .take(100);
      for (const row of rows) {
        const doc = row as unknown as Record<string, unknown>;
        if (kind === 'transaction' && doc.groupId !== undefined) continue;
        const owner = String(doc.ownerId);
        if (!retention.has(owner))
          retention.set(owner, await retentionDays(ctx, doc.ownerId as Id<'users'>));
        const days = retention.get(owner)!;
        if (days <= 0 || deletedAtOf(kind, doc) > now - days * DAY) continue;
        await purgeItem(ctx, doc.ownerId as Id<'users'>, kind, String(row._id));
        processed += 1;
        if (processed >= 200) break;
      }
      if (processed >= 200) break;
    }
    if (processed >= 200) await ctx.scheduler.runAfter(1000, internal.trash.purgeExpired, {});
    return { processed };
  },
});
