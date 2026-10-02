import type { TransactionTableItem } from './web/TransactionsScreen';
import { formatTransactionDate } from './datetime';
import type { TransactionType } from './types';

/** Builds display rows from the real local ledger; aliases resolve both offline and cloud IDs. */
export function transactionViews(records: readonly Record<string, unknown>[], accounts: readonly Record<string, unknown>[], categories: readonly Record<string, unknown>[], timeZone?: string): TransactionTableItem[] {
  const accountIndex = new Map<string, Record<string, unknown>>();
  const categoryIndex = new Map<string, Record<string, unknown>>();
  for (const [entities, index] of [[accounts, accountIndex], [categories, categoryIndex]] as const) {
    for (const entity of entities) for (const key of [entity.id, entity._id, entity.cloudId]) if (typeof key === 'string') index.set(key, entity);
  }
  return records.flatMap(record => {
    const id = String(record.id ?? record._id ?? record.cloudId ?? '');
    if (!id || record.deletedAt !== undefined || record.status === 'voided' || !['expense','income','transfer','refund','adjustment'].includes(String(record.type)) || !Number.isFinite(Number(record.occurredAt))) return [];
    const account = accountIndex.get(String(record.accountId ?? ''));
    const category = categoryIndex.get(String(record.categoryId ?? ''));
    const destination = accountIndex.get(String(record.transferAccountId ?? ''));
    let amountMinor: bigint;
    try { amountMinor = BigInt(String(record.amountMinor ?? 0)); } catch { return []; }
    return [{ id, title: String(record.title || record.merchant || 'Transaction'), note: typeof record.note === 'string' ? record.note : undefined, merchant: typeof record.merchant === 'string' ? record.merchant : undefined, category: String(category?.name ?? (record.type === 'transfer' ? 'Transfer' : record.groupId ? 'Split expense' : 'Uncategorized')), categoryIcon: typeof category?.icon === 'string' ? category.icon : undefined, account: typeof account?.name === 'string' ? account.name : undefined, destination: typeof destination?.name === 'string' ? destination.name : undefined, date: formatTransactionDate(Number(record.occurredAt), record.hasTime === true, timeZone), amountMinor, currency: String(record.currency ?? account?.currency ?? 'INR'), type: record.type as TransactionType }];
  });
}
