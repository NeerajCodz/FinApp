'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BudgetAnalyticsScreen } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { belongsToUser, matchesId } from '../../../_personal';
type Budget = LocalRecord & {
  name?: string;
  currency?: string;
  period?: string;
  categoryId?: string;
  amountMinor?: bigint | number | string;
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
  accountIds?: string[];
};
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Account = LocalRecord & { name?: string; archivedAt?: number };
type Transaction = LocalRecord & {
  categoryId?: string;
  type?: string;
  status?: string;
  deletedAt?: number;
  currency?: string;
  amountMinor?: bigint | number | string;
  occurredAt?: number;
  title?: string;
  merchant?: string;
  accountId?: string;
};
function aliases(record: LocalRecord) {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && !!value,
  );
}
function asMinor(value: unknown) {
  return typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? BigInt(value)
        : 0n;
}
function bounds(period: 'week' | 'month' | 'year', now: number) {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  if (period === 'week') {
    const start = Date.UTC(year, month, date.getUTCDate() - 6);
    return [start, Date.UTC(year, month, date.getUTCDate() + 1)] as const;
  }
  if (period === 'month') return [Date.UTC(year, month, 1), Date.UTC(year, month + 1, 1)] as const;
  return [Date.UTC(year, 0, 1), Date.UTC(year + 1, 0, 1)] as const;
}
export default function BudgetAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const budgetState = useLocalRecords<Budget>('budget');
  const categoryState = useLocalRecords<Category>('category');
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<Account>('account');
  const [period, setPeriod] = React.useState<'week' | 'month' | 'year'>('month');
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState<string | null>(null);
  const budget = budgetState.records.find(
    (row) =>
      !!userId &&
      belongsToUser(row, userId) &&
      matchesId(row, routeId) &&
      row.period === 'category' &&
      !!row.categoryId &&
      row.archivedAt === undefined,
  );
  const category = categoryState.records.find(
    (row) => budget && aliases(row).includes(budget.categoryId ?? ''),
  );
  const categoryAliases = new Set(
    category ? aliases(category) : budget?.categoryId ? [budget.categoryId] : [],
  );
  const accountAliases = new Map<string, Account>();
  for (const account of accountState.records.filter(
    (row) => !!userId && belongsToUser(row, userId),
  ))
    for (const alias of aliases(account)) accountAliases.set(alias, account);
  const [calendarStart, calendarEnd] = bounds(period, Date.now());
  const startAt = Math.max(calendarStart, Number(budget?.startAt ?? calendarStart));
  const endAt = Math.min(calendarEnd, Number(budget?.endAt ?? calendarEnd));
  const rangeKey = `${startAt}:${endAt}`;
  React.useEffect(() => {
    if (!userId || !budget || !isConnected || startAt >= endAt) return;
    let current = true;
    setRangeLoading(true);
    setRangeError(null);
    void fetchTransactionRange(startAt, endAt)
      .catch((cause: unknown) => {
        if (current)
          setRangeError(
            cause instanceof Error ? cause.message : 'Could not refresh this budget range.',
          );
      })
      .finally(() => {
        if (current) setRangeLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    userId,
    budget?.id,
    budget?._id,
    isConnected,
    fetchTransactionRange,
    startAt,
    endAt,
    rangeKey,
  ]);
  const currency = budget?.currency ?? 'INR';
  const transactions = transactionState.records
    .filter(
      (row) =>
        !!userId &&
        belongsToUser(row, userId) &&
        row.type === 'expense' &&
        row.status === 'posted' &&
        row.deletedAt === undefined &&
        row.currency === currency &&
        Number(row.occurredAt ?? 0) >= startAt &&
        Number(row.occurredAt ?? 0) < endAt &&
        categoryAliases.has(String(row.categoryId ?? '')) &&
        (!budget?.accountIds?.length ||
          (typeof row.accountId === 'string' &&
            budget.accountIds.some(
              (id) =>
                accountAliases.has(id) &&
                aliases(accountAliases.get(id)!).includes(row.accountId!),
            ))),
    )
    .map((row) => ({
      id: aliases(row)[0] ?? '',
      amountMinor: asMinor(row.amountMinor),
      currency,
      occurredAt: Number(row.occurredAt ?? 0),
      title: row.title ?? row.merchant ?? 'Expense',
    }))
    .filter((row) => !!row.id);
  const error =
    budgetState.error ??
    categoryState.error ??
    accountState.error ??
    transactionState.error ??
    rangeError;
  if (!userId) return <p role="alert">Sign in to view budget analytics.</p>;
  if (!budgetState.loading && !budget)
    return (
      <p role="alert">
        Budget unavailable. Return to budgets and choose an active category budget.
      </p>
    );
  return (
    <BudgetAnalyticsScreen
      name={budget?.name ?? 'Budget'}
      category={category?.name ?? 'Category'}
      icon={category?.icon}
      currency={currency}
      limit={asMinor(budget?.amountMinor)}
      transactions={transactions}
      period={period}
      startAt={startAt}
      endAt={endAt}
      loading={
        budgetState.loading ||
        categoryState.loading ||
        accountState.loading ||
        transactionState.loading ||
        rangeLoading
      }
      error={error ? String(error) : undefined}
      onPeriodChange={setPeriod}
      onBack={() => router.push(`/budget/${encodeURIComponent(routeId)}`)}
    />
  );
}
