export type ActivityKind = 'expense' | 'income' | 'transfer' | 'settlement' | 'group';
export type ActivityRow = {
  id: string;
  ownerId: string;
  kind: ActivityKind;
  occurredAt: number;
  merchant?: string;
  amountMinor: bigint;
};
export type ActivityFilter =
  'All' | 'Personal' | 'Groups' | 'Income' | 'Expenses' | 'Transfers' | 'Settlements';

export function filterActivity(
  rows: readonly ActivityRow[],
  filter: ActivityFilter,
): ActivityRow[] {
  const kinds: Partial<Record<ActivityFilter, ActivityKind>> = {
    Income: 'income',
    Expenses: 'expense',
    Transfers: 'transfer',
    Settlements: 'settlement',
    Groups: 'group',
  };
  const kind = kinds[filter];
  if (filter === 'Personal')
    return rows.filter((row) => row.kind !== 'group' && row.kind !== 'settlement');
  return kind ? rows.filter((row) => row.kind === kind) : [...rows];
}

export function paginateActivity(
  rows: readonly ActivityRow[],
  cursor: number,
  limit: number,
): { page: ActivityRow[]; nextCursor?: number } {
  if (limit <= 0 || limit > 100) throw new Error('INVALID_PAGE_SIZE');
  const page = rows.slice(cursor, cursor + limit);
  const nextCursor = cursor + page.length < rows.length ? cursor + page.length : undefined;
  return nextCursor === undefined ? { page } : { page, nextCursor };
}
