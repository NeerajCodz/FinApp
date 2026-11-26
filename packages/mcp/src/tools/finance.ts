import { api } from '../../../../convex/_generated/api';
import { z } from 'zod';
import { formatMinor } from '../money';
import {
  confirm,
  currency,
  cursor,
  defineTool,
  docId,
  id,
  idempotencyKey,
  limit,
  lineItems,
  minorUnits,
  mutationId,
  page,
  prepareItems,
  timestamp,
  ToolInputError,
  type ToolFactory,
} from '../toolkit';

const DAY = 86_400_000;
const transactionType = z
  .enum(['expense', 'income', 'transfer', 'refund', 'adjustment'])
  .describe('Transaction kind.');
const accountType = z
  .enum(['cash', 'bank', 'card', 'wallet', 'loan', 'other'])
  .describe('Account kind.');
const optionalWindow = {
  startAt: timestamp
    .optional()
    .describe('Inclusive start (epoch ms). Default: 30 days before endAt.'),
  endAt: timestamp.optional().describe('Exclusive end (epoch ms). Default: now.'),
};
function window(args: { startAt?: number; endAt?: number }) {
  const endAt = args.endAt ?? Date.now();
  return { startAt: args.startAt ?? endAt - 30 * DAY, endAt };
}

type Listed = { items: Array<{ amountMinor?: bigint | string; currency?: string }> };
function countSummary(noun: string) {
  return (data: unknown) => {
    const items = (data as Listed | null)?.items;
    return Array.isArray(items) ? `${items.length} ${noun} on this page.` : undefined;
  };
}

export const financeTools: ToolFactory = (client) => [
  defineTool({
    name: 'finapp.finance.overview',
    title: 'Financial overview',
    description:
      'Dashboard snapshot: income, spending and net for a window (default last 30 days, in the default currency), every active account balance with per-currency totals, category limit usage this month and recent transactions. Renders an overview card in supporting clients.',
    scope: 'finapp:read',
    input: optionalWindow,
    widget: 'overview',
    run: async (args) => {
      const range = window(args);
      const [summary, accounts, limits] = await Promise.all([
        client.query(api.dashboard.queries.summary, range),
        client.query(api.accounts.queries.list, {}),
        client.query(api.categories.queries.limits, {}),
      ]);
      const totals = new Map<string, bigint>();
      for (const account of accounts) {
        if (!account.isIncludedInTotal) continue;
        totals.set(account.currency, (totals.get(account.currency) ?? 0n) + account.balanceMinor);
      }
      return {
        period: range,
        currency: summary?.currency ?? 'INR',
        incomeMinor: summary?.incomeMinor ?? 0n,
        spentMinor: summary?.spentMinor ?? 0n,
        netMinor: (summary?.incomeMinor ?? 0n) - (summary?.spentMinor ?? 0n),
        spendingTrend: summary?.chart ?? [],
        totals: [...totals].map(([code, balanceMinor]) => ({ currency: code, balanceMinor })),
        accounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
          currency: account.currency,
          balanceMinor: account.balanceMinor,
          isIncludedInTotal: account.isIncludedInTotal,
        })),
        categoryLimits: limits.slice(0, 6).map((limit) => ({
          categoryId: limit.categoryId,
          name: limit.name,
          currency: limit.currency,
          limitMinor: limit.limitMinor,
          spentMinor: limit.spentMinor,
          remainingMinor: limit.remainingMinor,
          progress: limit.percentUsed / 100,
        })),
        recent: (summary?.recent ?? []).map((transaction) => ({
          id: transaction._id,
          title: transaction.title,
          type: transaction.type,
          amountMinor: transaction.amountMinor,
          currency: transaction.currency,
          occurredAt: transaction.occurredAt,
        })),
      };
    },
    summarize: (data) => {
      const value = data as { currency: string; incomeMinor: bigint; spentMinor: bigint };
      return `Income ${formatMinor(value.incomeMinor, value.currency)}, spent ${formatMinor(value.spentMinor, value.currency)} in this window.`;
    },
  }),
  defineTool({
    name: 'finapp.finance.transactions.list',
    title: 'Search transactions',
    description:
      'Search past transactions page by page. Filter by date window (default last 30 days, max 366), account, category, type, amount range (minor units) and free text across title, merchant, note and line items. Results include line items when present. Continue with nextCursor; a page can hold fewer than limit rows after filtering.',
    scope: 'finapp:read',
    widget: 'transactions',
    input: {
      ...optionalWindow,
      accountId: docId('Account').optional(),
      categoryId: docId('Category').optional(),
      type: transactionType.optional(),
      search: z.string().max(120).optional().describe('Case-insensitive text, e.g. "uber".'),
      minAmountMinor: minorUnits.optional().describe('Inclusive lower bound in minor units.'),
      maxAmountMinor: minorUnits.optional().describe('Inclusive upper bound in minor units.'),
      limit,
      cursor,
    },
    run: (args) =>
      client.query(api.mcp.listTransactions, {
        ...window(args),
        accountId: args.accountId,
        categoryId: args.categoryId,
        type: args.type,
        search: args.search,
        minAmountMinor: args.minAmountMinor,
        maxAmountMinor: args.maxAmountMinor,
        paginationOpts: page(args),
      }),
    summarize: countSummary('transactions'),
  }),
  defineTool({
    name: 'finapp.finance.transactions.get',
    title: 'Get transaction',
    description:
      'Full detail of one transaction: account, category, line items and, for group expenses, who paid, the split per participant and the version needed for edits.',
    scope: 'finapp:read',
    widget: 'expense',
    input: { transactionId: docId('Transaction') },
    run: (args) => client.query(api.mcp.getTransaction, { transactionId: args.transactionId }),
  }),
  defineTool({
    name: 'finapp.finance.transactions.create',
    title: 'Create transaction',
    description:
      'Record one personal transaction on an owned account. Use account, category and currency from finapp.finance.accounts.list / categories.list. Optional line items must sum to amountMinor.',
    scope: 'finapp:write:finance',
    input: {
      accountId: docId('Account'),
      type: transactionType,
      amountMinor: minorUnits,
      currency,
      categoryId: docId('Category').optional(),
      title: z.string().min(1).max(200).describe('Short description, e.g. "Groceries".'),
      merchant: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
      transferAccountId: docId('Destination account (transfers only)').optional(),
      occurredAt: timestamp,
      hasTime: z.boolean().optional().describe('False when only the date is known.'),
      items: lineItems,
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.transactions.mutations.create, {
        accountId: id<'accounts'>(args.accountId),
        type: args.type,
        amountMinor: args.amountMinor,
        currency: args.currency,
        categoryId: id<'categories'>(args.categoryId),
        title: args.title,
        merchant: args.merchant,
        note: args.note,
        transferAccountId: id<'accounts'>(args.transferAccountId),
        occurredAt: args.occurredAt,
        hasTime: args.hasTime,
        clientMutationId: idempotencyKey(args.clientMutationId),
        items: prepareItems(args.items, args.amountMinor),
      }),
  }),
  defineTool({
    name: 'finapp.finance.transactions.update',
    title: 'Update transaction',
    description:
      'Replace the editable fields of one personal transaction (send every field, not just changes). Group expenses use finapp.groups.expenses.update instead.',
    scope: 'finapp:write:finance',
    input: {
      transactionId: docId('Transaction'),
      accountId: docId('Account'),
      type: z.enum(['expense', 'income', 'transfer']),
      amountMinor: minorUnits,
      currency,
      categoryId: docId('Category').optional(),
      title: z.string().min(1).max(200),
      merchant: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
      transferAccountId: docId('Destination account').optional(),
      occurredAt: timestamp,
      hasTime: z.boolean().optional(),
      items: lineItems,
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.transactions.mutations.update, {
        transactionId: id<'transactions'>(args.transactionId),
        accountId: id<'accounts'>(args.accountId),
        type: args.type,
        amountMinor: args.amountMinor,
        currency: args.currency,
        categoryId: id<'categories'>(args.categoryId),
        title: args.title,
        merchant: args.merchant,
        note: args.note,
        transferAccountId: id<'accounts'>(args.transferAccountId),
        occurredAt: args.occurredAt,
        hasTime: args.hasTime,
        clientMutationId: idempotencyKey(args.clientMutationId),
        items: prepareItems(args.items, args.amountMinor),
      }),
  }),
  defineTool({
    name: 'finapp.finance.transactions.delete',
    title: 'Delete transaction (to Trash)',
    description:
      'Delete one personal transaction. It moves to Trash and can be restored with finapp.finance.trash.restore, so no confirmation is needed. Group expenses use finapp.groups.expenses.delete.',
    scope: 'finapp:write:finance',
    input: {
      transactionId: docId('Transaction'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.transactions.mutations.softDelete, {
        transactionId: id<'transactions'>(args.transactionId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),

  // ---------- Accounts ----------
  defineTool({
    name: 'finapp.finance.accounts.list',
    title: 'List accounts',
    description:
      'Active accounts with their live balances (opening balance plus posted transactions).',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ items: await client.query(api.accounts.queries.list, {}) }),
    summarize: countSummary('accounts'),
  }),
  defineTool({
    name: 'finapp.finance.accounts.get',
    title: 'Get account',
    description: 'One account with its balance and its 50 most recent posted transactions.',
    scope: 'finapp:read',
    input: { accountId: docId('Account') },
    run: async (args) => {
      const detail = await client.query(api.accounts.queries.detail, {
        accountId: id<'accounts'>(args.accountId),
      });
      if (!detail) return null;
      const { ownerId: _owner, ...account } = detail.account;
      return {
        account: { ...account, id: account._id },
        balanceMinor: detail.balanceMinor,
        currency: account.currency,
        transactions: detail.transactions.map((transaction) => ({
          id: transaction._id,
          title: transaction.title,
          type: transaction.type,
          amountMinor: transaction.amountMinor,
          currency: transaction.currency,
          occurredAt: transaction.occurredAt,
        })),
      };
    },
  }),
  defineTool({
    name: 'finapp.finance.accounts.create',
    title: 'Create account',
    description: 'Create an owned account (cash, bank, card, wallet, loan, other).',
    scope: 'finapp:write:finance',
    input: {
      name: z.string().min(1).max(120),
      type: accountType,
      customType: z
        .string()
        .min(1)
        .max(40)
        .optional()
        .describe('Required when type is "other", e.g. "Brokerage".'),
      currency,
      openingBalanceMinor: minorUnits,
      isIncludedInTotal: z.boolean().describe('Count this account in net-worth totals.'),
      includeInAnalytics: z.boolean().optional(),
      icon: z.string().max(80).optional(),
      color: z.string().max(32).optional().describe('Hex colour, e.g. "#B7FF4A".'),
      notes: z.string().max(2000).optional(),
      provider: z.string().max(120).optional().describe('Bank or issuer name.'),
      clientMutationId: mutationId,
    },
    run: (args) => {
      if (args.type === 'other' && !args.customType?.trim())
        throw new Error('INVALID_ACCOUNT: customType is required when type is "other".');
      return client.mutation(api.accounts.mutations.create, {
        name: args.name,
        type: args.type,
        ...(args.type === 'other' ? { customType: args.customType!.trim() } : {}),
        currency: args.currency,
        openingBalanceMinor: args.openingBalanceMinor,
        isIncludedInTotal: args.isIncludedInTotal,
        includeInAnalytics: args.includeInAnalytics,
        icon: args.icon,
        color: args.color,
        notes: args.notes,
        provider: args.provider,
        clientMutationId: idempotencyKey(args.clientMutationId),
      });
    },
  }),
  defineTool({
    name: 'finapp.finance.accounts.rename',
    title: 'Rename account',
    description: 'Rename an owned account.',
    scope: 'finapp:write:finance',
    input: {
      accountId: docId('Account'),
      name: z.string().min(1).max(120),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.accounts.mutations.rename, {
        accountId: id<'accounts'>(args.accountId),
        name: args.name,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.accounts.update',
    title: 'Update account details',
    description:
      'Replace an owned account’s details (name, type, currency, opening balance, appearance, notes). Read it first with finapp.finance.accounts.get and send every field.',
    scope: 'finapp:write:finance',
    input: {
      accountId: docId('Account'),
      name: z.string().min(1).max(120),
      type: accountType,
      currency,
      openingBalanceMinor: minorUnits,
      isIncludedInTotal: z.boolean(),
      includeInAnalytics: z.boolean().optional(),
      icon: z.string().max(80).nullable().optional(),
      color: z.string().max(32).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      provider: z.string().max(120).nullable().optional(),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.accounts.mutations.updateDetails, {
        accountId: id<'accounts'>(args.accountId),
        name: args.name,
        type: args.type,
        currency: args.currency,
        openingBalanceMinor: args.openingBalanceMinor,
        isIncludedInTotal: args.isIncludedInTotal,
        includeInAnalytics: args.includeInAnalytics,
        icon: args.icon,
        color: args.color,
        notes: args.notes,
        provider: args.provider,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.accounts.set_appearance',
    title: 'Set account icon or colour',
    description:
      'Change just an account’s icon and/or colour (null resets to the default) without resending its other details.',
    scope: 'finapp:write:finance',
    input: {
      accountId: docId('Account'),
      icon: z.string().min(1).max(80).nullable().optional().describe('Icon name; null to reset.'),
      color: z
        .string()
        .max(32)
        .nullable()
        .optional()
        .describe('Colour name or hex like "#4F7CFF"; null to reset.'),
      clientMutationId: mutationId,
    },
    run: async (args) => {
      if (args.icon === undefined && args.color === undefined)
        throw new ToolInputError('NOTHING_TO_UPDATE');
      const key = idempotencyKey(args.clientMutationId);
      const accountId = id<'accounts'>(args.accountId);
      if (args.icon !== undefined)
        await client.mutation(api.accounts.mutations.setIcon, {
          accountId,
          icon: args.icon,
          clientMutationId: `${key}:icon`,
        });
      if (args.color !== undefined)
        await client.mutation(api.accounts.mutations.setColor, {
          accountId,
          color: args.color,
          clientMutationId: `${key}:color`,
        });
      return { accountId };
    },
  }),
  defineTool({
    name: 'finapp.finance.accounts.archive',
    title: 'Archive account',
    description: 'Archive an owned account after explicit user confirmation.',
    scope: 'finapp:write:finance',
    destructive: true,
    input: {
      accountId: docId('Account'),
      confirm: confirm('archive this account'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.accounts.mutations.archive, {
        accountId: id<'accounts'>(args.accountId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),

  // ---------- Categories ----------
  defineTool({
    name: 'finapp.finance.categories.list',
    title: 'List categories',
    description:
      'Active categories with this month’s spent/received totals and any monthly limit (a category’s limit is its budget). Use the ids for transaction and category-limit tools.',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ items: await client.query(api.categories.queries.overview, {}) }),
    summarize: countSummary('categories'),
  }),
  defineTool({
    name: 'finapp.finance.categories.get',
    title: 'Get category',
    description: 'One category with its 50 most recent posted transactions.',
    scope: 'finapp:read',
    input: { categoryId: docId('Category') },
    run: async (args) => {
      const detail = await client.query(api.categories.queries.detail, {
        categoryId: id<'categories'>(args.categoryId),
      });
      if (!detail) return null;
      return { ...detail, transactions: detail.transactions.slice(0, 50) };
    },
  }),
  defineTool({
    name: 'finapp.finance.categories.create',
    title: 'Create category',
    description: 'Create an expense or income category, optionally with a monthly limit.',
    scope: 'finapp:write:finance',
    input: {
      name: z.string().min(1).max(120),
      kind: z.enum(['expense', 'income']).optional(),
      icon: z.string().max(80).optional().describe('Emoji or icon name, e.g. "🍔".'),
      color: z.string().max(32).optional(),
      notes: z.string().max(2000).optional(),
      monthlyLimitMinor: minorUnits.optional(),
      limitCurrency: currency.optional(),
      limitAlertPercent: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Alert when this % of the monthly limit is spent. Default 80.'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.categories.mutations.create, {
        name: args.name,
        kind: args.kind,
        icon: args.icon,
        color: args.color,
        notes: args.notes,
        monthlyLimitMinor: args.monthlyLimitMinor,
        limitCurrency: args.limitCurrency,
        limitAlertPercent: args.limitAlertPercent,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.categories.rename',
    title: 'Rename category',
    description: 'Rename a user-owned category.',
    scope: 'finapp:write:finance',
    input: {
      categoryId: docId('Category'),
      name: z.string().min(1).max(120),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.categories.mutations.rename, {
        categoryId: id<'categories'>(args.categoryId),
        name: args.name,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.categories.update',
    title: 'Update category preferences',
    description: 'Change a category’s kind, colour, icon or notes.',
    scope: 'finapp:write:finance',
    input: {
      categoryId: docId('Category'),
      kind: z.enum(['expense', 'income']),
      color: z.string().max(32).nullable(),
      // Same limit as categories.setIcon, so a bad icon fails before anything changes.
      icon: z.string().min(1).max(32).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      clientMutationId: mutationId,
    },
    run: async (args) => {
      const key = idempotencyKey(args.clientMutationId);
      const categoryId = id<'categories'>(args.categoryId);
      // Preferences carry the broader validation (colour, system categories), so they go first;
      // the icon is pre-validated by this schema (1-32 chars), matching categories.setIcon.
      const result = await client.mutation(api.categories.mutations.setPreferences, {
        categoryId,
        kind: args.kind,
        color: args.color,
        notes: args.notes,
        clientMutationId: key,
      });
      if (args.icon !== undefined) {
        await client.mutation(api.categories.mutations.setIcon, {
          categoryId,
          icon: args.icon,
          clientMutationId: `${key}:icon`,
        });
      }
      return result ?? { categoryId };
    },
  }),
  defineTool({
    name: 'finapp.finance.categories.set_limit',
    title: 'Set category monthly limit',
    description:
      'Set, change or clear (amountMinor null) a category’s monthly spending limit — its budget — and the alert level. Budgets are category limits.',
    scope: 'finapp:write:finance',
    input: {
      categoryId: docId('Category'),
      amountMinor: minorUnits.nullable(),
      currency: currency.optional(),
      alertPercent: z
        .number()
        .min(1)
        .max(100)
        .nullable()
        .optional()
        .describe('Alert when this % is spent (null resets to 80). Omit to keep the current one.'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.categories.mutations.setLimit, {
        categoryId: id<'categories'>(args.categoryId),
        amountMinor: args.amountMinor,
        currency: args.currency,
        alertPercent: args.alertPercent,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.categories.archive',
    title: 'Delete category (to Trash)',
    description:
      'Move a user-owned category to Trash after explicit user confirmation. Ask the user whether its transactions should be kept (default) or moved to Trash too (deleteTransactions: true). Restorable from Trash.',
    scope: 'finapp:write:finance',
    destructive: true,
    input: {
      categoryId: docId('Category'),
      deleteTransactions: z
        .boolean()
        .optional()
        .describe('Also move the category’s transactions to Trash (restored with it).'),
      confirm: confirm('delete this category'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.categories.mutations.archive, {
        categoryId: id<'categories'>(args.categoryId),
        ...(args.deleteTransactions ? { deleteTransactions: true } : {}),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),

  // ---------- Category limits (budgets) ----------
  defineTool({
    name: 'finapp.finance.category_limits.list',
    title: 'List category limits with usage',
    description:
      'Categories that have a monthly limit (their budget), with this month’s spent, remaining, percent used, alert level and status (normal, warning, near-limit, exceeded). Set or clear one with finapp.finance.categories.set_limit.',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ items: await client.query(api.categories.queries.limits, {}) }),
    summarize: countSummary('category limits'),
  }),

  // ---------- Goals ----------
  defineTool({
    name: 'finapp.finance.goals.list',
    title: 'List savings goals',
    description: 'One page of active savings goals with saved and target amounts.',
    scope: 'finapp:read',
    input: { limit, cursor },
    run: (args) =>
      client.query(api.mcp.listOwnedRecords, { resource: 'goals', paginationOpts: page(args) }),
    summarize: countSummary('goals'),
  }),
  defineTool({
    name: 'finapp.finance.goals.create',
    title: 'Create savings goal',
    description: 'Create a savings goal with a positive target.',
    scope: 'finapp:write:finance',
    input: {
      name: z.string().min(1).max(120),
      targetAmountMinor: minorUnits,
      currency,
      targetDate: timestamp.optional(),
      icon: z.string().max(80).optional(),
      color: z.string().max(32).optional(),
      goalType: z.string().max(60).optional().describe('Free label, e.g. "emergency fund".'),
      monthlyContributionMinor: minorUnits.optional(),
      accountId: docId('Linked account').optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      reminderFrequency: z.enum(['none', 'weekly', 'monthly']).optional(),
      notes: z.string().max(2000).optional(),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.goals.mutations.create, {
        name: args.name,
        targetAmountMinor: args.targetAmountMinor,
        currency: args.currency,
        targetDate: args.targetDate,
        icon: args.icon,
        color: args.color,
        goalType: args.goalType,
        monthlyContributionMinor: args.monthlyContributionMinor,
        accountId: id<'accounts'>(args.accountId),
        priority: args.priority,
        reminderFrequency: args.reminderFrequency,
        notes: args.notes,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.goals.update',
    title: 'Update savings goal',
    description: 'Replace a goal’s name, target, date, plan, appearance and notes.',
    scope: 'finapp:write:finance',
    input: {
      goalId: docId('Goal'),
      name: z.string().min(1).max(120),
      targetAmountMinor: minorUnits,
      targetDate: timestamp.nullable().optional(),
      icon: z.string().max(80).nullable().optional(),
      color: z.string().max(32).nullable().optional(),
      goalType: z.string().max(60).nullable().optional(),
      monthlyContributionMinor: minorUnits.nullable().optional(),
      accountId: docId('Linked account').nullable().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      reminderFrequency: z.enum(['none', 'weekly', 'monthly']).optional(),
      notes: z.string().max(2000).nullable().optional(),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.goals.mutations.update, {
        goalId: id<'goals'>(args.goalId),
        name: args.name,
        targetAmountMinor: args.targetAmountMinor,
        targetDate: args.targetDate,
        icon: args.icon,
        color: args.color,
        goalType: args.goalType,
        monthlyContributionMinor: args.monthlyContributionMinor,
        accountId: id<'accounts'>(args.accountId),
        priority: args.priority,
        reminderFrequency: args.reminderFrequency,
        notes: args.notes,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.goals.contribute',
    title: 'Contribute to goal',
    description: 'Add money saved toward a goal.',
    scope: 'finapp:write:finance',
    input: { goalId: docId('Goal'), amountMinor: minorUnits, clientMutationId: mutationId },
    run: (args) =>
      client.mutation(api.goals.mutations.contribute, {
        goalId: id<'goals'>(args.goalId),
        amountMinor: args.amountMinor,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.goals.archive',
    title: 'Archive savings goal',
    description: 'Archive a goal after explicit user confirmation.',
    scope: 'finapp:write:finance',
    destructive: true,
    input: {
      goalId: docId('Goal'),
      confirm: confirm('archive this goal'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.goals.mutations.archive, {
        goalId: id<'goals'>(args.goalId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.goal_contributions.list',
    title: 'List goal contributions',
    description: 'One page of goal contributions, optionally within a date window.',
    scope: 'finapp:read',
    input: {
      startAt: timestamp.optional(),
      endAt: timestamp.optional(),
      limit,
      cursor,
    },
    run: (args) =>
      client.query(api.mcp.listOwnedRecords, {
        resource: 'goalContributions',
        startAt: args.startAt,
        endAt: args.endAt,
        paginationOpts: page(args),
      }),
    summarize: countSummary('contributions'),
  }),

  // ---------- Recurring ----------
  defineTool({
    name: 'finapp.finance.recurring.list',
    title: 'List recurring rules',
    description: 'One page of recurring bills and reminders.',
    scope: 'finapp:read',
    input: { limit, cursor },
    run: (args) =>
      client.query(api.mcp.listOwnedRecords, {
        resource: 'recurringRules',
        paginationOpts: page(args),
      }),
    summarize: countSummary('recurring rules'),
  }),
  defineTool({
    name: 'finapp.finance.recurring.create',
    title: 'Create recurring rule',
    description: 'Schedule a recurring expense reminder on an owned account.',
    scope: 'finapp:write:finance',
    input: {
      name: z.string().min(1).max(120),
      amountMinor: minorUnits,
      currency,
      accountId: docId('Account'),
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      nextOccurrence: timestamp,
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.recurring.mutations.create, {
        name: args.name,
        amountMinor: args.amountMinor,
        currency: args.currency,
        accountId: id<'accounts'>(args.accountId),
        frequency: args.frequency,
        nextOccurrence: args.nextOccurrence,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.finance.recurring.set_enabled',
    title: 'Pause or resume recurring rule',
    description: 'Enable or pause a recurring rule.',
    scope: 'finapp:write:finance',
    input: { ruleId: docId('Recurring rule'), enabled: z.boolean(), clientMutationId: mutationId },
    run: (args) =>
      client.mutation(api.recurring.mutations.setEnabled, {
        ruleId: id<'recurringRules'>(args.ruleId),
        enabled: args.enabled,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),

  defineTool({
    name: 'finapp.finance.recurring.delete',
    title: 'Delete recurring rule (to Trash)',
    description:
      'Move a recurring rule to Trash after explicit user confirmation. It stops running and can be restored from Trash.',
    scope: 'finapp:write:finance',
    destructive: true,
    input: {
      ruleId: docId('Recurring rule'),
      confirm: confirm('delete this recurring rule'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.recurring.mutations.remove, {
        ruleId: id<'recurringRules'>(args.ruleId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),

  // ---------- Trash ----------
  defineTool({
    name: 'finapp.finance.trash.list',
    title: 'List Trash',
    description:
      'Deleted transactions, accounts, categories, goals and recurring rules in Trash (plus budgets trashed before budgets became category limits; restoring one sets its category’s limit), with when each will be deleted for good.',
    scope: 'finapp:read',
    input: {
      kind: z
        .enum(['transaction', 'account', 'category', 'budget', 'goal', 'recurring'])
        .optional(),
    },
    run: (args) => client.query(api.trash.list, args.kind ? { kind: args.kind } : {}),
  }),
  defineTool({
    name: 'finapp.finance.trash.restore',
    title: 'Restore from Trash',
    description:
      'Restore an item from Trash (a category or account brings back what was trashed with it).',
    scope: 'finapp:write:finance',
    input: {
      kind: z.enum(['transaction', 'account', 'category', 'budget', 'goal', 'recurring']),
      id: z.string().min(1).max(64),
    },
    run: (args) => client.mutation(api.trash.restore, { kind: args.kind, id: args.id }),
  }),
  defineTool({
    name: 'finapp.finance.trash.purge',
    title: 'Delete from Trash for good',
    description:
      'Permanently delete a Trash item after explicit user confirmation. Cannot be undone; an account takes its transactions with it, a goal its contributions.',
    scope: 'finapp:write:finance',
    destructive: true,
    input: {
      kind: z.enum(['transaction', 'account', 'category', 'budget', 'goal', 'recurring']),
      id: z.string().min(1).max(64),
      confirm: confirm('permanently delete this item'),
    },
    run: (args) => client.mutation(api.trash.purge, { kind: args.kind, id: args.id }),
  }),
  defineTool({
    name: 'finapp.finance.trash.empty',
    title: 'Empty Trash',
    description:
      'Permanently delete everything in Trash after explicit user confirmation (up to 100 items per call; when `more` is true, ask before calling again). Cannot be undone. Group expenses are never in Trash.',
    scope: 'finapp:write:finance',
    destructive: true,
    input: { confirm: confirm('permanently delete everything in Trash') },
    run: () => client.mutation(api.trash.empty, {}),
    summarize: (data) => {
      const result = data as { purged?: number; more?: boolean } | null;
      if (typeof result?.purged !== 'number') return undefined;
      return `Deleted ${result.purged} item(s) for good${result.more ? '; more remain in Trash' : ''}.`;
    },
  }),
  defineTool({
    name: 'finapp.finance.trash.set_retention',
    title: 'Set Trash retention',
    description:
      'How many days deleted items stay in Trash before being deleted for good (0 = keep until emptied). Read the current value from finapp.finance.trash.list (retentionDays).',
    scope: 'finapp:write:finance',
    idempotent: true,
    input: {
      days: z
        .union([
          z.literal(1),
          z.literal(7),
          z.literal(14),
          z.literal(30),
          z.literal(60),
          z.literal(90),
          z.literal(0),
        ])
        .describe('One of 1, 7, 14, 30, 60, 90, or 0 (never auto-delete).'),
    },
    run: async (args) => ({
      retentionDays: await client.mutation(api.trash.setRetention, { days: args.days }),
    }),
  }),

  // ---------- Analytics ----------
  defineTool({
    name: 'finapp.finance.analytics.summary',
    title: 'Spending analytics',
    description:
      'Spending and income for a week, month or year in the default currency, broken down by category and compared with the preceding period (previousStartAt..startAt). The window must match the period length.',
    scope: 'finapp:read',
    input: {
      period: z.enum(['week', 'month', 'year']),
      startAt: timestamp,
      endAt: timestamp,
      previousStartAt: timestamp,
    },
    run: (args) => client.query(api.analytics.queries.summary, args),
  }),
  defineTool({
    name: 'finapp.finance.dashboard.summary',
    title: 'Summarize one page of transactions',
    description:
      'Totals for one bounded page of transactions in a date window. Prefer finapp.finance.overview; use this to aggregate very large windows page by page with nextCursor.',
    scope: 'finapp:read',
    input: { startAt: timestamp, endAt: timestamp, limit, cursor },
    run: (args) =>
      client.query(api.mcp.dashboardPreview, {
        startAt: args.startAt,
        endAt: args.endAt,
        paginationOpts: page(args),
      }),
  }),
];
