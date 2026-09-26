import type {
  AnalyticsAccount,
  AnalyticsCategory,
  AnalyticsTransaction,
} from '@convex/analytics/domain';
import type { LocalRecord } from '@/local/repository';

export function recordIds(record: LocalRecord): string[] {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

export function recordId(record: LocalRecord): string {
  return recordIds(record)[0] ?? '';
}

export function recordIndex(records: readonly LocalRecord[]): Map<string, LocalRecord> {
  const index = new Map<string, LocalRecord>();
  for (const record of records) for (const id of recordIds(record)) index.set(id, record);
  return index;
}

export function displayAccountName(name: string): string {
  if (!name.includes('%')) return name;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function analyticsEntities(
  records: readonly LocalRecord[],
): (AnalyticsAccount & AnalyticsCategory)[] {
  return records.flatMap((record) => {
    if (typeof record.name !== 'string') return [];
    const [id, ...aliases] = recordIds(record);
    return id ? [{ id, name: record.name, aliases }] : [];
  });
}

export function ledgerTransaction(record: LocalRecord): AnalyticsTransaction | null {
  if (
    !['expense', 'income', 'transfer', 'refund', 'adjustment'].includes(String(record.type)) ||
    !['pending', 'posted', 'voided'].includes(String(record.status)) ||
    typeof record.amountMinor !== 'bigint' ||
    typeof record.currency !== 'string' ||
    typeof record.occurredAt !== 'number'
  )
    return null;
  return {
    type: record.type as AnalyticsTransaction['type'],
    status: record.status as AnalyticsTransaction['status'],
    amountMinor: record.amountMinor,
    currency: record.currency,
    occurredAt: record.occurredAt,
    deletedAt: typeof record.deletedAt === 'number' ? record.deletedAt : undefined,
    categoryId: typeof record.categoryId === 'string' ? record.categoryId : undefined,
    accountId: typeof record.accountId === 'string' ? record.accountId : undefined,
    merchant: typeof record.merchant === 'string' ? record.merchant : undefined,
    title: typeof record.title === 'string' ? record.title : undefined,
  };
}

export function transactionRow(
  record: LocalRecord,
  accounts: Map<string, LocalRecord>,
  categories: Map<string, LocalRecord>,
  timeZone: string,
) {
  const transaction = ledgerTransaction(record);
  if (!transaction) return null;
  const category = categories.get(transaction.categoryId ?? '');
  const accountName = accounts.get(transaction.accountId ?? '')?.name;
  return {
    title: transaction.title || transaction.merchant || 'Transaction',
    merchant: transaction.merchant,
    category: typeof category?.name === 'string' ? category.name : undefined,
    categoryIcon: typeof category?.icon === 'string' ? category.icon : undefined,
    account: typeof accountName === 'string' ? displayAccountName(accountName) : undefined,
    date: new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone }).format(
      transaction.occurredAt,
    ),
    status: transaction.status,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    type: transaction.type,
    semanticType: typeof record.groupId === 'string' ? ('split' as const) : undefined,
  };
}
