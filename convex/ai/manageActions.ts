/**
 * Executes FinAI's confirmed management actions (create / edit / move to Trash / delete for
 * good) through the app's own public mutations, as the user. Edits merge the stored record
 * with the fields FinAI changed, so nothing the user didn't mention is touched.
 */
import { api, internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';

type Payload = Record<string, unknown>;
type Rec = Record<string, unknown>;

const text = (payload: Payload, key: string) =>
  typeof payload[key] === 'string' ? (payload[key] as string) : undefined;
const big = (payload: Payload, key: string): bigint | undefined => {
  const value = payload[key];
  if (typeof value === 'string' && /^-?\d{1,19}$/.test(value)) return BigInt(value);
  return undefined;
};
const num = (payload: Payload, key: string) =>
  typeof payload[key] === 'number' && Number.isFinite(payload[key])
    ? (payload[key] as number)
    : undefined;
const asBig = (value: unknown): bigint =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'string' && /^-?\d+$/.test(value)
      ? BigInt(value)
      : 0n;

async function record(ctx: ActionCtx, userId: Id<'users'>, kind: string, id: string): Promise<Rec> {
  const doc = await ctx.runQuery(internal.ai.records.owned, {
    userId,
    kind: kind as 'transaction',
    id,
  });
  if (!doc) throw new Error('NOT_FOUND');
  return doc as Rec;
}

export const MANAGE_KINDS = [
  'transaction.update',
  'goal.create',
  'goal.update',
  'category.create',
  'category.update',
  'category.limit',
  'account.create',
  'account.update',
  'recurring.create',
  'entity.delete',
  'trash.purge',
] as const;
export type ManageKind = (typeof MANAGE_KINDS)[number];

export function isManageKind(kind: string): kind is ManageKind {
  return (MANAGE_KINDS as readonly string[]).includes(kind);
}

export async function executeManageAction(
  ctx: ActionCtx,
  userId: Id<'users'>,
  kind: ManageKind,
  payload: Payload,
  clientMutationId: string,
): Promise<string | undefined> {
  switch (kind) {
    case 'transaction.update': {
      const id = text(payload, 'transactionId')!;
      const current = await record(ctx, userId, 'transaction', id);
      if (current.deletedAt !== undefined) throw new Error('IN_TRASH');
      const type = String(current.type);
      if (type !== 'expense' && type !== 'income' && type !== 'transfer')
        throw new Error('UNSUPPORTED_TYPE');
      const nextType = (text(payload, 'type') as 'expense' | 'income' | undefined) ?? type;
      const transferAccountId =
        payload.transferAccountId === null
          ? undefined
          : (current.transferAccountId as Id<'accounts'> | undefined);
      const categoryId =
        nextType !== type && nextType !== 'transfer'
          ? (text(payload, 'categoryId') as Id<'categories'> | undefined)
          : ((text(payload, 'categoryId') ?? (current.categoryId as string | undefined)) as
              | Id<'categories'>
              | undefined);
      if (nextType !== type && nextType !== 'transfer' && !categoryId)
        throw new Error('CATEGORY_REQUIRED_FOR_TYPE_CHANGE');
      await ctx.runMutation(api.transactions.mutations.update, {
        transactionId: id as Id<'transactions'>,
        accountId: (text(payload, 'accountId') ?? current.accountId) as Id<'accounts'>,
        type: nextType,
        amountMinor: big(payload, 'amountMinor') ?? asBig(current.amountMinor),
        currency: String(current.currency),
        categoryId,
        title: text(payload, 'title') ?? String(current.title),
        merchant: text(payload, 'merchant') ?? (current.merchant as string | undefined),
        note: text(payload, 'note') ?? (current.note as string | undefined),
        transferAccountId,
        occurredAt: num(payload, 'occurredAt') ?? Number(current.occurredAt),
        hasTime: current.hasTime as boolean | undefined,
        clientMutationId,
      });
      return id;
    }
    case 'goal.create': {
      const id = await ctx.runMutation(api.goals.mutations.create, {
        name: text(payload, 'name')!,
        targetAmountMinor: big(payload, 'targetAmountMinor')!,
        currency: text(payload, 'currency')!,
        targetDate: num(payload, 'targetDate'),
        monthlyContributionMinor: big(payload, 'monthlyContributionMinor'),
        notes: text(payload, 'notes'),
        clientMutationId,
      });
      return String(id);
    }
    case 'goal.update': {
      const id = text(payload, 'goalId')!;
      const current = await record(ctx, userId, 'goal', id);
      await ctx.runMutation(api.goals.mutations.update, {
        goalId: id as Id<'goals'>,
        name: text(payload, 'name') ?? String(current.name),
        targetAmountMinor: big(payload, 'targetAmountMinor') ?? asBig(current.targetAmountMinor),
        ...(num(payload, 'targetDate') !== undefined
          ? { targetDate: num(payload, 'targetDate') }
          : {}),
        ...(big(payload, 'monthlyContributionMinor') !== undefined
          ? { monthlyContributionMinor: big(payload, 'monthlyContributionMinor') }
          : {}),
        ...(text(payload, 'notes') !== undefined ? { notes: text(payload, 'notes') } : {}),
        clientMutationId,
      });
      return id;
    }
    case 'category.create': {
      const id = await ctx.runMutation(api.categories.mutations.create, {
        name: text(payload, 'name')!,
        kind: text(payload, 'kind') === 'income' ? 'income' : 'expense',
        icon: text(payload, 'icon'),
        monthlyLimitMinor: big(payload, 'monthlyLimitMinor'),
        limitCurrency: text(payload, 'limitCurrency'),
        clientMutationId,
      });
      return String(id);
    }
    case 'category.update': {
      const id = text(payload, 'categoryId')!;
      await record(ctx, userId, 'category', id);
      const categoryId = id as Id<'categories'>;
      if (text(payload, 'name'))
        await ctx.runMutation(api.categories.mutations.rename, {
          categoryId,
          name: text(payload, 'name')!,
          clientMutationId: `${clientMutationId}:name`,
        });
      if (text(payload, 'icon'))
        await ctx.runMutation(api.categories.mutations.setIcon, {
          categoryId,
          icon: text(payload, 'icon')!,
          clientMutationId: `${clientMutationId}:icon`,
        });
      if (payload.monthlyLimitMinor !== undefined)
        await ctx.runMutation(api.categories.mutations.setLimit, {
          categoryId,
          amountMinor:
            payload.monthlyLimitMinor === null ? null : (big(payload, 'monthlyLimitMinor') ?? null),
          ...(text(payload, 'limitCurrency') ? { currency: text(payload, 'limitCurrency') } : {}),
          clientMutationId: `${clientMutationId}:limit`,
        });
      return id;
    }
    case 'category.limit': {
      const id = text(payload, 'categoryId')!;
      await record(ctx, userId, 'category', id);
      const limit = payload.monthlyLimitMinor === null ? null : big(payload, 'monthlyLimitMinor');
      if (limit === undefined) throw new Error('MISSING_AMOUNT');
      await ctx.runMutation(api.categories.mutations.setLimit, {
        categoryId: id as Id<'categories'>,
        amountMinor: limit,
        ...(limit !== null && text(payload, 'limitCurrency')
          ? { currency: text(payload, 'limitCurrency') }
          : {}),
        ...(limit !== null && num(payload, 'alertPercent') !== undefined
          ? { alertPercent: num(payload, 'alertPercent') }
          : {}),
        clientMutationId,
      });
      return id;
    }
    case 'account.create': {
      const type = text(payload, 'type') as Doc<'accounts'>['type'] | undefined;
      const id = await ctx.runMutation(api.accounts.mutations.create, {
        name: text(payload, 'name')!,
        type: type ?? 'bank',
        customType: text(payload, 'customType'),
        currency: text(payload, 'currency')!,
        openingBalanceMinor: big(payload, 'openingBalanceMinor') ?? 0n,
        isIncludedInTotal: true,
        clientMutationId,
      });
      return String(id);
    }
    case 'account.update': {
      const id = text(payload, 'accountId')!;
      const current = await record(ctx, userId, 'account', id);
      await ctx.runMutation(api.accounts.mutations.updateDetails, {
        accountId: id as Id<'accounts'>,
        name: text(payload, 'name') ?? String(current.name),
        type: (text(payload, 'type') ?? current.type) as Doc<'accounts'>['type'],
        customType:
          text(payload, 'customType') ??
          ((text(payload, 'type') ?? current.type) === 'other'
            ? (current.customType as string | undefined)
            : undefined),
        currency: String(current.currency),
        openingBalanceMinor:
          big(payload, 'openingBalanceMinor') ?? asBig(current.openingBalanceMinor),
        isIncludedInTotal: Boolean(current.isIncludedInTotal),
        clientMutationId,
      });
      return id;
    }
    case 'recurring.create': {
      const id = await ctx.runMutation(api.recurring.mutations.create, {
        name: text(payload, 'name')!,
        amountMinor: big(payload, 'amountMinor')!,
        currency: text(payload, 'currency')!,
        accountId: text(payload, 'accountId') as Id<'accounts'>,
        frequency: text(payload, 'frequency') as 'daily' | 'weekly' | 'monthly' | 'yearly',
        nextOccurrence: num(payload, 'nextOccurrence')!,
        clientMutationId,
      });
      return String(id);
    }
    case 'entity.delete': {
      const target = text(payload, 'kind');
      const id = text(payload, 'id')!;
      const targetDoc = await record(ctx, userId, target ?? '', id);
      if (target === 'category' && targetDoc.isSystem === true) throw new Error('SYSTEM_CATEGORY');
      if (target === 'goal')
        await ctx.runMutation(api.goals.mutations.archive, {
          goalId: id as Id<'goals'>,
          clientMutationId,
        });
      else if (target === 'category')
        await ctx.runMutation(api.categories.mutations.archive, {
          categoryId: id as Id<'categories'>,
          clientMutationId,
          ...(payload.deleteTransactions === true ? { deleteTransactions: true } : {}),
        });
      else if (target === 'account')
        await ctx.runMutation(api.accounts.mutations.archive, {
          accountId: id as Id<'accounts'>,
          clientMutationId,
        });
      else if (target === 'recurring')
        await ctx.runMutation(api.recurring.mutations.remove, {
          ruleId: id as Id<'recurringRules'>,
          clientMutationId,
        });
      else throw new Error('UNSUPPORTED_KIND');
      return id;
    }
    case 'trash.purge': {
      const kind = text(payload, 'kind')!;
      const id = text(payload, 'id')!;
      if (kind === 'category') {
        const category = await record(ctx, userId, kind, id);
        if (category.isSystem === true) throw new Error('SYSTEM_CATEGORY');
      }
      await ctx.runMutation(api.trash.purge, {
        kind: kind as 'transaction',
        id,
      });
      return text(payload, 'id');
    }
  }
}
