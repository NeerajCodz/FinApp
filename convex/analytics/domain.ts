export type AnalyticsPeriod = 'week' | 'month' | 'year';

export type AnalyticsTransaction = {
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
  amountMinor: bigint;
  currency: string;
  categoryId?: string;
  accountId?: string;
  merchant?: string;
  title?: string;
  occurredAt: number;
  status: 'pending' | 'posted' | 'voided';
  deletedAt?: number;
};

export type AnalyticsAccount = { id: string; name: string; aliases?: readonly string[] };
export type AnalyticsCategory = { id: string; name: string; aliases?: readonly string[] };
export type AnalyticsBucket = {
  startAt: number;
  endAt: number;
  amountMinor: bigint;
  incomeMinor: bigint;
  label: string;
};
export type AnalyticsBreakdownItem = { id: string; label: string; amountMinor: bigint };

export const UNCATEGORIZED_ID = '__uncategorized__';
export const UNASSIGNED_ACCOUNT_ID = '__unassigned_account__';
export const UNSPECIFIED_MERCHANT = 'Unspecified merchant';

const day = 86400000;

type CalendarDate = { year: number; month: number; date: number };

function calendarFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function calendarParts(formatter: Intl.DateTimeFormat, at: number) {
  const parts = formatter.formatToParts(at);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), date: value('day'), hour: value('hour'), minute: value('minute') };
}

function shiftDate(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.date + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, date: shifted.getUTCDate() };
}

function compareDates(a: CalendarDate, b: CalendarDate) {
  return a.year - b.year || a.month - b.month || a.date - b.date;
}

// Find the first instant of the local date, including dates whose midnight is skipped by a DST shift.
function startOfDate(date: CalendarDate, formatter: Intl.DateTimeFormat) {
  const utc = Date.UTC(date.year, date.month - 1, date.date);
  const offsets = [utc - day, utc, utc + day].map((at) => {
    const parts = calendarParts(formatter, at);
    return Date.UTC(parts.year, parts.month - 1, parts.date, parts.hour, parts.minute) - at;
  });
  const candidates = offsets
    .map((offset) => utc - offset)
    .filter((at) => compareDates(calendarParts(formatter, at), date) >= 0);
  if (candidates.length) return Math.min(...candidates);
  // A skipped civil date has no midnight; the following day's start is its empty boundary.
  return utc - Math.min(...offsets);
}

export function getAnalyticsRange(period: AnalyticsPeriod, referenceAt: number, timeZone: string) {
  const formatter = calendarFormatter(timeZone || 'UTC');
  const current = calendarParts(formatter, referenceAt);
  let start: CalendarDate;
  let end: CalendarDate;
  let previous: CalendarDate;
  if (period === 'week') {
    const weekday = new Date(Date.UTC(current.year, current.month - 1, current.date)).getUTCDay();
    start = shiftDate(current, -(weekday + 6) % 7);
    end = shiftDate(start, 7);
    previous = shiftDate(start, -7);
  } else if (period === 'month') {
    start = { ...current, date: 1 };
    const next = shiftDate({ year: current.year, month: current.month + 1, date: 1 }, 0);
    end = next;
    previous = shiftDate({ year: current.year, month: current.month - 1, date: 1 }, 0);
  } else {
    start = { year: current.year, month: 1, date: 1 };
    end = { year: current.year + 1, month: 1, date: 1 };
    previous = { year: current.year - 1, month: 1, date: 1 };
  }
  return {
    startAt: startOfDate(start, formatter),
    endAt: startOfDate(end, formatter),
    previousStartAt: startOfDate(previous, formatter),
  };
}

export function validateAnalyticsRange(period: AnalyticsPeriod, startAt: number, endAt: number) {
  const duration = endAt - startAt;
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt)
    throw new Error('INVALID_DATE_RANGE');
  const limits: Record<AnalyticsPeriod, readonly [number, number]> = {
    week: [6 * day, 8 * day],
    month: [27 * day, 32 * day],
    year: [360 * day, 367 * day],
  };
  const [minimum, maximum] = limits[period];
  if (duration < minimum || duration > maximum) throw new Error('INVALID_DATE_RANGE');
}

function ranked(totals: Map<string, AnalyticsBreakdownItem>) {
  return [...totals.values()].sort((a, b) =>
    a.amountMinor === b.amountMinor
      ? a.label.localeCompare(b.label) || a.id.localeCompare(b.id)
      : a.amountMinor > b.amountMinor ? -1 : 1,
  );
}

function add(totals: Map<string, AnalyticsBreakdownItem>, id: string, label: string, amountMinor: bigint) {
  const existing = totals.get(id);
  if (existing) existing.amountMinor += amountMinor;
  else totals.set(id, { id, label, amountMinor });
}

function aliases<T extends { id: string; aliases?: readonly string[] }>(items: readonly T[]) {
  const byId = new Map<string, T>();
  for (const item of items) {
    byId.set(item.id, item);
    for (const alias of item.aliases ?? []) byId.set(alias, item);
  }
  return byId;
}

export function aggregateAnalytics(
  transactions: readonly AnalyticsTransaction[],
  categories: readonly AnalyticsCategory[],
  currency: string,
  period: AnalyticsPeriod,
  startAt: number,
  endAt: number,
  timeZone = 'UTC',
  accounts: readonly AnalyticsAccount[] = [],
) {
  const formatter = calendarFormatter(timeZone);
  const start = calendarParts(formatter, startAt);
  const count = period === 'week' ? 7 : period === 'month'
    ? new Date(Date.UTC(start.year, start.month, 0)).getUTCDate() : 12;
  const labelFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    ...(period !== 'year' ? { day: 'numeric' } : {}),
    ...(period === 'week' ? { weekday: 'short' } : {}),
  });
  const boundaries = Array.from({ length: count + 1 }, (_, index) => {
    const date = period === 'year'
      ? shiftDate({ year: start.year, month: start.month + index, date: 1 }, 0)
      : shiftDate(start, index);
    return startOfDate(date, formatter);
  });
  const buckets: AnalyticsBucket[] = Array.from({ length: count }, (_, index) => ({
    startAt: boundaries[index]!,
    endAt: boundaries[index + 1]!,
    amountMinor: 0n,
    incomeMinor: 0n,
    label: labelFormatter.format(boundaries[index]!),
  }));
  const categoryById = aliases(categories);
  const accountById = aliases(accounts);
  const categoryTotals = new Map<string, AnalyticsBreakdownItem>();
  const accountTotals = new Map<string, AnalyticsBreakdownItem>();
  const merchantTotals = new Map<string, AnalyticsBreakdownItem>();
  let spentMinor = 0n;
  let incomeMinor = 0n;
  for (const transaction of transactions) {
    if (
      transaction.status !== 'posted' || transaction.deletedAt !== undefined ||
      transaction.currency !== currency || transaction.occurredAt < startAt ||
      transaction.occurredAt >= endAt ||
      (transaction.type !== 'expense' && transaction.type !== 'income')
    ) continue;
    // Binary search exact instant boundaries; local days may be 23 or 25 hours long.
    let low = 0;
    let high = buckets.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (boundaries[middle + 1]! <= transaction.occurredAt) low = middle + 1;
      else high = middle;
    }
    const bucket = buckets[low];
    if (!bucket) continue;
    if (transaction.type === 'income') {
      incomeMinor += transaction.amountMinor;
      bucket.incomeMinor += transaction.amountMinor;
      continue;
    }
    spentMinor += transaction.amountMinor;
    bucket.amountMinor += transaction.amountMinor;
    const category = categoryById.get(transaction.categoryId ?? '');
    const account = accountById.get(transaction.accountId ?? '');
    const merchant = transaction.merchant?.trim() || UNSPECIFIED_MERCHANT;
    add(categoryTotals, category?.id ?? UNCATEGORIZED_ID, category?.name ?? 'Uncategorized', transaction.amountMinor);
    add(accountTotals, account?.id ?? UNASSIGNED_ACCOUNT_ID, account?.name ?? 'Unassigned account', transaction.amountMinor);
    add(merchantTotals, merchant, merchant, transaction.amountMinor);
  }
  return {
    spentMinor,
    incomeMinor,
    buckets,
    categoryBreakdown: ranked(categoryTotals),
    accountBreakdown: ranked(accountTotals),
    merchantBreakdown: ranked(merchantTotals),
  };
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
