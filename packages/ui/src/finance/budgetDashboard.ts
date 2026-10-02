export type BudgetSettings = {
  icon?: string;
  alertThreshold?: number;
  notes?: string;
  includeInAnalytics?: boolean;
  accountIds?: string[];
};
export type BudgetDashboardTransaction = {
  id: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: number;
  title: string;
  merchant?: string;
  accountId?: string;
  accountName?: string;
  categoryName?: string;
};
export function budgetDashboard(
  transactions: readonly BudgetDashboardTransaction[],
  startAt: number,
  endAt: number,
  limit: bigint,
  now = Date.now(),
) {
  const rows = transactions.filter((row) => row.occurredAt >= startAt && row.occurredAt < endAt);
  const spent = rows.reduce((sum, row) => sum + row.amountMinor, 0n);
  const elapsedRows = rows.filter((row) => row.occurredAt <= now);
  const elapsedSpent = elapsedRows.reduce((sum, row) => sum + row.amountMinor, 0n);
  const days = Math.max(1, Math.ceil((endAt - startAt) / 86_400_000));
  const elapsed = Math.max(1, Math.min(days, Math.ceil((now - startAt) / 86_400_000)));
  const average = elapsedSpent / BigInt(elapsed);
  const forecast = average * BigInt(days);
  const buckets = Array.from({ length: Math.min(days, 31) }, (_, index) => ({
    label: String(index + 1),
    amount: 0n,
  }));
  const daily = Array.from({ length: Math.min(days, 366) }, (_, index) => ({
    date: startAt + index * 86_400_000,
    amount: 0n,
  }));
  for (const row of rows) {
    const index = Math.floor((row.occurredAt - startAt) / 86_400_000);
    const bucket =
      buckets[Math.min(buckets.length - 1, Math.floor((index * buckets.length) / days))];
    if (bucket) bucket.amount += row.amountMinor;
    if (daily[index]) daily[index]!.amount += row.amountMinor;
  }
  const group = (key: (row: BudgetDashboardTransaction) => string) => {
    const totals = new Map<string, bigint>();
    for (const row of rows) {
      const name = key(row);
      totals.set(name, (totals.get(name) ?? 0n) + row.amountMinor);
    }
    return [...totals]
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) =>
        left.amount === right.amount
          ? left.name.localeCompare(right.name)
          : left.amount > right.amount
            ? -1
            : 1,
      );
  };
  return {
    rows,
    spent,
    remaining: limit - spent,
    ratio: limit > 0n ? Number((spent * 10_000n) / limit) / 100 : 0,
    days,
    elapsed,
    average,
    forecast,
    buckets,
    daily,
    merchants: group((row) => row.merchant ?? row.title),
    accounts: group((row) => row.accountName ?? 'Unavailable account'),
    categories: group((row) => row.categoryName ?? 'Category'),
    daysLeft: Math.max(0, Math.ceil((endAt - now) / 86_400_000)),
  };
}
