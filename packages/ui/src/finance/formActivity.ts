export type FormActivity = {
  id: string; title: string; merchant?: string; category?: string; categoryIcon?: string;
  account?: string; date: string; amountMinor: bigint; currency: string; type: string;
};
type RecordData = Record<string, unknown>;
export function deriveFormActivity(records: readonly RecordData[], categories: readonly RecordData[], accounts: readonly RecordData[], entity: RecordData | undefined, field: 'accountId' | 'categoryId', ownerId?: string | null): FormActivity[] {
  if (!entity || !ownerId) return [];
  const ids = new Set([entity.id, entity._id, entity.cloudId].filter((id): id is string => typeof id === 'string'));
  const owned = records.filter(record => (record.ownerId === undefined || record.ownerId === ownerId) && ids.has(String(record[field] ?? '')) && record.status === 'posted' && record.deletedAt === undefined && record.groupId === undefined && typeof record.occurredAt === 'number').sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt));
  return owned.map(record => {
    const category = categories.find(item => [item.id, item._id, item.cloudId].includes(record.categoryId));
    const account = accounts.find(item => [item.id, item._id, item.cloudId].includes(record.accountId));
    let amountMinor = 0n;
    try { amountMinor = BigInt(String(record.amountMinor ?? 0)); } catch { /* Malformed imported amounts are omitted below. */ }
    return { id: String(record.id ?? record._id ?? record.cloudId ?? ''), title: String(record.title ?? record.merchant ?? 'Transaction'), merchant: typeof record.merchant === 'string' ? record.merchant : undefined, category: typeof category?.name === 'string' ? category.name : undefined, categoryIcon: typeof category?.icon === 'string' ? category.icon : undefined, account: typeof account?.name === 'string' ? account.name : undefined, date: new Date(Number(record.occurredAt)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), amountMinor, currency: String(record.currency ?? 'INR'), type: String(record.type ?? 'expense') };
  }).filter(row => row.id && row.amountMinor > 0n);
}
