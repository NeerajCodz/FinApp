/**
 * Plans the optimistic local write and queued mutation for editing or deleting a group
 * expense and for undoing a settlement. Both sync providers (SQLite on mobile, IndexedDB on
 * web) apply the same plan, so offline behaviour matches across platforms.
 */
import type { ExpenseParticipantInput, ExpenseShare } from './groupExpenseDraft';

type LocalRecord = Record<string, unknown> & { id?: string; _id?: string };
export type QueuedEntity = 'transaction' | 'settlement' | 'expensePayer' | 'expenseParticipant';
export type QueuedWritePlan = {
  entityType: 'transaction' | 'settlement';
  operation: 'group.updateExpense' | 'group.deleteExpense' | 'settlement.remove';
  recordId: string;
  record: LocalRecord;
  payload: Record<string, unknown>;
  dependencies: string[];
  relatedRecords: { entityType: QueuedEntity; record: LocalRecord }[];
  removedRecords: { entityType: QueuedEntity; record: LocalRecord }[];
};

export function localIdOf(record: LocalRecord): string {
  const id = record.id ?? record._id ?? record.cloudId;
  if (typeof id !== 'string' || !id) throw new Error('LOCAL_RECORD_ID_REQUIRED');
  return id;
}

/** True when the record already exists in the cloud. */
export function isSynced(record: LocalRecord | undefined): boolean {
  return Boolean(record && (typeof record.cloudId === 'string' || typeof record._id === 'string'));
}

/** Version the server holds for an expense (absent means the first version). */
export function expenseVersion(record: LocalRecord): number {
  return typeof record.version === 'number' && Number.isSafeInteger(record.version)
    ? record.version
    : 1;
}

function dependency(entity: string, record: LocalRecord | undefined, id: string | undefined) {
  return id && !isSynced(record) ? [`${entity}:${id}`] : [];
}

function memberOf(row: LocalRecord): string {
  return String(row.userId ?? row.memberId ?? '');
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export type ExpenseUpdatePlanInput = {
  transaction: LocalRecord;
  /** Split rows currently stored for this expense. */
  payerRows: readonly LocalRecord[];
  participantRows: readonly LocalRecord[];
  /** The account (local record) to book against; omit to keep the expense's account. */
  account?: LocalRecord;
  category?: LocalRecord;
  /** Keep an existing category by id (e.g. an admin editing someone else's expense). */
  categoryId?: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: number;
  merchant?: string;
  note?: string;
  participants: readonly ExpenseParticipantInput[];
  payers: readonly ExpenseShare[];
  now?: number;
};

/** Optimistic update of an expense plus the queued `group.updateExpense` call. */
export function planExpenseUpdate(input: ExpenseUpdatePlanInput): QueuedWritePlan {
  const transactionId = localIdOf(input.transaction);
  const expectedVersion = expenseVersion(input.transaction);
  const accountId = input.account ? localIdOf(input.account) : String(input.transaction.accountId);
  const categoryId = input.category ? localIdOf(input.category) : input.categoryId || undefined;
  const now = input.now ?? Date.now();
  const title = input.title.trim();
  const merchant = input.merchant?.trim() || undefined;
  const note = input.note?.trim() || undefined;
  const rowsFor = (
    entityType: 'expensePayer' | 'expenseParticipant',
    existing: readonly LocalRecord[],
    next: readonly (ExpenseShare & { method?: string; basisValue?: string })[],
  ) => {
    const nextIds = new Set(next.map((row) => row.userId));
    return {
      related: next.map((row) => {
        const current = existing.find((item) => memberOf(item) === row.userId);
        const base: LocalRecord = current
          ? { ...current }
          : { transactionId, userId: row.userId, memberId: row.userId };
        const record: LocalRecord = { ...base, amountMinor: row.amountMinor };
        if (entityType === 'expenseParticipant') {
          record.method = row.method;
          if (row.basisValue === undefined) delete record.basisValue;
          else record.basisValue = row.basisValue;
        }
        return { entityType, record };
      }),
      removed: existing
        .filter((item) => !nextIds.has(memberOf(item)))
        .map((record) => ({ entityType, record })),
    };
  };
  const payerRows = rowsFor('expensePayer', input.payerRows, input.payers);
  const participantRows = rowsFor('expenseParticipant', input.participantRows, input.participants);
  const record: LocalRecord = withoutUndefined({
    ...input.transaction,
    title,
    amountMinor: input.amountMinor,
    currency: input.currency,
    occurredAt: input.occurredAt,
    accountId,
    categoryId,
    merchant,
    note,
    version: expectedVersion + 1,
    updatedAt: now,
  });
  if (!categoryId) delete record.categoryId;
  if (!merchant) delete record.merchant;
  if (!note) delete record.note;
  return {
    entityType: 'transaction',
    operation: 'group.updateExpense',
    recordId: transactionId,
    record,
    payload: withoutUndefined({
      transactionId,
      accountId,
      title,
      amountMinor: input.amountMinor,
      currency: input.currency,
      occurredAt: input.occurredAt,
      categoryId,
      merchant,
      note,
      participants: input.participants.map((row) => withoutUndefined({ ...row })),
      payers: input.payers.map((row) => ({ userId: row.userId, amountMinor: row.amountMinor })),
      expectedVersion,
    }),
    dependencies: [
      ...dependency('transaction', input.transaction, transactionId),
      ...(input.account ? dependency('account', input.account, accountId) : []),
      ...(input.category ? dependency('category', input.category, categoryId) : []),
    ],
    relatedRecords: [...payerRows.related, ...participantRows.related],
    removedRecords: [...payerRows.removed, ...participantRows.removed],
  };
}

/** Optimistic soft delete of an expense plus the queued `group.deleteExpense` call. */
export function planExpenseDelete(
  transaction: LocalRecord,
  actorId: string,
  now = Date.now(),
): QueuedWritePlan {
  const transactionId = localIdOf(transaction);
  const expectedVersion = expenseVersion(transaction);
  return {
    entityType: 'transaction',
    operation: 'group.deleteExpense',
    recordId: transactionId,
    record: {
      ...transaction,
      deletedAt: now,
      deletedBy: actorId,
      version: expectedVersion + 1,
      updatedAt: now,
    },
    payload: { transactionId, expectedVersion },
    dependencies: dependency('transaction', transaction, transactionId),
    relatedRecords: [],
    removedRecords: [],
  };
}

/** Optimistic undo of a recorded payment plus the queued `settlements.remove` call. */
export function planSettlementRemoval(
  settlement: LocalRecord,
  actorId: string,
  now = Date.now(),
): QueuedWritePlan {
  const settlementId = localIdOf(settlement);
  return {
    entityType: 'settlement',
    operation: 'settlement.remove',
    recordId: settlementId,
    record: { ...settlement, deletedAt: now, deletedBy: actorId, updatedAt: now },
    payload: { settlementId },
    dependencies: dependency('settlement', settlement, settlementId),
    relatedRecords: [],
    removedRecords: [],
  };
}
