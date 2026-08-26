import type { ActivityRow } from '../activity/domain';

export function searchTransactions(rows: readonly ActivityRow[], query: string): ActivityRow[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...rows];
  return rows.filter(
    (row) =>
      row.merchant?.toLocaleLowerCase().includes(normalized) ||
      row.amountMinor.toString().includes(normalized),
  );
}
