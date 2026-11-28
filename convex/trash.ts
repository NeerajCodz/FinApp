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
  if (kind === 'transaction') {
    return ctx.db
      .query('transactions')
      .withIndex('by_owner_groupId_deletedAt', (q) =>
        q.eq('ownerId', userId).eq('groupId', undefined).gt('deletedAt', 0),
      )
      .order('desc')
      .take(limit);
  }
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

const RESTORE_COMPANION_PAGE_SIZE = 50;
const ACCOUNT_TRANSACTION_PAGE_SIZE = 20;
const EXPIRY_PAGE_SIZE = 25;

type CompanionKind = 'account' | 'category';

async function restoreCompanionPage(
  ctx: MutationCtx,
  userId: Id<'users'>,
  kind: CompanionKind,
  parentId: string,
  cursor: string | null,
  now: number,
) {
  const table = kind === 'category' ? 'categories' : 'accounts';
  const normalizedId = ctx.db.normalizeId(table, parentId);
  if (!normalizedId) return 0;
  const parent = await ctx.db.get(normalizedId);
  if (!parent || parent.ownerId !== userId || parent.archivedAt !== undefined) return 0;
  const marker = `${kind}:${parentId}`;
  const page = await ctx.db
    .query('transactions')
    .withIndex('by_owner_trashedWith', (q) => q.eq('ownerId', userId).eq('trashedWith', marker))
    .paginate({ numItems: RESTORE_COMPANION_PAGE_SIZE, cursor });
  let restored = 0;
  for (const row of page.page) {
    if (row.deletedAt === undefined) continue;
    const account = await ctx.db.get(row.accountId);
    if (!account || account.ownerId !== userId || account.archivedAt !== undefined) continue;
    await ctx.db.patch(row._id, {
      deletedAt: undefined,
      trashedWith: undefined,
      updatedAt: now,
    });
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
  if (!page.isDone)
    await ctx.scheduler.runAfter(0, internal.trash.continueRestoreCompanions, {
      userId,
      kind,
      parentId,
      cursor: page.continueCursor,
      now,
    });
  return restored;
}

export const continueRestoreCompanions = internalMutation({
  args: {
    userId: v.id('users'),
    kind: v.union(v.literal('account'), v.literal('category')),
    parentId: v.string(),
    cursor: v.union(v.string(), v.null()),
    now: v.number(),
  },
  handler: async (ctx, args) =>
    restoreCompanionPage(ctx, args.userId, args.kind, args.parentId, args.cursor, args.now),
});

async function purgeTransaction(
  ctx: MutationCtx,
  userId: Id<'users'>,
  transaction: Doc<'transactions'>,
  now: number,
) {
  const tags = await ctx.db
    .query('transactionTags')
    .withIndex('by_transaction', (q) => q.eq('transactionId', transaction._id))
    .collect();
  for (const tag of tags) {
    await recordSyncChange(ctx, userId, 'transactionTags', String(tag._id), now, undefined, now);
    await ctx.db.delete(tag._id);
  }
  const receipts = await ctx.db
    .query('receipts')
    .withIndex('by_transaction', (q) => q.eq('transactionId', transaction._id))
    .collect();
  for (const receipt of receipts) {
    await recordSyncChange(
      ctx,
      receipt.ownerId,
      'receipts',
      String(receipt._id),
      now,
      undefined,
      now,
    );
    if (await ctx.db.system.get('_storage', receipt.storageId))
      await ctx.storage.delete(receipt.storageId);
    await ctx.db.delete(receipt._id);
  }
  await recordSyncChange(ctx, userId, 'transactions', String(transaction._id), now, undefined, now);
  await ctx.db.delete(transaction._id);
}

type AccountPurgePage = {
  userId: Id<'users'>;
  accountId: Id<'accounts'>;
  phase: 'source' | 'transfer';
  cursor: string | null;
  now: number;
};

async function purgeAccountPage(ctx: MutationCtx, args: AccountPurgePage) {
  const account = await ctx.db.get(args.accountId);
  if (!account || account.ownerId !== args.userId || account.archivedAt === undefined)
    return { purged: 0, done: true };
  const page =
    args.phase === 'source'
      ? await ctx.db
          .query('transactions')
          .withIndex('by_account', (q) => q.eq('accountId', args.accountId))
          .paginate({ numItems: ACCOUNT_TRANSACTION_PAGE_SIZE, cursor: args.cursor })
      : await ctx.db
          .query('transactions')
          .withIndex('by_transferAccountId', (q) =>
            q.eq('transferAccountId', String(args.accountId)),
          )
          .paginate({ numItems: ACCOUNT_TRANSACTION_PAGE_SIZE, cursor: args.cursor });
  let purged = 0;
  for (const row of page.page) {
    if (row.ownerId !== args.userId || row.groupId !== undefined) continue;
    await purgeTransaction(ctx, args.userId, row, args.now);
    purged += 1;
  }
  if (!page.isDone || args.phase === 'source') {
    const phase = page.isDone ? 'transfer' : args.phase;
    await ctx.scheduler.runAfter(0, internal.trash.continueAccountPurge, {
      ...args,
      phase,
      cursor: page.isDone ? null : page.continueCursor,
    });
    return { purged, done: false };
  }
  await recordSyncChange(
    ctx,
    args.userId,
    'accounts',
    String(account._id),
    args.now,
    { ...account, purgedAt: args.now },
    args.now,
  );
  await ctx.db.delete(account._id);
  return { purged, done: true };
}

export const continueAccountPurge = internalMutation({
  args: {
    userId: v.id('users'),
    accountId: v.id('accounts'),
    phase: v.union(v.literal('source'), v.literal('transfer')),
    cursor: v.union(v.string(), v.null()),
    now: v.number(),
  },
  handler: async (ctx, args) => purgeAccountPage(ctx, args),
});

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
  if (kind === 'transaction' && record.groupId !== undefined) throw new Error('NOT_IN_TRASH');
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
  if (kind === 'account' && record.purgingAt !== undefined) throw new Error('PURGE_IN_PROGRESS');
  const category = kind === 'category' ? (doc as Doc<'categories'>) : null;
  const accountRecord = kind === 'account' ? (doc as Doc<'accounts'>) : null;
  const user =
    (category && (category.restoreDefaultExpense || category.restoreDefaultIncome)) ||
    (accountRecord?.restoreDefaultAccount ?? false)
      ? await ctx.db.get(userId)
      : null;
  const restoreDefaultExpense =
    category?.restoreDefaultExpense === true && user?.defaultExpenseCategoryId === undefined;
  const restoreDefaultIncome =
    category?.restoreDefaultIncome === true && user?.defaultIncomeCategoryId === undefined;
  const restoreDefaultAccount =
    accountRecord?.restoreDefaultAccount === true && user?.defaultAccountId === undefined;
  const patch: Record<string, unknown> =
    kind === 'transaction'
      ? { deletedAt: undefined, deletedBy: undefined, trashedWith: undefined, updatedAt: now }
      : kind === 'recurring'
        ? {
            archivedAt: undefined,
            trashedAt: undefined,
            enabled: record.enabledBeforeTrash ?? true,
            enabledBeforeTrash: undefined,
            updatedAt: now,
          }
        : kind === 'category'
          ? {
              archivedAt: undefined,
              trashedAt: undefined,
              restoreDefaultExpense: undefined,
              restoreDefaultIncome: undefined,
              updatedAt: now,
            }
          : {
              archivedAt: undefined,
              trashedAt: undefined,
              purgingAt: undefined,
              restoreDefaultAccount: undefined,
              updatedAt: now,
            };
  await ctx.db.patch(doc._id, patch as never);
  const updated = await ctx.db.get(doc._id);
  await recordSyncChange(ctx, userId, TABLE[kind], String(doc._id), now, updated);
  if (user && (restoreDefaultExpense || restoreDefaultIncome || restoreDefaultAccount)) {
    const defaults = {
      ...(restoreDefaultExpense ? { defaultExpenseCategoryId: category!._id } : {}),
      ...(restoreDefaultIncome ? { defaultIncomeCategoryId: category!._id } : {}),
      ...(restoreDefaultAccount ? { defaultAccountId: accountRecord!._id } : {}),
      updatedAt: now,
    };
    await ctx.db.patch(user._id, defaults);
    await recordSyncChange(ctx, userId, 'users', String(user._id), now, { ...user, ...defaults });
  }
  let restored = 1;
  if (kind === 'category' || kind === 'account') {
    restored += await restoreCompanionPage(ctx, userId, kind, String(doc._id), null, now);
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
  if (!deletedAtOf(kind, record) || (kind === 'transaction' && record.groupId !== undefined))
    throw new Error('NOT_IN_TRASH');
  const now = Date.now();
  if (kind === 'transaction') {
    await purgeTransaction(ctx, userId, doc as Doc<'transactions'>, now);
    return { purged: 1 };
  }
  if (kind === 'account') {
    if (record.purgingAt !== undefined) return { purged: 0, more: true };
    const accountId = doc._id as Id<'accounts'>;
    const [sourceGroup, transferGroup] = await Promise.all([
      ctx.db
        .query('transactions')
        .withIndex('by_account_deletedAt_groupId', (q) =>
          q.eq('accountId', accountId).eq('deletedAt', undefined).gt('groupId', ''),
        )
        .first(),
      ctx.db
        .query('transactions')
        .withIndex('by_transferAccountId_deletedAt_groupId', (q) =>
          q.eq('transferAccountId', String(accountId)).eq('deletedAt', undefined).gt('groupId', ''),
        )
        .first(),
    ]);
    if (sourceGroup || transferGroup) throw new Error('ACCOUNT_IN_USE_BY_GROUP_EXPENSE');
    await ctx.db.patch(accountId, { purgingAt: now, updatedAt: now });
    const result = await purgeAccountPage(ctx, {
      userId,
      accountId,
      phase: 'source',
      cursor: null,
      now,
    });
    return { purged: result.purged + 1, more: !result.done };
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
  return { purged: 1 };
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
        const result = await purgeItem(ctx, user._id, kind, String(row._id));
        purged += 1;
        if ('more' in result && result.more) {
          more = true;
          break;
        }
      }
      if (more) break;
    }
    return { purged, more };
  },
});

/** Daily: deletes items whose owner's retention has passed, paging past retained items. */
export const purgeExpired = internalMutation({
  args: {
    kindIndex: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { kindIndex = 0, cursor = null }) => {
    const now = Date.now();
    const cutoff = now - DAY; // the shortest retention is one day
    const retention = new Map<string, number>();
    const kind = TRASH_KINDS[kindIndex];
    if (!kind) return { processed: 0 };
    const page =
      kind === 'transaction'
        ? await ctx.db
            .query('transactions')
            .withIndex('by_deletedAt', (q) => q.gt('deletedAt', 0).lt('deletedAt', cutoff))
            .paginate({ numItems: EXPIRY_PAGE_SIZE, cursor })
        : await ctx.db
            .query(
              TABLE[kind] as 'accounts' | 'categories' | 'budgets' | 'goals' | 'recurringRules',
            )
            .withIndex('by_archivedAt', (q) => q.gt('archivedAt', 0).lt('archivedAt', cutoff))
            .paginate({ numItems: EXPIRY_PAGE_SIZE, cursor });
    let processed = 0;
    for (const row of page.page) {
      const doc = row as unknown as Record<string, unknown>;
      if (kind === 'transaction' && doc.groupId !== undefined) continue;
      // Legacy archives have no Trash marker and remain indefinite.
      if (kind !== 'transaction' && typeof doc.trashedAt !== 'number') continue;
      const owner = String(doc.ownerId);
      if (!retention.has(owner))
        retention.set(owner, await retentionDays(ctx, doc.ownerId as Id<'users'>));
      const days = retention.get(owner)!;
      if (days <= 0 || deletedAtOf(kind, doc) > now - days * DAY) continue;
      await purgeItem(ctx, doc.ownerId as Id<'users'>, kind, String(row._id));
      processed += 1;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(1000, internal.trash.purgeExpired, {
        kindIndex,
        cursor: page.continueCursor,
      });
    } else if (kindIndex + 1 < TRASH_KINDS.length) {
      await ctx.scheduler.runAfter(1000, internal.trash.purgeExpired, {
        kindIndex: kindIndex + 1,
        cursor: null,
      });
    }
    return { processed };
  },
});
