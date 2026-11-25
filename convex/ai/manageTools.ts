/**
 * FinAI tools for managing everything: edit transactions; create / edit budgets, goals,
 * categories, accounts and recurring payments; move things to Trash; restore or delete Trash
 * items for good.
 *
 * Confirmation policy:
 * - Deleting a transaction runs immediately (it goes to Trash and can be restored).
 * - Restoring from Trash runs immediately (nothing is lost).
 * - Everything else — creates, edits, moving budgets / goals / categories / accounts / recurring
 *   to Trash, and deleting for good — becomes a confirmation card the user must press.
 */
import { api, internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { formatMinor, shortDate } from './present';
import { amountMinor, date, oneOf, requiredStr, s, str, ToolArgError } from './toolArgs';
import { propose, type FinaiTool, type FinaiToolCtx } from './toolContext';

const KINDS = ['budget', 'goal', 'category', 'account', 'recurring'] as const;
const TRASH_KINDS = ['transaction', 'account', 'category', 'budget', 'goal', 'recurring'] as const;
type Kind = (typeof TRASH_KINDS)[number];
const DAY = 86_400_000;

async function owned(ctx: FinaiToolCtx, kind: Kind, id: string) {
  const doc = await ctx.run.runQuery(internal.ai.records.owned, { userId: ctx.userId, kind, id });
  if (!doc) throw new ToolArgError('NOT_FOUND');
  return doc as Record<string, unknown>;
}

const nameOf = (doc: Record<string, unknown>) => String(doc.name ?? doc.title ?? 'Untitled');
const monthBounds = (now: number) => {
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
  return { start, end };
};

export const manageTools: FinaiTool[] = [
  {
    name: 'delete_transaction',
    description:
      'Delete one of the user’s personal transactions right away. It moves to Trash (restorable from Trash). Use the id from search_transactions. Group expenses can’t be deleted here.',
    parameters: s.object({ transactionId: s.string('Transaction id.') }, ['transactionId']),
    progress: { stage: 'working', label: 'Moving it to Trash…' },
    run: async (ctx, args) => {
      const id = requiredStr(args, 'transactionId', 64);
      const doc = await owned(ctx, 'transaction', id);
      if (doc.deletedAt !== undefined) return { data: { status: 'already_in_trash', id } };
      await ctx.run.runMutation(api.transactions.mutations.softDelete, {
        transactionId: id as Id<'transactions'>,
        clientMutationId: `finai-del:${ctx.messageId}:${id}`,
      });
      return {
        data: {
          status: 'moved_to_trash',
          id,
          title: nameOf(doc),
          note: 'Tell the user it moved to Trash and can be restored from there.',
        },
      };
    },
  },
  {
    name: 'list_trash',
    description:
      'What is in the user’s Trash (deleted transactions, accounts, categories, budgets, goals, recurring), with ids and when each will be deleted for good.',
    parameters: s.object({
      kind: s.enumOf('Only this kind (optional).', [...TRASH_KINDS]),
    }),
    progress: { stage: 'searching', label: 'Looking in Trash…' },
    run: async (ctx, args) => {
      const kind = oneOf(args, 'kind', TRASH_KINDS);
      const result = await ctx.run.runQuery(api.trash.list, kind ? { kind } : {});
      return {
        data: {
          retentionDays: result.retentionDays,
          items: result.items.slice(0, 40).map((item) => ({
            kind: item.kind,
            id: item.id,
            title: item.title,
            detail: item.subtitle,
            deletedOn: shortDate(item.deletedAt, ctx.timeZone),
            deletedForGoodOn: item.purgeAt ? shortDate(item.purgeAt, ctx.timeZone) : 'never',
          })),
        },
      };
    },
  },
  {
    name: 'restore_from_trash',
    description: 'Restore an item from Trash right away (use kind and id from list_trash).',
    parameters: s.object(
      { kind: s.enumOf('Item kind.', [...TRASH_KINDS]), id: s.string('Item id.') },
      ['kind', 'id'],
    ),
    progress: { stage: 'working', label: 'Restoring…' },
    run: async (ctx, args) => {
      const kind = oneOf(args, 'kind', TRASH_KINDS);
      if (!kind) throw new ToolArgError('MISSING_KIND');
      const id = requiredStr(args, 'id', 64);
      const result = await ctx.run.runMutation(api.trash.restore, { kind, id });
      return { data: { status: 'restored', kind, id, itemsRestored: result.restored } };
    },
  },
  {
    name: 'list_recurring',
    description:
      'The user’s recurring payments and bills, with ids, amounts, frequency and next date.',
    parameters: s.object({}),
    progress: { stage: 'searching', label: 'Reading recurring payments…' },
    run: async (ctx) => {
      const page = await ctx.run.runQuery(api.mcp.listOwnedRecords, {
        resource: 'recurringRules',
        paginationOpts: { numItems: 50, cursor: null },
      });
      return { data: { items: page.items } };
    },
  },
  {
    name: 'propose_transaction_update',
    description:
      'Prepare an edit to one personal transaction (only the fields given change). The user must press Confirm.',
    parameters: s.object(
      {
        transactionId: s.string('Transaction id.'),
        title: s.string('New title.'),
        amount: s.amount('New total.'),
        type: s.enumOf('New kind.', ['expense', 'income']),
        categoryId: s.string('New category id.'),
        accountId: s.string('New account id (same currency).'),
        merchant: s.string('New merchant.'),
        note: s.string('New note.'),
        date: s.date('New date.'),
      },
      ['transactionId'],
    ),
    progress: { stage: 'working', label: 'Preparing the edit…' },
    run: async (ctx, args) => {
      const id = requiredStr(args, 'transactionId', 64);
      const doc = await owned(ctx, 'transaction', id);
      const currency = String(doc.currency);
      const amount = amountMinor(args, 'amount', currency);
      const occurredAt = date(args, 'date');
      const changes: { label: string; value: string }[] = [];
      const payload: Record<string, unknown> = { transactionId: id };
      if (str(args, 'title', 120)) {
        payload.title = str(args, 'title', 120);
        changes.push({ label: 'Title', value: String(payload.title) });
      }
      if (amount !== undefined) {
        payload.amountMinor = amount;
        changes.push({ label: 'Amount', value: formatMinor(amount, currency) });
      }
      const type = oneOf(args, 'type', ['expense', 'income'] as const);
      if (type) {
        payload.type = type;
        changes.push({ label: 'Kind', value: type });
      }
      for (const key of ['categoryId', 'accountId', 'merchant', 'note'] as const) {
        const value = str(args, key, key === 'note' ? 500 : 120);
        if (value) {
          payload[key] = value;
          changes.push({ label: key.replace('Id', ''), value });
        }
      }
      if (occurredAt) {
        payload.occurredAt = occurredAt;
        changes.push({ label: 'Date', value: shortDate(occurredAt, ctx.timeZone) });
      }
      if (!changes.length) throw new ToolArgError('NOTHING_TO_CHANGE');
      return propose(ctx, {
        kind: 'transaction.update',
        title: `Edit “${nameOf(doc)}”`,
        payload,
        lines: changes,
      });
    },
  },
  {
    name: 'propose_budget',
    description:
      'Prepare a new monthly budget (spending limit), usually for one category. The user must press Confirm.',
    parameters: s.object(
      {
        name: s.string('Budget name, e.g. "Food".'),
        amount: s.amount('Monthly limit.'),
        categoryId: s.string('Category id from list_categories.'),
        currency: s.string('ISO code. Default: the user’s default currency.'),
        alertAt: s.integer('Alert when this % is used (1-100). Default 80.', 1, 100),
      },
      ['name', 'amount'],
    ),
    progress: { stage: 'working', label: 'Preparing the budget…' },
    run: async (ctx, args) => {
      const currency = (str(args, 'currency', 3) ?? ctx.defaultCurrency).toUpperCase();
      const amount = amountMinor(args, 'amount', currency);
      if (amount === undefined) throw new ToolArgError('MISSING_AMOUNT');
      const { start, end } = monthBounds(Date.now());
      const name = requiredStr(args, 'name', 80);
      const categoryId = str(args, 'categoryId', 64);
      if (categoryId) await owned(ctx, 'category', categoryId);
      const alert = typeof args.alertAt === 'number' ? Math.round(args.alertAt) : 80;
      return propose(ctx, {
        kind: 'budget.create',
        title: `New budget: ${name}`,
        payload: {
          name,
          amountMinor: amount,
          currency,
          startAt: start,
          endAt: end,
          alertThreshold: alert,
          ...(categoryId ? { categoryId } : {}),
        },
        lines: [
          { label: 'Monthly limit', value: formatMinor(amount, currency) },
          { label: 'Alert at', value: `${alert}%` },
        ],
      });
    },
  },
  {
    name: 'propose_budget_update',
    description:
      'Prepare a change to a budget’s name, limit or alert level. The user must press Confirm.',
    parameters: s.object(
      {
        budgetId: s.string('Budget id from list_budgets.'),
        name: s.string('New name.'),
        amount: s.amount('New limit.'),
        alertAt: s.integer('New alert %.', 1, 100),
      },
      ['budgetId'],
    ),
    progress: { stage: 'working', label: 'Preparing the budget change…' },
    run: async (ctx, args) => {
      const id = requiredStr(args, 'budgetId', 64);
      const doc = await owned(ctx, 'budget', id);
      const currency = String(doc.currency);
      const amount = amountMinor(args, 'amount', currency);
      const payload: Record<string, unknown> = { budgetId: id };
      const lines: { label: string; value: string }[] = [];
      if (str(args, 'name', 80)) {
        payload.name = str(args, 'name', 80);
        lines.push({ label: 'Name', value: String(payload.name) });
      }
      if (amount !== undefined) {
        payload.amountMinor = amount;
        lines.push({ label: 'Limit', value: formatMinor(amount, currency) });
      }
      if (typeof args.alertAt === 'number') {
        payload.alertThreshold = Math.round(args.alertAt);
        lines.push({ label: 'Alert at', value: `${payload.alertThreshold}%` });
      }
      if (!lines.length) throw new ToolArgError('NOTHING_TO_CHANGE');
      return propose(ctx, {
        kind: 'budget.update',
        title: `Update budget “${nameOf(doc)}”`,
        payload,
        lines,
      });
    },
  },
  {
    name: 'propose_goal',
    description: 'Prepare a new savings goal. The user must press Confirm.',
    parameters: s.object(
      {
        name: s.string('Goal name, e.g. "Emergency fund".'),
        target: s.amount('Target amount.'),
        targetDate: s.date('Target date (optional).'),
        monthly: s.amount('Planned monthly contribution (optional).'),
        currency: s.string('ISO code. Default: the user’s default currency.'),
        notes: s.string('Notes (optional).'),
      },
      ['name', 'target'],
    ),
    progress: { stage: 'working', label: 'Preparing the goal…' },
    run: async (ctx, args) => {
      const currency = (str(args, 'currency', 3) ?? ctx.defaultCurrency).toUpperCase();
      const target = amountMinor(args, 'target', currency);
      if (target === undefined) throw new ToolArgError('MISSING_AMOUNT');
      const monthly = amountMinor(args, 'monthly', currency);
      const targetDate = date(args, 'targetDate');
      const name = requiredStr(args, 'name', 80);
      return propose(ctx, {
        kind: 'goal.create',
        title: `New goal: ${name}`,
        payload: {
          name,
          targetAmountMinor: target,
          currency,
          ...(targetDate ? { targetDate } : {}),
          ...(monthly !== undefined ? { monthlyContributionMinor: monthly } : {}),
          ...(str(args, 'notes', 500) ? { notes: str(args, 'notes', 500) } : {}),
        },
        lines: [
          { label: 'Target', value: formatMinor(target, currency) },
          ...(targetDate ? [{ label: 'By', value: shortDate(targetDate, ctx.timeZone) }] : []),
          ...(monthly !== undefined
            ? [{ label: 'Monthly', value: formatMinor(monthly, currency) }]
            : []),
        ],
      });
    },
  },
  {
    name: 'propose_goal_update',
    description:
      'Prepare a change to a goal (name, target, date, monthly plan). The user must press Confirm.',
    parameters: s.object(
      {
        goalId: s.string('Goal id from list_goals.'),
        name: s.string('New name.'),
        target: s.amount('New target.'),
        targetDate: s.date('New target date.'),
        monthly: s.amount('New monthly contribution.'),
        notes: s.string('New notes.'),
      },
      ['goalId'],
    ),
    progress: { stage: 'working', label: 'Preparing the goal change…' },
    run: async (ctx, args) => {
      const id = requiredStr(args, 'goalId', 64);
      const doc = await owned(ctx, 'goal', id);
      const currency = String(doc.currency);
      const payload: Record<string, unknown> = { goalId: id };
      const lines: { label: string; value: string }[] = [];
      if (str(args, 'name', 80)) {
        payload.name = str(args, 'name', 80);
        lines.push({ label: 'Name', value: String(payload.name) });
      }
      const target = amountMinor(args, 'target', currency);
      if (target !== undefined) {
        payload.targetAmountMinor = target;
        lines.push({ label: 'Target', value: formatMinor(target, currency) });
      }
      const targetDate = date(args, 'targetDate');
      if (targetDate) {
        payload.targetDate = targetDate;
        lines.push({ label: 'By', value: shortDate(targetDate, ctx.timeZone) });
      }
      const monthly = amountMinor(args, 'monthly', currency);
      if (monthly !== undefined) {
        payload.monthlyContributionMinor = monthly;
        lines.push({ label: 'Monthly', value: formatMinor(monthly, currency) });
      }
      if (str(args, 'notes', 500)) {
        payload.notes = str(args, 'notes', 500);
        lines.push({ label: 'Notes', value: String(payload.notes) });
      }
      if (!lines.length) throw new ToolArgError('NOTHING_TO_CHANGE');
      return propose(ctx, {
        kind: 'goal.update',
        title: `Update goal “${nameOf(doc)}”`,
        payload,
        lines,
      });
    },
  },
  {
    name: 'propose_category',
    description: 'Prepare a new category. The user must press Confirm.',
    parameters: s.object(
      {
        name: s.string('Category name.'),
        kind: s.enumOf('Expense or income. Default expense.', ['expense', 'income']),
        icon: s.string('One emoji (optional).'),
        monthlyLimit: s.amount('Monthly limit (optional).'),
        currency: s.string('Limit currency. Default: the user’s default currency.'),
      },
      ['name'],
    ),
    progress: { stage: 'working', label: 'Preparing the category…' },
    run: async (ctx, args) => {
      const name = requiredStr(args, 'name', 60);
      const currency = (str(args, 'currency', 3) ?? ctx.defaultCurrency).toUpperCase();
      const limit = amountMinor(args, 'monthlyLimit', currency);
      const kind = oneOf(args, 'kind', ['expense', 'income'] as const) ?? 'expense';
      return propose(ctx, {
        kind: 'category.create',
        title: `New ${kind} category: ${name}`,
        payload: {
          name,
          kind,
          ...(str(args, 'icon', 16) ? { icon: str(args, 'icon', 16) } : {}),
          ...(limit !== undefined ? { monthlyLimitMinor: limit, limitCurrency: currency } : {}),
        },
        lines: [
          { label: 'Kind', value: kind },
          ...(limit !== undefined
            ? [{ label: 'Monthly limit', value: formatMinor(limit, currency) }]
            : []),
        ],
      });
    },
  },
  {
    name: 'propose_category_update',
    description:
      'Prepare a rename, new emoji or new monthly limit for a category. The user must press Confirm.',
    parameters: s.object(
      {
        categoryId: s.string('Category id.'),
        name: s.string('New name.'),
        icon: s.string('New emoji.'),
        monthlyLimit: s.amount('New monthly limit ("0" removes it).'),
      },
      ['categoryId'],
    ),
    progress: { stage: 'working', label: 'Preparing the category change…' },
    run: async (ctx, args) => {
      const id = requiredStr(args, 'categoryId', 64);
      const doc = await owned(ctx, 'category', id);
      const currency = String(doc.limitCurrency ?? ctx.defaultCurrency);
      const payload: Record<string, unknown> = { categoryId: id };
      const lines: { label: string; value: string }[] = [];
      if (str(args, 'name', 60)) {
        payload.name = str(args, 'name', 60);
        lines.push({ label: 'Name', value: String(payload.name) });
      }
      if (str(args, 'icon', 16)) {
        payload.icon = str(args, 'icon', 16);
        lines.push({ label: 'Emoji', value: String(payload.icon) });
      }
      const limit = amountMinor(args, 'monthlyLimit', currency);
      if (limit !== undefined) {
        payload.monthlyLimitMinor = limit === 0n ? null : limit;
        payload.limitCurrency = currency;
        lines.push({
          label: 'Monthly limit',
          value: limit === 0n ? 'None' : formatMinor(limit, currency),
        });
      }
      if (!lines.length) throw new ToolArgError('NOTHING_TO_CHANGE');
      return propose(ctx, {
        kind: 'category.update',
        title: `Update category “${nameOf(doc)}”`,
        payload,
        lines,
      });
    },
  },
  {
    name: 'propose_account',
    description:
      'Prepare a new account (bank, cash, card, wallet, loan). The user must press Confirm.',
    parameters: s.object(
      {
        name: s.string('Account name.'),
        type: s.enumOf('Account type. Default bank.', [
          'cash',
          'bank',
          'card',
          'wallet',
          'loan',
          'other',
        ]),
        currency: s.string('ISO code. Default: the user’s default currency.'),
        openingBalance: s.amount('Opening balance (optional, default 0).'),
      },
      ['name'],
    ),
    progress: { stage: 'working', label: 'Preparing the account…' },
    run: async (ctx, args) => {
      const name = requiredStr(args, 'name', 60);
      const currency = (str(args, 'currency', 3) ?? ctx.defaultCurrency).toUpperCase();
      const balance = amountMinor(args, 'openingBalance', currency) ?? 0n;
      const type =
        oneOf(args, 'type', ['cash', 'bank', 'card', 'wallet', 'loan', 'other'] as const) ?? 'bank';
      return propose(ctx, {
        kind: 'account.create',
        title: `New account: ${name}`,
        payload: { name, type, currency, openingBalanceMinor: balance },
        lines: [
          { label: 'Type', value: type },
          { label: 'Opening balance', value: formatMinor(balance, currency) },
        ],
      });
    },
  },
  {
    name: 'propose_account_update',
    description:
      'Prepare a rename, type change or new opening balance for an account. The user must press Confirm.',
    parameters: s.object(
      {
        accountId: s.string('Account id.'),
        name: s.string('New name.'),
        type: s.enumOf('New type.', ['cash', 'bank', 'card', 'wallet', 'loan', 'other']),
        openingBalance: s.amount('New opening balance.'),
      },
      ['accountId'],
    ),
    progress: { stage: 'working', label: 'Preparing the account change…' },
    run: async (ctx, args) => {
      const id = requiredStr(args, 'accountId', 64);
      const doc = await owned(ctx, 'account', id);
      const currency = String(doc.currency);
      const payload: Record<string, unknown> = { accountId: id };
      const lines: { label: string; value: string }[] = [];
      if (str(args, 'name', 60)) {
        payload.name = str(args, 'name', 60);
        lines.push({ label: 'Name', value: String(payload.name) });
      }
      const type = oneOf(args, 'type', [
        'cash',
        'bank',
        'card',
        'wallet',
        'loan',
        'other',
      ] as const);
      if (type) {
        payload.type = type;
        lines.push({ label: 'Type', value: type });
      }
      const balance = amountMinor(args, 'openingBalance', currency);
      if (balance !== undefined) {
        payload.openingBalanceMinor = balance;
        lines.push({ label: 'Opening balance', value: formatMinor(balance, currency) });
      }
      if (!lines.length) throw new ToolArgError('NOTHING_TO_CHANGE');
      return propose(ctx, {
        kind: 'account.update',
        title: `Update account “${nameOf(doc)}”`,
        payload,
        lines,
      });
    },
  },
  {
    name: 'propose_recurring',
    description:
      'Prepare a new recurring payment or bill (e.g. rent monthly). The user must press Confirm.',
    parameters: s.object(
      {
        name: s.string('Name, e.g. "Rent".'),
        amount: s.amount('Amount each time.'),
        frequency: s.enumOf('How often.', ['daily', 'weekly', 'monthly', 'yearly']),
        firstDate: s.date('Next/first date.'),
        accountId: s.string('Account id (optional; default account in the currency).'),
        currency: s.string('ISO code. Default: the user’s default currency.'),
      },
      ['name', 'amount', 'frequency', 'firstDate'],
    ),
    progress: { stage: 'working', label: 'Preparing the recurring payment…' },
    run: async (ctx, args) => {
      const name = requiredStr(args, 'name', 80);
      const currency = (str(args, 'currency', 3) ?? ctx.defaultCurrency).toUpperCase();
      const amount = amountMinor(args, 'amount', currency);
      if (amount === undefined) throw new ToolArgError('MISSING_AMOUNT');
      const frequency = oneOf(args, 'frequency', ['daily', 'weekly', 'monthly', 'yearly'] as const);
      if (!frequency) throw new ToolArgError('MISSING_FREQUENCY');
      const nextOccurrence = date(args, 'firstDate') ?? Date.now() + DAY;
      const accounts = await ctx.run.runQuery(api.accounts.queries.list, {});
      const preferred = str(args, 'accountId', 64);
      const account =
        (preferred && accounts.find((row) => String(row.id) === preferred)) ||
        accounts.find((row) => row.currency === currency);
      if (!account) throw new ToolArgError('NO_ACCOUNT_IN_CURRENCY');
      return propose(ctx, {
        kind: 'recurring.create',
        title: `New recurring: ${name}`,
        payload: {
          name,
          amountMinor: amount,
          currency,
          accountId: String(account.id),
          frequency,
          nextOccurrence,
        },
        lines: [
          { label: 'Amount', value: formatMinor(amount, currency) },
          { label: 'Every', value: frequency.replace('ly', '').replace('dai', 'day') },
          { label: 'Next', value: shortDate(nextOccurrence, ctx.timeZone) },
          { label: 'Account', value: account.name },
        ],
      });
    },
  },
  {
    name: 'propose_delete',
    description:
      'Prepare moving a budget, goal, category, account or recurring payment to Trash. For a category, set deleteTransactions true to also move its transactions to Trash (ask the user which they want). The user must press Confirm. (Transactions: use delete_transaction.)',
    parameters: s.object(
      {
        kind: s.enumOf('What to delete.', [...KINDS]),
        id: s.string('Its id.'),
        deleteTransactions: s.enumOf('Categories only: also trash its transactions.', [
          'true',
          'false',
        ]),
      },
      ['kind', 'id'],
    ),
    progress: { stage: 'working', label: 'Preparing the delete…' },
    run: async (ctx, args) => {
      const kind = oneOf(args, 'kind', KINDS);
      if (!kind) throw new ToolArgError('MISSING_KIND');
      const id = requiredStr(args, 'id', 64);
      const doc = await owned(ctx, kind, id);
      const withTransactions =
        kind === 'category' &&
        (args.deleteTransactions === true || args.deleteTransactions === 'true');
      return propose(ctx, {
        kind: 'entity.delete',
        title: `Move ${kind} “${nameOf(doc)}” to Trash`,
        payload: { kind, id, ...(withTransactions ? { deleteTransactions: true } : {}) },
        lines: [
          { label: 'Kind', value: kind },
          ...(kind === 'category'
            ? [
                {
                  label: 'Its transactions',
                  value: withTransactions ? 'Also moved to Trash' : 'Kept',
                },
              ]
            : []),
          ...(kind === 'account'
            ? [{ label: 'History', value: 'Transactions stay until it’s deleted for good' }]
            : []),
          { label: 'Undo', value: 'Restore from Trash' },
        ],
      });
    },
  },
  {
    name: 'propose_purge',
    description:
      'Prepare deleting a Trash item for good (cannot be undone). Use kind and id from list_trash. The user must press Confirm.',
    parameters: s.object(
      { kind: s.enumOf('Item kind.', [...TRASH_KINDS]), id: s.string('Item id.') },
      ['kind', 'id'],
    ),
    progress: { stage: 'working', label: 'Preparing permanent delete…' },
    run: async (ctx, args) => {
      const kind = oneOf(args, 'kind', TRASH_KINDS);
      if (!kind) throw new ToolArgError('MISSING_KIND');
      const id = requiredStr(args, 'id', 64);
      const doc = await owned(ctx, kind, id);
      const inTrash =
        kind === 'transaction' ? doc.deletedAt !== undefined : doc.archivedAt !== undefined;
      if (!inTrash) throw new ToolArgError('NOT_IN_TRASH');
      return propose(ctx, {
        kind: 'trash.purge',
        title: `Delete “${nameOf(doc)}” for good`,
        payload: { kind, id },
        lines: [
          { label: 'Kind', value: kind },
          ...(kind === 'account' ? [{ label: 'Also deletes', value: 'Its transactions' }] : []),
          ...(kind === 'goal' ? [{ label: 'Also deletes', value: 'Its contributions' }] : []),
          { label: 'Undo', value: 'Not possible' },
        ],
      });
    },
  },
];
