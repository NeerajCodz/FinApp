import type { ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  isSynced,
  localIdOf,
  planExpenseDelete,
  planExpenseUpdate,
  planSettlementRemoval,
  type ExpenseUpdatePlanInput,
  type QueuedWritePlan,
} from '@finapp/ui/finance/expense-outbox';
import {
  commitLocalWrite,
  getMappedCloudId,
  listOutbox,
  readLocal,
  type LocalEntity,
  type LocalRecord,
} from './repository';

export type GroupExpenseUpdateRequest = Omit<ExpenseUpdatePlanInput, 'now'>;
/** `queued`: saved on this device and waiting to sync; otherwise already applied in the cloud. */
export type GroupWriteResult = { queued: boolean };

type Context = {
  convex: ConvexReactClient;
  userId: string;
  /** True only when signed in and connected, so a direct call can be attempted. */
  online: boolean;
  /** Pulls cloud changes after a direct call so local records catch up. */
  refresh: () => void;
};

async function cloudId(
  userId: string,
  entity: LocalEntity,
  record: LocalRecord | undefined,
  fallback?: string,
): Promise<string | null> {
  if (record) {
    if (typeof record.cloudId === 'string') return record.cloudId;
    if (typeof record._id === 'string') return record._id;
    return getMappedCloudId(userId, entity, localIdOf(record));
  }
  if (!fallback) return null;
  return (await getMappedCloudId(userId, entity, fallback)) ?? fallback;
}

async function hasPendingWrites(userId: string, entity: LocalEntity, recordId: string) {
  return (await listOutbox(userId)).some(
    (entry) =>
      entry.entityType === entity && entry.recordId === recordId && entry.status !== 'synced',
  );
}

function enqueue(userId: string, plan: QueuedWritePlan): Promise<string> {
  return commitLocalWrite(userId, plan.entityType, plan.operation, plan.record, plan.payload, {
    recordId: plan.recordId,
    dependencies: plan.dependencies,
    relatedRecords: plan.relatedRecords,
    removedRecords: plan.removedRecords,
  });
}

/**
 * Edits a group expense. Online, the change goes straight to Convex so conflicts such as
 * TRANSACTION_CHANGED surface immediately; offline (or while earlier edits are still queued)
 * it is applied optimistically and queued.
 */
export async function updateGroupExpense(
  context: Context,
  request: GroupExpenseUpdateRequest,
): Promise<GroupWriteResult> {
  const plan = planExpenseUpdate(request);
  const { convex, userId } = context;
  if (context.online && !(await hasPendingWrites(userId, 'transaction', plan.recordId))) {
    const [transactionId, accountId, categoryId] = await Promise.all([
      cloudId(userId, 'transaction', request.transaction),
      cloudId(userId, 'account', request.account, String(plan.payload.accountId)),
      request.category ? cloudId(userId, 'category', request.category) : Promise.resolve(null),
    ]);
    if (transactionId && accountId && (!request.category || categoryId)) {
      await convex.mutation(api.groups.mutations.updateExpense, {
        ...plan.payload,
        transactionId,
        accountId,
        ...(categoryId ? { categoryId } : {}),
        clientMutationId: crypto.randomUUID(),
      } as never);
      context.refresh();
      return { queued: false };
    }
  }
  await enqueue(userId, plan);
  return { queued: true };
}

export async function deleteGroupExpense(
  context: Context,
  transaction: LocalRecord,
): Promise<GroupWriteResult> {
  const plan = planExpenseDelete(transaction, context.userId);
  const { convex, userId } = context;
  if (context.online && !(await hasPendingWrites(userId, 'transaction', plan.recordId))) {
    const transactionId = await cloudId(userId, 'transaction', transaction);
    if (transactionId) {
      await convex.mutation(api.groups.mutations.deleteExpense, {
        ...plan.payload,
        transactionId,
        clientMutationId: crypto.randomUUID(),
      } as never);
      context.refresh();
      return { queued: false };
    }
  }
  await enqueue(userId, plan);
  return { queued: true };
}

/**
 * Undoes a recorded payment. Always applied optimistically and queued, so it works offline;
 * the reopened balance shows immediately. Accepts the settlement record or any of its ids.
 */
export async function removeSettlement(
  context: Context,
  settlement: string | LocalRecord,
): Promise<GroupWriteResult> {
  const record =
    typeof settlement === 'string'
      ? (await readLocal(context.userId, 'settlement')).find((item) =>
          [item.id, item._id, item.cloudId].includes(settlement),
        )
      : settlement;
  if (!record) throw new Error('SETTLEMENT_NOT_FOUND');
  if (record.deletedAt !== undefined) return { queued: false };
  await enqueue(context.userId, planSettlementRemoval(record, context.userId));
  if (context.online && isSynced(record)) context.refresh();
  return { queued: true };
}
