export type AnalyticsPeriod = 'week' | 'month' | 'year';

export type AnalyticsTransaction = {
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
  amountMinor: bigint;
  currency: string;
  categoryId?: string;
  occurredAt: number;
  status: 'pending' | 'posted' | 'voided';
  deletedAt?: number;
};

export type AnalyticsBucket = { startAt: number; endAt: number; amountMinor: bigint };

export function validateAnalyticsRange(period: AnalyticsPeriod, startAt: number, endAt: number) {
  const duration = endAt - startAt;
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt)
    throw new Error('INVALID_DATE_RANGE');
  const limits: Record<AnalyticsPeriod, readonly [number, number]> = {
    week: [6 * 86400000, 8 * 86400000],
    month: [27 * 86400000, 32 * 86400000],
    year: [360 * 86400000, 367 * 86400000],
  };
  const [minimum, maximum] = limits[period];
  if (duration < minimum || duration > maximum) throw new Error('INVALID_DATE_RANGE');
}

export function aggregateAnalytics(
  transactions: readonly AnalyticsTransaction[],
  categories: readonly { id: string; name: string }[],
  currency: string,
  period: AnalyticsPeriod,
  startAt: number,
  endAt: number,
  timeZone = 'UTC',
) {
  const bucketCount = period === 'week' ? 7 : period === 'month' ? 5 : 12;
  const buckets: AnalyticsBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
    startAt:
      period === 'year'
        ? Date.UTC(new Date(startAt).getUTCFullYear(), new Date(startAt).getUTCMonth() + index, 1)
        : startAt + ((endAt - startAt) * index) / bucketCount,
    endAt:
      period === 'year'
        ? Date.UTC(
            new Date(startAt).getUTCFullYear(),
            new Date(startAt).getUTCMonth() + index + 1,
            1,
          )
        : startAt + ((endAt - startAt) * (index + 1)) / bucketCount,
    amountMinor: 0n,
  }));
  let spentMinor = 0n;
  let incomeMinor = 0n;
  const categoryTotals = new Map<string, bigint>();
  let monthFormatter: Intl.DateTimeFormat | undefined;
  let startMonthIndex = 0;
  if (period === 'year') {
    try {
      monthFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
      });
    } catch {
      monthFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'numeric',
      });
    }
    const startParts = monthFormatter.formatToParts(new Date(startAt));
    const startYear = Number(startParts.find((part) => part.type === 'year')?.value);
    const startMonth = Number(startParts.find((part) => part.type === 'month')?.value);
    startMonthIndex = startYear * 12 + startMonth - 1;
  }
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  for (const transaction of transactions) {
    if (
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      transaction.currency !== currency ||
      transaction.occurredAt < startAt ||
      transaction.occurredAt >= endAt
    )
      continue;
    if (transaction.type === 'income') {
      incomeMinor += transaction.amountMinor;
      continue;
    }
    if (transaction.type !== 'expense') continue;
    spentMinor += transaction.amountMinor;
    let bucketIndex: number;
    if (period === 'year') {
      const parts = monthFormatter!.formatToParts(new Date(transaction.occurredAt));
      const year = Number(parts.find((part) => part.type === 'year')?.value);
      const month = Number(parts.find((part) => part.type === 'month')?.value);
      bucketIndex = Math.max(0, Math.min(bucketCount - 1, year * 12 + month - 1 - startMonthIndex));
    } else {
      bucketIndex = Math.max(
        0,
        Math.min(
          bucketCount - 1,
          Math.floor(((transaction.occurredAt - startAt) / (endAt - startAt)) * bucketCount),
        ),
      );
    }
    buckets[bucketIndex]!.amountMinor += transaction.amountMinor;
    const categoryId = transaction.categoryId;
    const label = categoryId ? (categoryNames.get(categoryId) ?? 'Other') : 'Uncategorized';
    categoryTotals.set(label, (categoryTotals.get(label) ?? 0n) + transaction.amountMinor);
  }
  const categoryBreakdown = [...categoryTotals]
    .map(([label, amountMinor]) => ({ label, amountMinor }))
    .sort((a, b) =>
      a.amountMinor === b.amountMinor
        ? a.label.localeCompare(b.label)
        : a.amountMinor > b.amountMinor
          ? -1
          : 1,
    );
  return { spentMinor, incomeMinor, buckets, categoryBreakdown };
}
export function deterministicInsights(input: {
  currentFood: bigint;
  previousFood: bigint;
  budgetUsedPercent: number;
  recurringDue: number;
}): string[] {
  const insights: string[] = [];
  if (input.previousFood > 0n && input.currentFood > input.previousFood) {
    const percentage = Number(
      ((input.currentFood - input.previousFood) * 100n) / input.previousFood,
    );
    if (percentage >= 10)
      insights.push(`Food spending is up ${percentage}% versus the prior period.`);
  }
  if (input.budgetUsedPercent >= 100) insights.push('Budget is exceeded.');
  else if (input.budgetUsedPercent >= 90) insights.push('Budget is near its limit.');
  else if (input.budgetUsedPercent >= 75) insights.push('Budget is in its warning range.');
  if (input.recurringDue > 0)
    insights.push(`${input.recurringDue} recurring payments are due soon.`);
  return insights;
}
