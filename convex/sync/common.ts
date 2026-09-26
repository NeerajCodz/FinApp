import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

export type SyncEntity =
  | 'users'
  | 'userSettings'
  | 'accounts'
  | 'accountMembers'
  | 'categories'
  | 'transactions'
  | 'transactionTags'
  | 'groups'
  | 'groupMembers'
  | 'groupInvites'
  | 'expensePayers'
  | 'expenseParticipants'
  | 'settlements'
  | 'budgets'
  | 'goals'
  | 'goalContributions'
  | 'recurringRules'
  | 'notifications'
  | 'receipts';

export type MutationReceipt = {
  operation: string;
  resultEntityId?: string;
  resultPayload?: unknown;
  revision?: bigint;
  serverUpdatedAt?: number;
};

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      /(?:identity|password|token|secret|verification|session)/i.test(key)
        ? []
        : [[key, sanitize(item)]],
    ),
  );
}

export async function recordSyncChange(
  ctx: MutationCtx,
  scopeUserId: Id<'users'>,
  entityType: SyncEntity,
  documentId: string,
  updatedAt: number,
  document?: unknown,
  deletedAt?: number,
  clientMutationId?: string,
): Promise<bigint> {
  const state = await ctx.db
    .query('userSyncState')
    .withIndex('by_user', (query) => query.eq('userId', scopeUserId))
    .unique();
  const revision = (state?.revision ?? 0n) + 1n;
  if (state) await ctx.db.patch(state._id, { revision, updatedAt });
  else await ctx.db.insert('userSyncState', { userId: scopeUserId, revision, updatedAt });
  await ctx.db.insert('syncChanges', {
    scopeUserId,
    revision,
    entityType,
    documentId,
    updatedAt,
    deletedAt,
    document: document === undefined ? undefined : sanitize(document),
    clientMutationId,
  });
  return revision;
}

export async function getMutationReceipt(
  ctx: MutationCtx,
  actorId: Id<'users'>,
  clientMutationId: string,
  operation: string,
): Promise<MutationReceipt | null> {
  const receipt = await ctx.db
    .query('processedMutations')
    .withIndex('by_actor_clientMutationId', (query) =>
      query.eq('actorId', actorId).eq('clientMutationId', clientMutationId),
    )
    .unique();
  if (!receipt) return null;
  return {
    operation: receipt.operation,
    resultEntityId: receipt.resultEntityId,
    resultPayload: receipt.resultPayload,
    revision: receipt.revision,
    serverUpdatedAt: receipt.serverUpdatedAt,
  };
}

export async function storeMutationReceipt(
  ctx: MutationCtx,
  actorId: Id<'users'>,
  clientMutationId: string,
  operation: string,
  result: unknown,
  resultEntityId?: string,
  revision?: bigint,
  serverUpdatedAt?: number,
): Promise<void> {
  await ctx.db.insert('processedMutations', {
    actorId,
    clientMutationId,
    operation,
    resultEntityId,
    resultPayload: result,
    serverUpdatedAt,
    revision,
    createdAt: Date.now(),
  });
}

export async function replayMutationResult(
  ctx: MutationCtx,
  actorId: Id<'users'>,
  clientMutationId: string | undefined,
  operation: string,
): Promise<{ found: boolean; result?: unknown }> {
  if (!clientMutationId) return { found: false };
  const receipt = await getMutationReceipt(ctx, actorId, clientMutationId, operation);
  return receipt ? { found: true, result: receipt.resultPayload } : { found: false };
}

export async function publishMutationResult(
  ctx: MutationCtx,
  actorId: Id<'users'>,
  clientMutationId: string | undefined,
  operation: string,
  result: unknown,
  entityType: SyncEntity,
  documentId: string,
  updatedAt: number,
  document: unknown,
  additionalScopes: readonly Id<'users'>[] = [],
): Promise<bigint> {
  const scopes = [...new Set([actorId, ...additionalScopes])];
  let actorRevision = 0n;
  for (const scopeUserId of scopes) {
    const revision = await recordSyncChange(
      ctx,
      scopeUserId,
      entityType,
      documentId,
      updatedAt,
      document,
      undefined,
      clientMutationId,
    );
    if (scopeUserId === actorId) actorRevision = revision;
  }
  if (clientMutationId) {
    await storeMutationReceipt(
      ctx,
      actorId,
      clientMutationId,
      operation,
      result,
      documentId,
      actorRevision,
      updatedAt,
    );
  }
  return actorRevision;
}
