/**
 * Public API operations. Every read and write runs the same registered Convex function the apps
 * and the MCP server use, with the caller's identity, so domain validation and permission checks
 * apply unchanged. Only argument shaping and pagination live here.
 */
import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Id, TableNames } from '../_generated/dataModel';
import * as accountQueries from '../accounts/queries';
import * as accountMutations from '../accounts/mutations';
import * as transactionMutations from '../transactions/mutations';
import * as categoryQueries from '../categories/queries';
import * as categoryMutations from '../categories/mutations';
import * as goalMutations from '../goals/mutations';
import * as groupMutations from '../groups/mutations';
import * as groupQueries from '../groups/queries';
import * as settlementMutations from '../settlements/mutations';
import * as recurringMutations from '../recurring/mutations';
import * as userQueries from '../users/queries';
import * as analyticsQueries from '../analytics/queries';
import * as mcp from '../mcp';
import { safeExportRow } from '../export/domain';
import {
  decodeConvexCursor,
  decodeOffsetCursor,
  encodeConvexCursor,
  filterFingerprint,
  pageOfList,
} from './cursor';
import {
  createEndpoint,
  deleteEndpoint,
  emitWebhookEvent,
  endpointFor,
  listDeliveriesFor,
  listEndpointsFor,
  presentEndpoint,
  rotateEndpointSecret,
  updateEndpoint,
} from './webhooks';

export type Principal = {
  userId: Id<'users'>;
  /** Set for OAuth app tokens. */
  appId?: Id<'developerApps'>;
};

export type ApiInput = {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
};

export type OpResult =
  | { kind: 'item'; data: unknown }
  | { kind: 'list'; data: unknown[]; hasMore: boolean; nextCursor: string | null };

type Ctx = QueryCtx | MutationCtx;
type OpContext = {
  /** Context whose identity is the API caller; pass it to domain functions. */
  ctx: Ctx;
  principal: Principal;
  input: ApiInput;
  routeId: string;
  /** Idempotency-derived (or fresh) clientMutationId for domain writes. */
  mutationId: string;
};
type Op = (op: OpContext) => Promise<OpResult>;

const DAY = 86_400_000;

export function apiError(code: string, status: number, message: string): never {
  throw new ConvexError({ code, status, message });
}

/** Context whose `auth` resolves to the API caller (as the MCP backend token does). */
export function actingAs<T extends Ctx>(ctx: T, userId: Id<'users'>): T {
  const identity = {
    subject: String(userId),
    issuer: 'finapp-public-api',
    tokenIdentifier: `finapp-public-api|${String(userId)}`,
  };
  return { ...ctx, auth: { getUserIdentity: async () => identity } } as T;
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

/** Runs a registered query or mutation's handler in this (impersonated) context. */
async function call<T = unknown>(fn: unknown, ctx: Ctx, args: Record<string, unknown>) {
  const handler = (fn as { _handler?: (ctx: Ctx, args: Record<string, unknown>) => Promise<T> })
    ._handler;
  if (typeof handler !== 'function') throw new Error('HANDLER_UNAVAILABLE');
  return handler(ctx, stripUndefined(args));
}

function idOf<T extends TableNames>(ctx: Ctx, table: T, value: unknown, what = 'Resource') {
  const id = typeof value === 'string' ? ctx.db.normalizeId(table, value) : null;
  if (!id) apiError('not_found', 404, `${what} not found.`);
  return id;
}

function optionalId<T extends TableNames>(ctx: Ctx, table: T, value: unknown, what: string) {
  if (value === undefined || value === null) return undefined;
  const id = typeof value === 'string' ? ctx.db.normalizeId(table, value) : null;
  if (!id) apiError('invalid_request', 422, `${what} id is not valid.`);
  return id;
}

function item(data: unknown): OpResult {
  return { kind: 'item', data };
}

function created(result: unknown): OpResult {
  if (typeof result === 'string') return item({ id: result });
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    const id = record.id ?? record._id ?? record.resultEntityId;
    if (typeof id === 'string') return item({ ...record, id });
  }
  return item(result ?? {});
}

function deleted(id: string): OpResult {
  return item({ id, deleted: true });
}

function fingerprint(op: OpContext) {
  return filterFingerprint({ route: op.routeId, ...op.input.params, ...op.input.query });
}

function limitOf(op: OpContext) {
  return (op.input.query.limit as number | undefined) ?? 25;
}

function paginationOpts(op: OpContext) {
  return {
    numItems: limitOf(op),
    cursor: decodeConvexCursor(op.input.query.cursor as string | undefined, fingerprint(op)),
  };
}

function fromConvexPage(
  op: OpContext,
  page: { items: unknown[]; nextCursor: string | null; isDone: boolean },
): OpResult {
  return {
    kind: 'list',
    data: page.items,
    hasMore: !page.isDone,
    nextCursor:
      page.isDone || !page.nextCursor ? null : encodeConvexCursor(page.nextCursor, fingerprint(op)),
  };
}

function fromList(op: OpContext, rows: readonly unknown[]): OpResult {
  const fp = fingerprint(op);
  const offset = decodeOffsetCursor(op.input.query.cursor as string | undefined, fp);
  return { kind: 'list', ...pageOfList(rows, offset, limitOf(op), fp) };
}

function window(query: Record<string, unknown>, defaultDays: number) {
  const endAt = (query.endAt as number | undefined) ?? Date.now();
  const startAt = (query.startAt as number | undefined) ?? endAt - defaultDays * DAY;
  if (endAt <= startAt) apiError('invalid_request', 400, '`endAt` must be after `startAt`.');
  if (endAt - startAt > 366 * DAY)
    apiError('invalid_request', 400, 'The date window can be at most 366 days.');
  return { startAt, endAt };
}

/** Optional window for endpoints that list everything when no dates are given. */
function optionalWindow(query: Record<string, unknown>) {
  if (query.startAt === undefined && query.endAt === undefined) return {};
  return window(query, 365);
}

async function owned<T extends 'accounts' | 'transactions' | 'categories' | 'goals'>(
  op: OpContext,
  table: T,
  value: unknown,
  what: string,
) {
  const id = idOf(op.ctx, table, value, what);
  const doc = await op.ctx.db.get(id);
  if (!doc || (doc as { ownerId?: unknown }).ownerId !== op.principal.userId)
    apiError('not_found', 404, `${what} not found.`);
  return doc;
}

function lineItems(ctx: Ctx, items: unknown, amountMinor: bigint | undefined) {
  if (items === undefined) return undefined;
  const rows = items as {
    id?: string;
    title: string;
    amountMinor: bigint;
    quantity?: number;
    participantIds?: string[];
  }[];
  if (rows.length && amountMinor !== undefined) {
    const total = rows.reduce((sum, row) => sum + row.amountMinor, 0n);
    if (total !== amountMinor)
      apiError('items_total_mismatch', 422, 'Line item amounts must sum to amountMinor.');
  }
  return rows.map((row) =>
    stripUndefined({
      id: row.id ?? crypto.randomUUID(),
      title: row.title,
      amountMinor: row.amountMinor,
      quantity: row.quantity,
      participantIds: row.participantIds?.map((value) => idOf(ctx, 'users', value, 'User')),
    }),
  );
}

const nullToUndefined = <T>(value: T | null | undefined) => (value === null ? undefined : value);

// ---------- Export ----------

const EXPORT_TABLES = {
  accounts: 'by_owner',
  categories: 'by_owner',
  transactions: 'by_owner_occurredAt',
  goals: 'by_owner',
  goalContributions: 'by_owner_occurredAt',
  recurringRules: 'by_owner_nextOccurrence',
} as const;

function exportRow(row: Record<string, unknown>): Record<string, unknown> {
  const { _id, _creationTime: _ignored, ...rest } = safeExportRow(row);
  return { id: _id, ...rest };
}

// ---------- Operations ----------

export const OPS: Record<string, Op> = {
  // Profile
  getMe: async ({ ctx }) => {
    const profile = await call<Record<string, unknown> | null>(userQueries.current, ctx, {});
    if (!profile) apiError('not_found', 404, 'Profile not found.');
    return item({
      id: profile._id,
      displayName: profile.displayName,
      username: profile.username,
      defaultCurrency: profile.defaultCurrency,
      timezone: profile.timezone,
      defaultAccountId: profile.defaultAccountId ?? null,
    });
  },

  // Accounts
  listAccounts: async (op) => fromList(op, await call<unknown[]>(accountQueries.list, op.ctx, {})),
  getAccount: async (op) => {
    const accountId = idOf(op.ctx, 'accounts', op.input.params.accountId, 'Account');
    const detail = await call(accountQueries.detail, op.ctx, { accountId });
    if (!detail) apiError('not_found', 404, 'Account not found.');
    return item(detail);
  },
  createAccount: async ({ ctx, input, mutationId }) => {
    const body = input.body;
    if (body.type === 'other' && !body.customType)
      apiError('invalid_request', 400, "`customType` is required when type is 'other'.");
    return created(
      await call(accountMutations.create, ctx, { ...body, clientMutationId: mutationId }),
    );
  },
  updateAccount: async (op) => {
    const account = await owned(op, 'accounts', op.input.params.accountId, 'Account');
    const body = op.input.body;
    const type = (body.type as string | undefined) ?? account.type;
    await call(accountMutations.updateDetails, op.ctx, {
      accountId: account._id,
      name: body.name ?? account.name,
      type,
      customType: body.customType !== undefined ? body.customType : account.customType,
      currency: body.currency ?? account.currency,
      openingBalanceMinor: body.openingBalanceMinor ?? account.openingBalanceMinor,
      isIncludedInTotal: body.isIncludedInTotal ?? account.isIncludedInTotal,
      includeInAnalytics: body.includeInAnalytics,
      icon: body.icon,
      color: body.color,
      notes: body.notes,
      provider: body.provider,
      clientMutationId: op.mutationId,
    });
    return item({ id: account._id });
  },
  archiveAccount: async (op) => {
    const accountId = idOf(op.ctx, 'accounts', op.input.params.accountId, 'Account');
    await call(accountMutations.archive, op.ctx, { accountId, clientMutationId: op.mutationId });
    return deleted(accountId);
  },

  // Transactions
  listTransactions: async (op) => {
    const q = op.input.query;
    if (
      q.minAmountMinor !== undefined &&
      q.maxAmountMinor !== undefined &&
      (q.minAmountMinor as bigint) > (q.maxAmountMinor as bigint)
    )
      apiError('invalid_request', 400, '`minAmountMinor` must not exceed `maxAmountMinor`.');
    const page = await call<{ items: unknown[]; nextCursor: string | null; isDone: boolean }>(
      mcp.listTransactions,
      op.ctx,
      {
        ...window(q, 30),
        accountId: q.accountId,
        categoryId: q.categoryId,
        type: q.type,
        search: q.q,
        minAmountMinor: q.minAmountMinor,
        maxAmountMinor: q.maxAmountMinor,
        paginationOpts: paginationOpts(op),
      },
    );
    return fromConvexPage(op, page);
  },
  getTransaction: async (op) =>
    item(await call(mcp.getTransaction, op.ctx, { transactionId: op.input.params.transactionId })),
  createTransaction: async ({ ctx, input, mutationId }) => {
    const body = input.body;
    const amountMinor = body.amountMinor as bigint;
    return created(
      await call(transactionMutations.create, ctx, {
        ...body,
        accountId: idOf(ctx, 'accounts', body.accountId, 'Account'),
        categoryId: optionalId(ctx, 'categories', body.categoryId, 'Category'),
        transferAccountId: optionalId(ctx, 'accounts', body.transferAccountId, 'Transfer account'),
        items: lineItems(ctx, body.items, amountMinor),
        clientMutationId: mutationId,
      }),
    );
  },
  updateTransaction: async (op) => {
    const transaction = await owned(
      op,
      'transactions',
      op.input.params.transactionId,
      'Transaction',
    );
    if (transaction.groupId !== undefined)
      apiError('unsupported', 422, 'Group expenses cannot be edited through this endpoint.');
    const body = op.input.body;
    const type = (body.type as string | undefined) ?? transaction.type;
    if (type !== 'expense' && type !== 'income' && type !== 'transfer')
      apiError('unsupported', 422, `Transactions of type '${type}' cannot be edited.`);
    const amountMinor = (body.amountMinor as bigint | undefined) ?? transaction.amountMinor;
    const pick = <K extends string>(key: K, current: unknown) =>
      body[key] === undefined ? current : nullToUndefined(body[key]);
    await call(transactionMutations.update, op.ctx, {
      transactionId: transaction._id,
      accountId:
        body.accountId === undefined
          ? transaction.accountId
          : idOf(op.ctx, 'accounts', body.accountId, 'Account'),
      type,
      amountMinor,
      currency: body.currency ?? transaction.currency,
      title: body.title ?? transaction.title,
      categoryId:
        body.categoryId === undefined
          ? optionalId(op.ctx, 'categories', transaction.categoryId, 'Category')
          : optionalId(op.ctx, 'categories', body.categoryId, 'Category'),
      merchant: pick('merchant', transaction.merchant),
      note: pick('note', transaction.note),
      transferAccountId:
        body.transferAccountId === undefined
          ? transaction.transferAccountId
            ? optionalId(op.ctx, 'accounts', transaction.transferAccountId, 'Transfer account')
            : undefined
          : optionalId(op.ctx, 'accounts', body.transferAccountId, 'Transfer account'),
      occurredAt: body.occurredAt ?? transaction.occurredAt,
      hasTime: body.hasTime ?? transaction.hasTime,
      items: lineItems(op.ctx, body.items, amountMinor),
      clientMutationId: op.mutationId,
    });
    return item({ id: transaction._id });
  },
  deleteTransaction: async (op) => {
    const transactionId = idOf(
      op.ctx,
      'transactions',
      op.input.params.transactionId,
      'Transaction',
    );
    await call(transactionMutations.softDelete, op.ctx, {
      transactionId,
      clientMutationId: op.mutationId,
    });
    return deleted(transactionId);
  },

  // Categories
  listCategories: async (op) =>
    fromList(op, await call<unknown[]>(categoryQueries.overview, op.ctx, {})),
  getCategory: async (op) => {
    const categoryId = idOf(op.ctx, 'categories', op.input.params.categoryId, 'Category');
    const detail = await call(categoryQueries.detail, op.ctx, { categoryId });
    if (!detail) apiError('not_found', 404, 'Category not found.');
    return item(detail);
  },
  createCategory: async ({ ctx, input, mutationId }) =>
    created(
      await call(categoryMutations.create, ctx, { ...input.body, clientMutationId: mutationId }),
    ),
  updateCategory: async (op) => {
    const category = await owned(op, 'categories', op.input.params.categoryId, 'Category');
    const body = op.input.body;
    if (body.name !== undefined)
      await call(categoryMutations.rename, op.ctx, {
        categoryId: category._id,
        name: body.name,
        clientMutationId: `${op.mutationId}:name`,
      });
    if (body.kind !== undefined || body.color !== undefined || body.notes !== undefined)
      await call(categoryMutations.setPreferences, op.ctx, {
        categoryId: category._id,
        kind: body.kind ?? category.kind ?? 'expense',
        color: body.color !== undefined ? body.color : (category.color ?? null),
        notes: body.notes,
        clientMutationId: `${op.mutationId}:preferences`,
      });
    if (body.icon !== undefined)
      await call(categoryMutations.setIcon, op.ctx, {
        categoryId: category._id,
        icon: body.icon,
        clientMutationId: `${op.mutationId}:icon`,
      });
    return item({ id: category._id });
  },
  archiveCategory: async (op) => {
    const categoryId = idOf(op.ctx, 'categories', op.input.params.categoryId, 'Category');
    await call(categoryMutations.archive, op.ctx, {
      categoryId,
      deleteTransactions: op.input.query.deleteTransactions === 'true' ? true : undefined,
      clientMutationId: op.mutationId,
    });
    return deleted(categoryId);
  },

  // Budgets
  listBudgets: async (op) =>
    fromList(op, await call<unknown[]>(categoryQueries.limits, op.ctx, {})),
  setBudget: async (op) => {
    const categoryId = idOf(op.ctx, 'categories', op.input.params.categoryId, 'Category');
    await call(categoryMutations.setLimit, op.ctx, {
      categoryId,
      amountMinor: op.input.body.amountMinor,
      currency: op.input.body.currency,
      alertPercent: op.input.body.alertPercent,
      clientMutationId: op.mutationId,
    });
    return item({ categoryId });
  },
  deleteBudget: async (op) => {
    const categoryId = idOf(op.ctx, 'categories', op.input.params.categoryId, 'Category');
    await call(categoryMutations.setLimit, op.ctx, {
      categoryId,
      amountMinor: null,
      clientMutationId: op.mutationId,
    });
    return deleted(categoryId);
  },

  // Goals
  listGoals: async (op) =>
    fromConvexPage(
      op,
      await call(mcp.listOwnedRecords, op.ctx, {
        resource: 'goals',
        paginationOpts: paginationOpts(op),
      }),
    ),
  createGoal: async ({ ctx, input, mutationId }) =>
    created(
      await call(goalMutations.create, ctx, {
        ...input.body,
        accountId: optionalId(ctx, 'accounts', input.body.accountId, 'Account'),
        clientMutationId: mutationId,
      }),
    ),
  updateGoal: async (op) => {
    const goal = await owned(op, 'goals', op.input.params.goalId, 'Goal');
    const body = op.input.body;
    await call(goalMutations.update, op.ctx, {
      ...body,
      goalId: goal._id,
      name: body.name ?? goal.name,
      targetAmountMinor: body.targetAmountMinor ?? goal.targetAmountMinor,
      accountId:
        body.accountId === undefined
          ? undefined
          : body.accountId === null
            ? null
            : idOf(op.ctx, 'accounts', body.accountId, 'Account'),
      clientMutationId: op.mutationId,
    });
    return item({ id: goal._id });
  },
  archiveGoal: async (op) => {
    const goalId = idOf(op.ctx, 'goals', op.input.params.goalId, 'Goal');
    await call(goalMutations.archive, op.ctx, { goalId, clientMutationId: op.mutationId });
    return deleted(goalId);
  },
  contributeToGoal: async (op) => {
    const goalId = idOf(op.ctx, 'goals', op.input.params.goalId, 'Goal');
    return created(
      await call(goalMutations.contribute, op.ctx, {
        goalId,
        amountMinor: op.input.body.amountMinor,
        clientMutationId: op.mutationId,
      }),
    );
  },
  listGoalContributions: async (op) =>
    fromConvexPage(
      op,
      await call(mcp.listOwnedRecords, op.ctx, {
        resource: 'goalContributions',
        ...optionalWindow(op.input.query),
        paginationOpts: paginationOpts(op),
      }),
    ),

  // Groups
  listGroups: async (op) =>
    fromConvexPage(op, await call(mcp.listGroups, op.ctx, { paginationOpts: paginationOpts(op) })),
  getGroup: async (op) => {
    const groupId = idOf(op.ctx, 'groups', op.input.params.groupId, 'Group');
    return item(await call(mcp.groupSummary, op.ctx, { groupId }));
  },
  createGroup: async ({ ctx, input, mutationId }) =>
    created(
      await call(groupMutations.create, ctx, { ...input.body, clientMutationId: mutationId }),
    ),
  listGroupMembers: async (op) => {
    const groupId = idOf(op.ctx, 'groups', op.input.params.groupId, 'Group');
    return fromConvexPage(
      op,
      await call(mcp.listGroupMembers, op.ctx, { groupId, paginationOpts: paginationOpts(op) }),
    );
  },
  getGroupBalances: async (op) => {
    const groupId = idOf(op.ctx, 'groups', op.input.params.groupId, 'Group');
    const balances = await call(groupQueries.balances, op.ctx, { groupId });
    if (!balances) apiError('not_found', 404, 'Group not found.');
    return item(balances);
  },

  // Splits
  listGroupExpenses: async (op) => {
    const groupId = idOf(op.ctx, 'groups', op.input.params.groupId, 'Group');
    return fromConvexPage(
      op,
      await call(mcp.listGroupExpenses, op.ctx, {
        groupId,
        ...window(op.input.query, 90),
        paginationOpts: paginationOpts(op),
      }),
    );
  },
  getExpense: async (op) =>
    item(await call(mcp.getTransaction, op.ctx, { transactionId: op.input.params.expenseId })),
  createGroupExpense: async (op) => {
    const { ctx, input } = op;
    const body = input.body;
    const participants = (
      body.participants as {
        userId: string;
        amountMinor: bigint;
        method: string;
        basisValue?: string;
      }[]
    ).map((row) =>
      stripUndefined({
        userId: idOf(ctx, 'users', row.userId, 'Participant'),
        amountMinor: row.amountMinor,
        method: row.method,
        basisValue: row.basisValue,
      }),
    );
    return created(
      await call(groupMutations.addExpense, ctx, {
        ...body,
        groupId: idOf(ctx, 'groups', input.params.groupId, 'Group'),
        accountId: idOf(ctx, 'accounts', body.accountId, 'Account'),
        categoryId: optionalId(ctx, 'categories', body.categoryId, 'Category'),
        participants,
        items: lineItems(ctx, body.items, body.amountMinor as bigint),
        clientMutationId: op.mutationId,
      }),
    );
  },
  deleteExpense: async (op) => {
    const transactionId = idOf(op.ctx, 'transactions', op.input.params.expenseId, 'Expense');
    await call(groupMutations.deleteExpense, op.ctx, {
      transactionId,
      expectedVersion: op.input.query.expectedVersion,
      clientMutationId: op.mutationId,
    });
    return deleted(transactionId);
  },
  listGroupSettlements: async (op) => {
    const groupId = idOf(op.ctx, 'groups', op.input.params.groupId, 'Group');
    return fromConvexPage(
      op,
      await call(mcp.listGroupSettlements, op.ctx, {
        groupId,
        ...window(op.input.query, 90),
        paginationOpts: paginationOpts(op),
      }),
    );
  },
  createSettlement: async (op) => {
    const { ctx, input } = op;
    const body = input.body;
    return created(
      await call(settlementMutations.create, ctx, {
        groupId: idOf(ctx, 'groups', input.params.groupId, 'Group'),
        fromUserId: idOf(ctx, 'users', body.fromUserId, 'Paying member'),
        toUserId: idOf(ctx, 'users', body.toUserId, 'Receiving member'),
        accountId: idOf(ctx, 'accounts', body.accountId, 'Account'),
        amountMinor: body.amountMinor,
        currency: body.currency,
        occurredAt: body.occurredAt ?? Date.now(),
        note: body.note,
        clientMutationId: op.mutationId,
      }),
    );
  },
  deleteSettlement: async (op) => {
    const settlementId = idOf(op.ctx, 'settlements', op.input.params.settlementId, 'Settlement');
    await call(settlementMutations.remove, op.ctx, {
      settlementId,
      clientMutationId: op.mutationId,
    });
    return deleted(settlementId);
  },

  // Recurring
  listRecurringRules: async (op) =>
    fromConvexPage(
      op,
      await call(mcp.listOwnedRecords, op.ctx, {
        resource: 'recurringRules',
        paginationOpts: paginationOpts(op),
      }),
    ),
  createRecurringRule: async ({ ctx, input, mutationId }) =>
    created(
      await call(recurringMutations.create, ctx, {
        ...input.body,
        accountId: idOf(ctx, 'accounts', input.body.accountId, 'Account'),
        clientMutationId: mutationId,
      }),
    ),
  updateRecurringRule: async (op) => {
    const ruleId = idOf(op.ctx, 'recurringRules', op.input.params.ruleId, 'Recurring rule');
    await call(recurringMutations.setEnabled, op.ctx, {
      ruleId,
      enabled: op.input.body.enabled,
      clientMutationId: op.mutationId,
    });
    return item({ id: ruleId });
  },
  deleteRecurringRule: async (op) => {
    const ruleId = idOf(op.ctx, 'recurringRules', op.input.params.ruleId, 'Recurring rule');
    await call(recurringMutations.remove, op.ctx, { ruleId, clientMutationId: op.mutationId });
    return deleted(ruleId);
  },

  // Notifications
  listNotifications: async (op) =>
    fromConvexPage(
      op,
      await call(mcp.listOwnedRecords, op.ctx, {
        resource: 'notifications',
        ...optionalWindow(op.input.query),
        paginationOpts: paginationOpts(op),
      }),
    ),

  // Analytics
  getAnalyticsSummary: async (op) => {
    const q = op.input.query;
    const summary = await call(analyticsQueries.summary, op.ctx, {
      period: q.period,
      startAt: q.startAt,
      endAt: q.endAt,
      previousStartAt: q.previousStartAt,
    });
    if (!summary) apiError('not_found', 404, 'No analytics available.');
    return item(summary);
  },

  // Export
  exportRecords: async (op) => {
    const resource = op.input.params.resource as keyof typeof EXPORT_TABLES;
    const index = EXPORT_TABLES[resource];
    if (!index) apiError('not_found', 404, 'Unknown export resource.');
    const page = await (
      op.ctx.db.query(resource) as unknown as {
        withIndex: (
          name: string,
          range: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
        ) => {
          order: (order: 'asc') => {
            paginate: (opts: { numItems: number; cursor: string | null }) => Promise<{
              page: Record<string, unknown>[];
              isDone: boolean;
              continueCursor: string;
            }>;
          };
        };
      }
    )
      .withIndex(index, (q) => q.eq('ownerId', op.principal.userId))
      .order('asc')
      .paginate(paginationOpts(op));
    return fromConvexPage(op, {
      items: page.page.map(exportRow),
      nextCursor: page.continueCursor,
      isDone: page.isDone,
    });
  },

  // Webhooks
  listWebhooks: async (op) =>
    fromList(op, (await listEndpointsFor(op.ctx, op.principal)).map(presentEndpoint)),
  getWebhook: async (op) =>
    item(presentEndpoint(await endpointFor(op.ctx, op.principal, op.input.params.webhookId!))),
  createWebhook: async (op) =>
    item(
      await createEndpoint(op.ctx as MutationCtx, op.principal, {
        url: op.input.body.url as string,
        events: op.input.body.events as string[],
        description: op.input.body.description as string | undefined,
      }),
    ),
  updateWebhook: async (op) =>
    item(
      await updateEndpoint(
        op.ctx as MutationCtx,
        op.principal,
        op.input.params.webhookId!,
        op.input.body as Parameters<typeof updateEndpoint>[3],
      ),
    ),
  deleteWebhook: async (op) =>
    item(await deleteEndpoint(op.ctx as MutationCtx, op.principal, op.input.params.webhookId!)),
  rotateWebhookSecret: async (op) =>
    item(
      await rotateEndpointSecret(op.ctx as MutationCtx, op.principal, op.input.params.webhookId!),
    ),
  testWebhook: async (op) => {
    const endpoint = await endpointFor(op.ctx, op.principal, op.input.params.webhookId!);
    const eventId = await emitWebhookEvent(
      op.ctx as MutationCtx,
      op.principal.userId,
      'ping',
      { message: 'Test event from the FinApp API' },
      endpoint._id,
    );
    return item({ eventId });
  },
  listWebhookDeliveries: async (op) =>
    fromList(op, await listDeliveriesFor(op.ctx, op.principal, op.input.params.webhookId!, 200)),
};
