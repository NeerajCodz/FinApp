/**
 * Writes FinAI proposes. A tool stores a pending action and shows a confirmation card; nothing
 * changes until the requesting user presses Confirm. `confirm` runs in that user's own action,
 * so the write goes through the same public mutation the app uses, with their auth, limits and
 * validation. Each action runs at most once (pending → running → done | failed).
 */
import { v } from 'convex/values';
import { api, internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import {
  action,
  internalMutation,
  mutation,
  type ActionCtx,
  type QueryCtx,
} from '../_generated/server';
import { requireUser } from '../shared/auth';
import { allocateParticipants } from '../splits/domain';
import { toolErrorCode } from './agent';
import { executeManageAction, isManageKind } from './manageActions';
import { executeImport } from './importTools';
import { finaiAgent } from './config';
import { finaiActionKind, finaiActionStatus, finaiScopeType } from './validators';

export const propose = internalMutation({
  args: {
    userId: v.id('users'),
    scopeType: finaiScopeType,
    scopeId: v.string(),
    messageId: v.string(),
    kind: finaiActionKind,
    payload: v.string(),
    title: v.string(),
    ttlMs: v.number(),
  },
  handler: async (ctx, { ttlMs, ...args }): Promise<Id<'finaiActions'>> => {
    const now = Date.now();
    const existing = await ctx.db
      .query('finaiActions')
      .withIndex('by_message', (q) => q.eq('messageId', args.messageId))
      .collect();
    if (existing.length >= finaiAgent.maxProposals) throw new Error('TOO_MANY_PROPOSALS');
    const actionId = await ctx.db.insert('finaiActions', {
      ...args,
      status: 'pending',
      createdAt: now,
      expiresAt: now + ttlMs,
    });
    // Flip the row at its deadline so subscribed cards stop offering Confirm on their own.
    await ctx.scheduler.runAt(now + ttlMs, internal.ai.actions.expire, { actionId });
    return actionId;
  },
});

/** Marks a still-pending action expired once its deadline has passed. */
export const expire = internalMutation({
  args: { actionId: v.id('finaiActions') },
  handler: async (ctx, { actionId }) => {
    const row = await ctx.db.get(actionId);
    if (!row || row.status !== 'pending' || row.expiresAt > Date.now()) return;
    await ctx.db.patch(actionId, { status: 'expired', decidedAt: Date.now() });
  },
});

/**
 * A confirmation interrupted after `claim` (worker restart, timeout) stays `running`. After
 * this long it may be confirmed again; the action id is the idempotency key, so a retry can't
 * apply twice.
 */
const isStaleRunning = (row: Doc<'finaiActions'>, now: number) =>
  row.status === 'running' && (row.decidedAt ?? row.createdAt) + finaiAgent.staleRunningMs <= now;

export type FinaiActionView = {
  id: Id<'finaiActions'>;
  title: string;
  status: Doc<'finaiActions'>['status'];
  errorCode?: string;
  /** Whether the viewer may confirm or cancel (only the requester, only while pending). */
  canDecide: boolean;
  /**
   * False for an interrupted confirmation: its write may already exist, so it can only be
   * retried (idempotently), never cancelled.
   */
  canCancel: boolean;
};

/** Action states for reply messages, keyed by message id, as the viewer sees them. */
export async function actionViews(
  ctx: QueryCtx,
  messageIds: readonly string[],
  viewerId: Id<'users'>,
): Promise<Map<string, FinaiActionView[]>> {
  const now = Date.now();
  const entries = await Promise.all(
    messageIds.map(async (messageId) => {
      const rows = await ctx.db
        .query('finaiActions')
        .withIndex('by_message', (q) => q.eq('messageId', messageId))
        .collect();
      return [
        messageId,
        rows.map((row): FinaiActionView => {
          const status = isStaleRunning(row, now)
            ? 'pending'
            : row.status === 'pending' && row.expiresAt <= now
              ? 'expired'
              : row.status;
          const canDecide = status === 'pending' && row.userId === viewerId;
          return {
            id: row._id,
            title: row.title,
            status,
            ...(row.errorCode ? { errorCode: row.errorCode } : {}),
            canDecide,
            canCancel: canDecide && row.status === 'pending',
          };
        }),
      ] as const;
    }),
  );
  return new Map(entries.filter(([, rows]) => rows.length > 0));
}

export const cancel = mutation({
  args: { actionId: v.id('finaiActions') },
  handler: async (ctx, { actionId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const row = await ctx.db.get(actionId);
    if (!row || row.userId !== user._id) throw new Error('ACTION_NOT_FOUND');
    // An interrupted confirmation may already have written: it can be retried, not cancelled.
    if (row.status !== 'pending') return row.status;
    await ctx.db.patch(actionId, { status: 'cancelled', decidedAt: Date.now() });
    return 'cancelled' as const;
  },
});

/** Moves a pending, unexpired action of the caller to `running` and returns it. */
export const claim = internalMutation({
  args: { actionId: v.id('finaiActions') },
  handler: async (ctx, { actionId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const row = await ctx.db.get(actionId);
    if (!row || row.userId !== user._id) throw new Error('ACTION_NOT_FOUND');
    const now = Date.now();
    // An interrupted confirmation was already accepted before its deadline: let it retry.
    if (isStaleRunning(row, now)) {
      await ctx.db.patch(actionId, { decidedAt: now });
      return { kind: row.kind, payload: row.payload, userId: row.userId };
    }
    if (row.status !== 'pending') throw new Error('ACTION_ALREADY_DECIDED');
    if (row.expiresAt <= now) {
      await ctx.db.patch(actionId, { status: 'expired', decidedAt: now });
      throw new Error('ACTION_EXPIRED');
    }
    await ctx.db.patch(actionId, { status: 'running', decidedAt: now });
    return { kind: row.kind, payload: row.payload, userId: row.userId };
  },
});

export const finish = internalMutation({
  args: {
    actionId: v.id('finaiActions'),
    status: finaiActionStatus,
    resultId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, { actionId, ...patch }) => {
    // The conversation may have been deleted while the write ran.
    if (await ctx.db.get(actionId)) await ctx.db.patch(actionId, patch);
  },
});

type Payload = Record<string, unknown>;
const text = (payload: Payload, key: string) =>
  typeof payload[key] === 'string' ? (payload[key] as string) : undefined;
const minor = (payload: Payload, key: string) => {
  const value = text(payload, key);
  if (!value || !/^\d{1,19}$/.test(value)) throw new Error('INVALID_ACTION_PAYLOAD');
  return BigInt(value);
};

/** The caller's account for a currency: their default account if it matches, else the first. */
async function accountFor(ctx: ActionCtx, currency: string, preferred?: string) {
  const [accounts, me] = await Promise.all([
    ctx.runQuery(api.accounts.queries.list, {}),
    ctx.runQuery(api.users.queries.current, {}),
  ]);
  const inCurrency = accounts.filter((account) => account.currency === currency);
  const chosen =
    (preferred && inCurrency.find((account) => String(account.id) === preferred)) ||
    inCurrency.find((account) => String(account.id) === String(me?.defaultAccountId)) ||
    inCurrency[0];
  if (!chosen) throw new Error('NO_ACCOUNT_IN_CURRENCY');
  return chosen.id as Id<'accounts'>;
}

/** Runs one confirmed action through the app's own public mutations, as the caller. */
export async function executeAction(
  ctx: ActionCtx,
  kind: Doc<'finaiActions'>['kind'],
  payload: Payload,
  clientMutationId: string,
  userId?: Id<'users'>,
): Promise<string | undefined> {
  if (kind === 'transaction.import') return executeImport(ctx, payload, clientMutationId);
  if (isManageKind(kind)) {
    if (!userId) throw new Error('AUTH_REQUIRED');
    return executeManageAction(ctx, userId, kind, payload, clientMutationId);
  }
  switch (kind) {
    case 'transaction.create': {
      const currency = text(payload, 'currency')!;
      const type = text(payload, 'type') === 'income' ? 'income' : 'expense';
      const id = await ctx.runMutation(api.transactions.mutations.create, {
        accountId: await accountFor(ctx, currency, text(payload, 'accountId')),
        type,
        amountMinor: minor(payload, 'amountMinor'),
        currency,
        title: text(payload, 'title')!,
        categoryId: text(payload, 'categoryId') as Id<'categories'> | undefined,
        merchant: text(payload, 'merchant'),
        note: text(payload, 'note'),
        occurredAt: Number(payload.occurredAt) || Date.now(),
        clientMutationId,
      });
      return String(id);
    }
    case 'group.expense.create': {
      const currency = text(payload, 'currency')!;
      const total = minor(payload, 'amountMinor');
      const participantIds = Array.isArray(payload.participantIds)
        ? (payload.participantIds as string[])
        : [];
      const shares = allocateParticipants(total, participantIds, 'equal');
      const id = await ctx.runMutation(api.groups.mutations.addExpense, {
        groupId: text(payload, 'groupId') as Id<'groups'>,
        accountId: await accountFor(ctx, currency),
        title: text(payload, 'title')!,
        amountMinor: total,
        currency,
        occurredAt: Number(payload.occurredAt) || Date.now(),
        note: text(payload, 'note'),
        participants: shares.map((share) => ({
          userId: share.userId as Id<'users'>,
          amountMinor: share.amountMinor,
          method: 'equal' as const,
        })),
        clientMutationId,
      });
      return id ? String(id) : undefined;
    }
    case 'settlement.create': {
      const currency = text(payload, 'currency')!;
      const id = await ctx.runMutation(api.settlements.mutations.create, {
        groupId: text(payload, 'groupId') as Id<'groups'>,
        fromUserId: text(payload, 'fromUserId') as Id<'users'>,
        toUserId: text(payload, 'toUserId') as Id<'users'>,
        accountId: await accountFor(ctx, currency),
        amountMinor: minor(payload, 'amountMinor'),
        currency,
        occurredAt: Date.now(),
        note: text(payload, 'note'),
        clientMutationId,
      });
      return id ? String(id) : undefined;
    }
    case 'goal.contribute': {
      await ctx.runMutation(api.goals.mutations.contribute, {
        goalId: text(payload, 'goalId') as Id<'goals'>,
        amountMinor: minor(payload, 'amountMinor'),
        clientMutationId,
      });
      return undefined;
    }
    case 'group.nudge': {
      await ctx.runMutation(api.notifications.mutations.nudge, {
        groupId: text(payload, 'groupId') as Id<'groups'>,
        userId: text(payload, 'userId') as Id<'users'>,
      });
      return undefined;
    }
  }
}

export const confirm = action({
  args: { actionId: v.id('finaiActions') },
  handler: async (
    ctx,
    { actionId },
  ): Promise<{ status: 'done' | 'failed'; errorCode?: string; resultId?: string }> => {
    const claimed = await ctx.runMutation(internal.ai.actions.claim, { actionId });
    try {
      const payload = JSON.parse(claimed.payload) as Payload;
      // The action id doubles as the idempotency key, so a retried confirm cannot apply twice.
      const resultId = await executeAction(
        ctx,
        claimed.kind,
        payload,
        `finai:${actionId}`,
        claimed.userId,
      );
      await ctx.runMutation(internal.ai.actions.finish, { actionId, status: 'done', resultId });
      return { status: 'done', ...(resultId ? { resultId } : {}) };
    } catch (error) {
      const errorCode = toolErrorCode(error);
      console.warn('[ai] FinAI action failed', claimed.kind, errorCode);
      await ctx.runMutation(internal.ai.actions.finish, {
        actionId,
        status: claimed.kind === 'transaction.import' ? 'running' : 'failed',
        errorCode,
      });
      return { status: 'failed', errorCode };
    }
  },
});
