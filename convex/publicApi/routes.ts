/**
 * The public API v1 route registry: the single source of truth for routing, input validation,
 * required scopes and the OpenAPI document. Pure (zod only) so the docs app and tests can import
 * it without a Convex runtime.
 */
import { z } from 'zod';
import type { ApiScope } from './scopes';
import { WEBHOOK_EVENT_TYPES } from './webhookEvents';

export const API_VERSION = 'v1';
export const API_BASE_PATH = '/api/v1';
/** Date of the current v1 contract; sent as `FinApp-Api-Version`. */
export const API_REVISION = '2026-11-28';

// ---------- Shared input schemas ----------

const MAX_INT64 = 9_223_372_036_854_775_807n;
export const minorUnits = z
  .string()
  .regex(/^\d{1,19}$/, 'Use a non-negative integer string in minor currency units.')
  .refine((value) => BigInt(value) <= MAX_INT64, 'Amount exceeds the signed 64-bit range.')
  .transform((value) => BigInt(value))
  .describe('Amount as an integer string in minor units, e.g. "12550" = 125.50 in INR or USD.');
export const currency = z
  .string()
  .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter ISO 4217 currency code.')
  .transform((value) => value.toUpperCase())
  .describe('ISO 4217 currency code, e.g. "INR" or "USD".');
export const timestamp = z
  .number()
  .int()
  .min(0)
  .max(8_640_000_000_000)
  .describe('Unix epoch milliseconds.');
const queryTimestamp = z.coerce
  .number()
  .int()
  .min(0)
  .max(8_640_000_000_000)
  .describe('Unix epoch milliseconds.');
export const docId = (what: string) =>
  z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Malformed id.')
    .describe(`${what} id.`);
const shortText = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => z.string().max(max).nullable();

const pageQuery = {
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe('Page size, 1-100 (default 25).'),
  cursor: z
    .string()
    .max(4096)
    .optional()
    .describe('`nextCursor` from the previous page. Must be used with the same filters.'),
};
const windowQuery = {
  startAt: queryTimestamp.optional().describe('Inclusive start, epoch ms.'),
  endAt: queryTimestamp.optional().describe('Exclusive end, epoch ms. Default: now.'),
};

const lineItem = z.object({
  id: z.string().min(1).max(64).optional().describe('Stable item id; generated when omitted.'),
  title: shortText(200),
  amountMinor: minorUnits,
  quantity: z.number().int().min(1).max(10_000).optional(),
  participantIds: z
    .array(docId('User'))
    .max(100)
    .optional()
    .describe("Group expenses with method 'itemized': users sharing this item."),
});
const lineItems = z
  .array(lineItem)
  .max(100)
  .optional()
  .describe('Optional itemised breakdown; item amounts must sum exactly to amountMinor.');

const accountType = z.enum(['cash', 'bank', 'card', 'wallet', 'loan', 'other']);
const transactionType = z.enum(['expense', 'income', 'transfer', 'refund', 'adjustment']);
const splitMethod = z.enum(['equal', 'exact', 'percentage', 'shares', 'itemized']);

// ---------- Response schemas (documentation; amounts are decimal strings) ----------

const money = z
  .string()
  .regex(/^-?\d+$/)
  .describe('Integer string in minor units.');
const idString = z.string().describe('Document id.');
const ts = z.number().describe('Unix epoch milliseconds.');

const Account = z.looseObject({
  id: idString,
  name: z.string(),
  type: accountType,
  currency: z.string(),
  balanceMinor: money.optional(),
  openingBalanceMinor: money.optional(),
  isIncludedInTotal: z.boolean().optional(),
  includeInAnalytics: z.boolean().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});
const LineItem = z.object({
  id: z.string(),
  title: z.string(),
  amountMinor: money,
  quantity: z.number().optional(),
});
const Transaction = z.looseObject({
  id: idString,
  title: z.string(),
  type: transactionType,
  amountMinor: money,
  currency: z.string(),
  accountId: idString.optional(),
  categoryId: idString.optional(),
  merchant: z.string().optional(),
  note: z.string().optional(),
  occurredAt: ts,
  status: z.string().optional(),
  groupId: idString.optional(),
  items: z.array(LineItem).optional(),
});
const Category = z.looseObject({
  id: idString,
  name: z.string(),
  kind: z.enum(['expense', 'income']).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});
const Budget = z.looseObject({
  categoryId: idString,
  name: z.string(),
  currency: z.string(),
  limitMinor: money,
  spentMinor: money,
  remainingMinor: money,
  percentUsed: z.number(),
});
const Goal = z.looseObject({
  id: idString,
  name: z.string(),
  targetAmountMinor: money,
  currency: z.string(),
  targetDate: ts.optional(),
  completedAt: ts.optional(),
});
const GoalContribution = z.looseObject({
  id: idString,
  goalId: idString,
  amountMinor: money,
  currency: z.string(),
  occurredAt: ts,
});
const Group = z.looseObject({
  id: idString,
  name: z.string(),
  currency: z.string(),
  memberRole: z.enum(['owner', 'admin', 'member']).optional(),
});
const GroupMember = z.looseObject({ userId: idString, role: z.string().optional() });
const Balances = z.looseObject({
  currency: z.string(),
  status: z.string(),
  members: z.array(z.looseObject({ userId: idString, amountMinor: money })),
  transfers: z.array(
    z.looseObject({ fromUserId: idString, toUserId: idString, amountMinor: money }),
  ),
});
const Settlement = z.looseObject({
  id: idString,
  fromUserId: idString,
  toUserId: idString,
  amountMinor: money,
  currency: z.string(),
  occurredAt: ts,
});
const RecurringRule = z.looseObject({
  id: idString,
  name: z.string(),
  frequency: z.string(),
  nextOccurrence: ts,
  enabled: z.boolean(),
});
const Notification = z.looseObject({
  id: idString,
  type: z.string(),
  title: z.string(),
  body: z.string().optional(),
  createdAt: ts,
  readAt: ts.optional(),
});
const Profile = z.object({
  id: idString,
  displayName: z.string().optional(),
  username: z.string().optional(),
  defaultCurrency: z.string().optional(),
  timezone: z.string().optional(),
  defaultAccountId: idString.nullable(),
});
const Analytics = z.looseObject({ currency: z.string() });
const ExportRow = z.record(z.string(), z.unknown());
const Webhook = z.object({
  id: idString,
  url: z.string(),
  description: z.string().optional(),
  events: z.array(z.string()),
  enabled: z.boolean(),
  secretPrefix: z.string(),
  consecutiveFailures: z.number(),
  disabledReason: z.string().optional(),
  createdAt: ts,
  updatedAt: ts,
});
const WebhookWithSecret = Webhook.extend({
  secret: z.string().describe('Signing secret. Shown only in this response.'),
});
const WebhookDelivery = z.object({
  id: idString,
  eventId: idString,
  eventType: z.string(),
  attempt: z.number(),
  status: z.enum(['pending', 'succeeded', 'retrying', 'failed']),
  responseStatus: z.number().optional(),
  durationMs: z.number().optional(),
  errorCode: z.string().optional(),
  createdAt: ts,
});
const Deleted = z.object({ id: idString, deleted: z.literal(true) });
const Created = z.object({ id: idString });

// ---------- Route type ----------

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type RouteDef = {
  /** OpenAPI operationId and executor key. */
  id: string;
  method: HttpMethod;
  /** Relative to /api/v1, with `{param}` placeholders. */
  path: string;
  /** `null` for public endpoints (no authentication). */
  scope: ApiScope | null;
  tag: string;
  summary: string;
  description?: string;
  kind: 'query' | 'mutation' | 'meta';
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodObject;
  response: z.ZodType;
  /** Response is a paginated list. */
  list?: boolean;
  status?: 200 | 201;
  /** Example request body for docs. */
  example?: Record<string, unknown>;
};

function route(def: RouteDef): RouteDef {
  return def;
}

const p = {
  accountId: z.object({ accountId: docId('Account') }),
  transactionId: z.object({ transactionId: docId('Transaction') }),
  categoryId: z.object({ categoryId: docId('Category') }),
  goalId: z.object({ goalId: docId('Goal') }),
  groupId: z.object({ groupId: docId('Group') }),
  expenseId: z.object({ expenseId: docId('Expense') }),
  settlementId: z.object({ settlementId: docId('Settlement') }),
  ruleId: z.object({ ruleId: docId('Recurring rule') }),
  webhookId: z.object({ webhookId: docId('Webhook') }),
  exportResource: z.object({
    resource: z.enum([
      'accounts',
      'categories',
      'transactions',
      'goals',
      'goalContributions',
      'recurringRules',
    ]),
  }),
};

const webhookEvents = z
  .array(z.enum(WEBHOOK_EVENT_TYPES))
  .min(1)
  .max(WEBHOOK_EVENT_TYPES.length)
  .describe('Event types to receive.');

export const ROUTES: RouteDef[] = [
  // ---------- Meta ----------
  route({
    id: 'getApiInfo',
    method: 'GET',
    path: '/',
    scope: null,
    tag: 'Meta',
    kind: 'meta',
    summary: 'API information',
    description: 'Version, revision and documentation links. No authentication.',
    response: z.object({ version: z.string(), revision: z.string(), openapi: z.string() }),
  }),
  route({
    id: 'getOpenApi',
    method: 'GET',
    path: '/openapi.json',
    scope: null,
    tag: 'Meta',
    kind: 'meta',
    summary: 'OpenAPI document',
    description: 'This API described as OpenAPI 3.1. No authentication.',
    response: z.record(z.string(), z.unknown()),
  }),

  // ---------- Profile ----------
  route({
    id: 'getMe',
    method: 'GET',
    path: '/me',
    scope: 'profile:read',
    tag: 'Profile',
    kind: 'query',
    summary: 'Get the authenticated user',
    response: Profile,
  }),

  // ---------- Accounts ----------
  route({
    id: 'listAccounts',
    method: 'GET',
    path: '/accounts',
    scope: 'accounts:read',
    tag: 'Accounts',
    kind: 'query',
    summary: 'List accounts',
    description: 'Active (not archived) accounts with their current balances.',
    query: z.object({ ...pageQuery }),
    response: Account,
    list: true,
  }),
  route({
    id: 'getAccount',
    method: 'GET',
    path: '/accounts/{accountId}',
    scope: 'accounts:read',
    tag: 'Accounts',
    kind: 'query',
    summary: 'Get an account',
    description: 'The account, its balance and its most recent transactions.',
    params: p.accountId,
    response: z.looseObject({
      account: Account,
      balanceMinor: money,
      transactions: z.array(Transaction),
    }),
  }),
  route({
    id: 'createAccount',
    method: 'POST',
    path: '/accounts',
    scope: 'accounts:write',
    tag: 'Accounts',
    kind: 'mutation',
    summary: 'Create an account',
    status: 201,
    body: z.object({
      name: shortText(120),
      type: accountType,
      customType: shortText(60).optional().describe("Required when type is 'other'."),
      currency,
      openingBalanceMinor: minorUnits,
      isIncludedInTotal: z.boolean().default(true),
      includeInAnalytics: z.boolean().optional(),
      icon: z.string().max(80).optional(),
      color: z.string().max(32).optional(),
      notes: z.string().max(2000).optional(),
      provider: z.string().max(120).optional(),
    }),
    response: Created,
    example: {
      name: 'HDFC Savings',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: '2500000',
      isIncludedInTotal: true,
    },
  }),
  route({
    id: 'updateAccount',
    method: 'PATCH',
    path: '/accounts/{accountId}',
    scope: 'accounts:write',
    tag: 'Accounts',
    kind: 'mutation',
    summary: 'Update an account',
    description: 'Send only the fields to change.',
    params: p.accountId,
    body: z.object({
      name: shortText(120).optional(),
      type: accountType.optional(),
      customType: nullableText(60).optional(),
      currency: currency.optional(),
      openingBalanceMinor: minorUnits.optional(),
      isIncludedInTotal: z.boolean().optional(),
      includeInAnalytics: z.boolean().optional(),
      icon: nullableText(80).optional(),
      color: nullableText(32).optional(),
      notes: nullableText(2000).optional(),
      provider: nullableText(120).optional(),
    }),
    response: Created,
    example: { name: 'HDFC Salary account' },
  }),
  route({
    id: 'archiveAccount',
    method: 'DELETE',
    path: '/accounts/{accountId}',
    scope: 'accounts:write',
    tag: 'Accounts',
    kind: 'mutation',
    summary: 'Archive an account',
    description: 'Archives the account (it can be restored from Trash in the app).',
    params: p.accountId,
    response: Deleted,
  }),

  // ---------- Transactions ----------
  route({
    id: 'listTransactions',
    method: 'GET',
    path: '/transactions',
    scope: 'transactions:read',
    tag: 'Transactions',
    kind: 'query',
    summary: 'List transactions',
    description:
      'Newest first within a date window (default: the 30 days before `endAt`, at most 366 days). Filters are applied per page, so a page can hold fewer than `limit` rows while `hasMore` is true.',
    query: z.object({
      ...windowQuery,
      accountId: docId('Account').optional(),
      categoryId: docId('Category').optional(),
      type: transactionType.optional(),
      q: z.string().max(120).optional().describe('Text search over title, merchant, note, items.'),
      minAmountMinor: minorUnits.optional(),
      maxAmountMinor: minorUnits.optional(),
      ...pageQuery,
    }),
    response: Transaction,
    list: true,
  }),
  route({
    id: 'getTransaction',
    method: 'GET',
    path: '/transactions/{transactionId}',
    scope: 'transactions:read',
    tag: 'Transactions',
    kind: 'query',
    summary: 'Get a transaction',
    params: p.transactionId,
    response: Transaction,
  }),
  route({
    id: 'createTransaction',
    method: 'POST',
    path: '/transactions',
    scope: 'transactions:write',
    tag: 'Transactions',
    kind: 'mutation',
    summary: 'Create a transaction',
    status: 201,
    body: z.object({
      accountId: docId('Account'),
      type: transactionType,
      amountMinor: minorUnits,
      currency,
      title: shortText(200),
      categoryId: docId('Category').optional(),
      merchant: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
      transferAccountId: docId('Destination account (transfers only)').optional(),
      occurredAt: timestamp,
      hasTime: z.boolean().optional(),
      items: lineItems,
    }),
    response: Created,
    example: {
      accountId: 'k17abc…',
      type: 'expense',
      amountMinor: '45000',
      currency: 'INR',
      title: 'Groceries',
      occurredAt: 1764288000000,
    },
  }),
  route({
    id: 'updateTransaction',
    method: 'PATCH',
    path: '/transactions/{transactionId}',
    scope: 'transactions:write',
    tag: 'Transactions',
    kind: 'mutation',
    summary: 'Update a transaction',
    description:
      'Send only the fields to change. Personal expense, income and transfer transactions can be edited; group expenses are edited through the app.',
    params: p.transactionId,
    body: z.object({
      accountId: docId('Account').optional(),
      type: z.enum(['expense', 'income', 'transfer']).optional(),
      amountMinor: minorUnits.optional(),
      currency: currency.optional(),
      title: shortText(200).optional(),
      categoryId: docId('Category').nullable().optional(),
      merchant: z.string().max(200).nullable().optional(),
      note: z.string().max(2000).nullable().optional(),
      transferAccountId: docId('Destination account').nullable().optional(),
      occurredAt: timestamp.optional(),
      hasTime: z.boolean().optional(),
      items: lineItems,
    }),
    response: Created,
    example: { title: 'Weekly groceries', amountMinor: '52000' },
  }),
  route({
    id: 'deleteTransaction',
    method: 'DELETE',
    path: '/transactions/{transactionId}',
    scope: 'transactions:write',
    tag: 'Transactions',
    kind: 'mutation',
    summary: 'Delete a transaction',
    description: 'Moves the transaction to Trash.',
    params: p.transactionId,
    response: Deleted,
  }),

  // ---------- Categories ----------
  route({
    id: 'listCategories',
    method: 'GET',
    path: '/categories',
    scope: 'categories:read',
    tag: 'Categories',
    kind: 'query',
    summary: 'List categories',
    description: 'Active categories with this month’s spending.',
    query: z.object({ ...pageQuery }),
    response: Category,
    list: true,
  }),
  route({
    id: 'getCategory',
    method: 'GET',
    path: '/categories/{categoryId}',
    scope: 'categories:read',
    tag: 'Categories',
    kind: 'query',
    summary: 'Get a category',
    params: p.categoryId,
    response: z.looseObject({ category: Category }),
  }),
  route({
    id: 'createCategory',
    method: 'POST',
    path: '/categories',
    scope: 'categories:write',
    tag: 'Categories',
    kind: 'mutation',
    summary: 'Create a category',
    status: 201,
    body: z.object({
      name: shortText(120),
      kind: z.enum(['expense', 'income']).optional(),
      icon: z.string().max(80).optional(),
      color: z.string().max(32).optional(),
      notes: z.string().max(2000).optional(),
      monthlyLimitMinor: minorUnits.optional(),
      limitCurrency: currency.optional(),
      limitAlertPercent: z.number().int().min(1).max(100).optional(),
    }),
    response: Created,
    example: { name: 'Coffee', kind: 'expense', icon: '☕' },
  }),
  route({
    id: 'updateCategory',
    method: 'PATCH',
    path: '/categories/{categoryId}',
    scope: 'categories:write',
    tag: 'Categories',
    kind: 'mutation',
    summary: 'Update a category',
    params: p.categoryId,
    body: z.object({
      name: shortText(120).optional(),
      kind: z.enum(['expense', 'income']).optional(),
      icon: nullableText(32).optional(),
      color: nullableText(32).optional(),
      notes: nullableText(2000).optional(),
    }),
    response: Created,
    example: { name: 'Coffee & tea' },
  }),
  route({
    id: 'archiveCategory',
    method: 'DELETE',
    path: '/categories/{categoryId}',
    scope: 'categories:write',
    tag: 'Categories',
    kind: 'mutation',
    summary: 'Archive a category',
    params: p.categoryId,
    query: z.object({
      deleteTransactions: z
        .enum(['true', 'false'])
        .optional()
        .describe("'true' also moves the category's transactions to Trash."),
    }),
    response: Deleted,
  }),

  // ---------- Budgets (category limits) ----------
  route({
    id: 'listBudgets',
    method: 'GET',
    path: '/budgets',
    scope: 'budgets:read',
    tag: 'Budgets',
    kind: 'query',
    summary: 'List budgets',
    description: 'Monthly category limits with this month’s spending.',
    query: z.object({ ...pageQuery }),
    response: Budget,
    list: true,
  }),
  route({
    id: 'setBudget',
    method: 'PUT',
    path: '/budgets/{categoryId}',
    scope: 'budgets:write',
    tag: 'Budgets',
    kind: 'mutation',
    summary: 'Set a category budget',
    params: p.categoryId,
    body: z.object({
      amountMinor: minorUnits,
      currency: currency.optional(),
      alertPercent: z.number().int().min(1).max(100).optional(),
    }),
    response: z.object({ categoryId: idString }),
    example: { amountMinor: '500000', currency: 'INR', alertPercent: 80 },
  }),
  route({
    id: 'deleteBudget',
    method: 'DELETE',
    path: '/budgets/{categoryId}',
    scope: 'budgets:write',
    tag: 'Budgets',
    kind: 'mutation',
    summary: 'Remove a category budget',
    params: p.categoryId,
    response: Deleted,
  }),

  // ---------- Goals ----------
  route({
    id: 'listGoals',
    method: 'GET',
    path: '/goals',
    scope: 'goals:read',
    tag: 'Goals',
    kind: 'query',
    summary: 'List goals',
    query: z.object({ ...pageQuery }),
    response: Goal,
    list: true,
  }),
  route({
    id: 'createGoal',
    method: 'POST',
    path: '/goals',
    scope: 'goals:write',
    tag: 'Goals',
    kind: 'mutation',
    summary: 'Create a goal',
    status: 201,
    body: z.object({
      name: shortText(120),
      targetAmountMinor: minorUnits,
      currency,
      targetDate: timestamp.optional(),
      icon: z.string().max(80).optional(),
      color: z.string().max(32).optional(),
      goalType: z.string().max(60).optional(),
      monthlyContributionMinor: minorUnits.optional(),
      accountId: docId('Linked account').optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      reminderFrequency: z.enum(['none', 'weekly', 'monthly']).optional(),
      notes: z.string().max(2000).optional(),
    }),
    response: Created,
    example: { name: 'Emergency fund', targetAmountMinor: '30000000', currency: 'INR' },
  }),
  route({
    id: 'updateGoal',
    method: 'PATCH',
    path: '/goals/{goalId}',
    scope: 'goals:write',
    tag: 'Goals',
    kind: 'mutation',
    summary: 'Update a goal',
    params: p.goalId,
    body: z.object({
      name: shortText(120).optional(),
      targetAmountMinor: minorUnits.optional(),
      targetDate: timestamp.nullable().optional(),
      icon: nullableText(80).optional(),
      color: nullableText(32).optional(),
      goalType: nullableText(60).optional(),
      monthlyContributionMinor: minorUnits.nullable().optional(),
      accountId: docId('Linked account').nullable().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      reminderFrequency: z.enum(['none', 'weekly', 'monthly']).optional(),
      notes: nullableText(2000).optional(),
    }),
    response: Created,
    example: { targetAmountMinor: '35000000' },
  }),
  route({
    id: 'archiveGoal',
    method: 'DELETE',
    path: '/goals/{goalId}',
    scope: 'goals:write',
    tag: 'Goals',
    kind: 'mutation',
    summary: 'Archive a goal',
    params: p.goalId,
    response: Deleted,
  }),
  route({
    id: 'contributeToGoal',
    method: 'POST',
    path: '/goals/{goalId}/contributions',
    scope: 'goals:write',
    tag: 'Goals',
    kind: 'mutation',
    summary: 'Add a goal contribution',
    status: 201,
    params: p.goalId,
    body: z.object({ amountMinor: minorUnits }),
    response: Created,
    example: { amountMinor: '100000' },
  }),
  route({
    id: 'listGoalContributions',
    method: 'GET',
    path: '/goal-contributions',
    scope: 'goals:read',
    tag: 'Goals',
    kind: 'query',
    summary: 'List goal contributions',
    query: z.object({ ...windowQuery, ...pageQuery }),
    response: GoalContribution,
    list: true,
  }),

  // ---------- Groups ----------
  route({
    id: 'listGroups',
    method: 'GET',
    path: '/groups',
    scope: 'groups:read',
    tag: 'Groups',
    kind: 'query',
    summary: 'List groups',
    description: 'Groups you belong to.',
    query: z.object({ ...pageQuery }),
    response: Group,
    list: true,
  }),
  route({
    id: 'getGroup',
    method: 'GET',
    path: '/groups/{groupId}',
    scope: 'groups:read',
    tag: 'Groups',
    kind: 'query',
    summary: 'Get a group',
    params: p.groupId,
    response: Group,
  }),
  route({
    id: 'createGroup',
    method: 'POST',
    path: '/groups',
    scope: 'groups:write',
    tag: 'Groups',
    kind: 'mutation',
    summary: 'Create a group',
    description: 'Members are invited by exact FinApp username.',
    status: 201,
    body: z.object({
      name: shortText(120),
      currency,
      memberUsernames: z.array(z.string().min(3).max(32)).max(50).default([]),
      groupType: z.string().max(40).optional(),
      description: z.string().max(500).optional(),
      icon: z.string().max(80).optional(),
      color: z.string().max(32).optional(),
      startAt: timestamp.optional(),
      endAt: timestamp.optional(),
    }),
    response: Created,
    example: { name: 'Goa trip', currency: 'INR', memberUsernames: ['asha', 'ravi'] },
  }),
  route({
    id: 'listGroupMembers',
    method: 'GET',
    path: '/groups/{groupId}/members',
    scope: 'groups:read',
    tag: 'Groups',
    kind: 'query',
    summary: 'List group members',
    params: p.groupId,
    query: z.object({ ...pageQuery }),
    response: GroupMember,
    list: true,
  }),
  route({
    id: 'getGroupBalances',
    method: 'GET',
    path: '/groups/{groupId}/balances',
    scope: 'groups:read',
    tag: 'Groups',
    kind: 'query',
    summary: 'Get group balances',
    description: 'Each member’s net balance and the suggested transfers that settle everyone.',
    params: p.groupId,
    response: Balances,
  }),

  // ---------- Splits (group expenses) ----------
  route({
    id: 'listGroupExpenses',
    method: 'GET',
    path: '/groups/{groupId}/expenses',
    scope: 'splits:read',
    tag: 'Splits',
    kind: 'query',
    summary: 'List group expenses',
    description: 'Default window: the 90 days before `endAt` (at most 366 days).',
    params: p.groupId,
    query: z.object({ ...windowQuery, ...pageQuery }),
    response: Transaction,
    list: true,
  }),
  route({
    id: 'getExpense',
    method: 'GET',
    path: '/expenses/{expenseId}',
    scope: 'splits:read',
    tag: 'Splits',
    kind: 'query',
    summary: 'Get a group expense',
    description: 'Payers, each participant’s share, line items and the current version.',
    params: p.expenseId,
    response: Transaction,
  }),
  route({
    id: 'createGroupExpense',
    method: 'POST',
    path: '/groups/{groupId}/expenses',
    scope: 'splits:write',
    tag: 'Splits',
    kind: 'mutation',
    summary: 'Add a group expense',
    description:
      'Paid from one of your accounts. Participants’ shares must sum to `amountMinor`; the backend validates the split.',
    status: 201,
    params: p.groupId,
    body: z.object({
      accountId: docId('Your paying account'),
      title: shortText(200),
      amountMinor: minorUnits,
      currency,
      occurredAt: timestamp,
      categoryId: docId('Category').optional(),
      merchant: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
      participants: z
        .array(
          z.object({
            userId: docId('Member user'),
            amountMinor: minorUnits,
            method: splitMethod,
            basisValue: z.string().max(32).optional(),
          }),
        )
        .min(1)
        .max(100),
      items: lineItems,
    }),
    response: Created,
    example: {
      accountId: 'k17abc…',
      title: 'Dinner',
      amountMinor: '300000',
      currency: 'INR',
      occurredAt: 1764288000000,
      participants: [
        { userId: 'u1…', amountMinor: '150000', method: 'equal' },
        { userId: 'u2…', amountMinor: '150000', method: 'equal' },
      ],
    },
  }),
  route({
    id: 'deleteExpense',
    method: 'DELETE',
    path: '/expenses/{expenseId}',
    scope: 'splits:write',
    tag: 'Splits',
    kind: 'mutation',
    summary: 'Delete a group expense',
    description: 'Creator or group admin only. Pass `expectedVersion` to avoid deleting an edit.',
    params: p.expenseId,
    query: z.object({ expectedVersion: z.coerce.number().int().min(1).optional() }),
    response: Deleted,
  }),
  route({
    id: 'listGroupSettlements',
    method: 'GET',
    path: '/groups/{groupId}/settlements',
    scope: 'splits:read',
    tag: 'Splits',
    kind: 'query',
    summary: 'List settlements',
    params: p.groupId,
    query: z.object({ ...windowQuery, ...pageQuery }),
    response: Settlement,
    list: true,
  }),
  route({
    id: 'createSettlement',
    method: 'POST',
    path: '/groups/{groupId}/settlements',
    scope: 'splits:write',
    tag: 'Splits',
    kind: 'mutation',
    summary: 'Record a settlement',
    status: 201,
    params: p.groupId,
    body: z.object({
      fromUserId: docId('Paying member'),
      toUserId: docId('Receiving member'),
      accountId: docId('Your account'),
      amountMinor: minorUnits,
      currency,
      occurredAt: timestamp.optional(),
      note: z.string().max(280).optional(),
    }),
    response: Created,
    example: {
      fromUserId: 'u1…',
      toUserId: 'u2…',
      accountId: 'k17abc…',
      amountMinor: '150000',
      currency: 'INR',
    },
  }),
  route({
    id: 'deleteSettlement',
    method: 'DELETE',
    path: '/settlements/{settlementId}',
    scope: 'splits:write',
    tag: 'Splits',
    kind: 'mutation',
    summary: 'Undo a settlement',
    params: p.settlementId,
    response: Deleted,
  }),

  // ---------- Recurring ----------
  route({
    id: 'listRecurringRules',
    method: 'GET',
    path: '/recurring',
    scope: 'recurring:read',
    tag: 'Recurring',
    kind: 'query',
    summary: 'List recurring rules',
    query: z.object({ ...pageQuery }),
    response: RecurringRule,
    list: true,
  }),
  route({
    id: 'createRecurringRule',
    method: 'POST',
    path: '/recurring',
    scope: 'recurring:write',
    tag: 'Recurring',
    kind: 'mutation',
    summary: 'Create a recurring rule',
    status: 201,
    body: z.object({
      name: shortText(120),
      amountMinor: minorUnits,
      currency,
      accountId: docId('Account'),
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      nextOccurrence: timestamp,
    }),
    response: Created,
    example: {
      name: 'Rent',
      amountMinor: '2500000',
      currency: 'INR',
      accountId: 'k17abc…',
      frequency: 'monthly',
      nextOccurrence: 1764547200000,
    },
  }),
  route({
    id: 'updateRecurringRule',
    method: 'PATCH',
    path: '/recurring/{ruleId}',
    scope: 'recurring:write',
    tag: 'Recurring',
    kind: 'mutation',
    summary: 'Pause or resume a recurring rule',
    params: p.ruleId,
    body: z.object({ enabled: z.boolean() }),
    response: Created,
    example: { enabled: false },
  }),
  route({
    id: 'deleteRecurringRule',
    method: 'DELETE',
    path: '/recurring/{ruleId}',
    scope: 'recurring:write',
    tag: 'Recurring',
    kind: 'mutation',
    summary: 'Delete a recurring rule',
    params: p.ruleId,
    response: Deleted,
  }),

  // ---------- Notifications ----------
  route({
    id: 'listNotifications',
    method: 'GET',
    path: '/notifications',
    scope: 'notifications:read',
    tag: 'Notifications',
    kind: 'query',
    summary: 'List notifications',
    query: z.object({ ...windowQuery, ...pageQuery }),
    response: Notification,
    list: true,
  }),

  // ---------- Analytics ----------
  route({
    id: 'getAnalyticsSummary',
    method: 'GET',
    path: '/analytics/summary',
    scope: 'analytics:read',
    tag: 'Analytics',
    kind: 'query',
    summary: 'Spending and income analytics',
    description:
      'Totals, category breakdown and trend for a week, month or year, compared with the previous period, in your default currency.',
    query: z.object({
      period: z.enum(['week', 'month', 'year']),
      startAt: queryTimestamp,
      endAt: queryTimestamp,
      previousStartAt: queryTimestamp,
    }),
    response: Analytics,
  }),

  // ---------- Export ----------
  route({
    id: 'exportRecords',
    method: 'GET',
    path: '/export/{resource}',
    scope: 'export:read',
    tag: 'Export',
    kind: 'query',
    summary: 'Export raw records',
    description:
      'Pages through every record you own of one type (including archived and deleted ones), as stored, without secrets.',
    params: p.exportResource,
    query: z.object({ ...pageQuery }),
    response: ExportRow,
    list: true,
  }),

  // ---------- Webhooks ----------
  route({
    id: 'listWebhooks',
    method: 'GET',
    path: '/webhooks',
    scope: 'webhooks:manage',
    tag: 'Webhooks',
    kind: 'query',
    summary: 'List webhook endpoints',
    query: z.object({ ...pageQuery }),
    response: Webhook,
    list: true,
  }),
  route({
    id: 'createWebhook',
    method: 'POST',
    path: '/webhooks',
    scope: 'webhooks:manage',
    tag: 'Webhooks',
    kind: 'mutation',
    summary: 'Create a webhook endpoint',
    description: 'HTTPS only; private and local addresses are rejected. The secret is shown once.',
    status: 201,
    body: z.object({
      url: z.string().url().max(2048),
      events: webhookEvents,
      description: z.string().max(200).optional(),
    }),
    response: WebhookWithSecret,
    example: {
      url: 'https://example.com/finapp/webhooks',
      events: ['transaction.created', 'transaction.updated'],
    },
  }),
  route({
    id: 'getWebhook',
    method: 'GET',
    path: '/webhooks/{webhookId}',
    scope: 'webhooks:manage',
    tag: 'Webhooks',
    kind: 'query',
    summary: 'Get a webhook endpoint',
    params: p.webhookId,
    response: Webhook,
  }),
  route({
    id: 'updateWebhook',
    method: 'PATCH',
    path: '/webhooks/{webhookId}',
    scope: 'webhooks:manage',
    tag: 'Webhooks',
    kind: 'mutation',
    summary: 'Update a webhook endpoint',
    description: 'Re-enabling an endpoint resets its failure count.',
    params: p.webhookId,
    body: z.object({
      url: z.string().url().max(2048).optional(),
      events: webhookEvents.optional(),
      description: z.string().max(200).nullable().optional(),
      enabled: z.boolean().optional(),
    }),
    response: Webhook,
    example: { enabled: true },
  }),
  route({
    id: 'deleteWebhook',
    method: 'DELETE',
    path: '/webhooks/{webhookId}',
    scope: 'webhooks:manage',
    tag: 'Webhooks',
    kind: 'mutation',
    summary: 'Delete a webhook endpoint',
    params: p.webhookId,
    response: Deleted,
  }),
  route({
    id: 'rotateWebhookSecret',
    method: 'POST',
    path: '/webhooks/{webhookId}/rotate-secret',
    scope: 'webhooks:manage',
    tag: 'Webhooks',
    kind: 'mutation',
    summary: 'Rotate a webhook secret',
    description:
      'Issues a new secret. For 24 hours deliveries are signed with both the new and the previous secret so you can roll over without downtime.',
    params: p.webhookId,
    response: WebhookWithSecret,
  }),
  route({
    id: 'testWebhook',
    method: 'POST',
    path: '/webhooks/{webhookId}/test',
    scope: 'webhooks:manage',
    tag: 'Webhooks',
    kind: 'mutation',
    summary: 'Send a test event',
    description: 'Queues a `ping` event to this endpoint.',
    params: p.webhookId,
    response: z.object({ eventId: idString }),
  }),
  route({
    id: 'listWebhookDeliveries',
    method: 'GET',
    path: '/webhooks/{webhookId}/deliveries',
    scope: 'webhooks:manage',
    tag: 'Webhooks',
    kind: 'query',
    summary: 'List recent deliveries',
    description: 'Delivery attempts from the last 30 days: status codes and timings only.',
    params: p.webhookId,
    query: z.object({ ...pageQuery }),
    response: WebhookDelivery,
    list: true,
  }),
];

export const TAGS: { name: string; description: string }[] = [
  { name: 'Meta', description: 'API information and the OpenAPI document.' },
  { name: 'Profile', description: 'The authenticated user.' },
  { name: 'Accounts', description: 'Bank, cash, card, wallet and loan accounts.' },
  { name: 'Transactions', description: 'Personal expenses, income and transfers.' },
  { name: 'Categories', description: 'Spending and income categories.' },
  { name: 'Budgets', description: 'Monthly category limits.' },
  { name: 'Goals', description: 'Savings goals and contributions.' },
  { name: 'Groups', description: 'Shared groups, members and balances.' },
  { name: 'Splits', description: 'Shared group expenses and settlements.' },
  { name: 'Recurring', description: 'Recurring payment reminders.' },
  { name: 'Notifications', description: 'Your notification inbox.' },
  { name: 'Analytics', description: 'Spending and income analytics.' },
  { name: 'Export', description: 'Raw record export.' },
  { name: 'Webhooks', description: 'Event subscriptions delivered to your HTTPS endpoint.' },
];

// ---------- Matching ----------

export type RouteMatch = { route: RouteDef; params: Record<string, string> };

const compiled = ROUTES.map((def) => {
  const names: string[] = [];
  const pattern = def.path
    .split('/')
    .map((segment) => {
      const param = /^\{(\w+)\}$/.exec(segment);
      if (!param) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push(param[1]!);
      return '([^/]+)';
    })
    .join('/');
  return { def, names, regex: new RegExp(`^${pattern === '' ? '/' : pattern}$`) };
});

/** Matches `/accounts/abc` style paths (already stripped of `/api/v1`). */
export function matchRoute(
  method: string,
  path: string,
): RouteMatch | { allowed: HttpMethod[] } | null {
  const normalized = path === '' ? '/' : path.length > 1 ? path.replace(/\/+$/, '') : path;
  const allowed: HttpMethod[] = [];
  for (const { def, names, regex } of compiled) {
    const found = regex.exec(normalized);
    if (!found) continue;
    if (def.method !== method) {
      allowed.push(def.method);
      continue;
    }
    const params: Record<string, string> = {};
    names.forEach((name, index) => {
      params[name] = decodeURIComponent(found[index + 1]!);
    });
    return { route: def, params };
  }
  return allowed.length ? { allowed } : null;
}

export function routeById(id: string): RouteDef | undefined {
  return ROUTES.find((def) => def.id === id);
}
