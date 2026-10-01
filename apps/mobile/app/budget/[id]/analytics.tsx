import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BudgetAnalyticsScreen } from '@finapp/ui/finance';
import { Text } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
type Budget = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  currency?: string;
  period?: string;
  categoryId?: string;
  amountMinor?: bigint | number | string;
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
};
type Category = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  icon?: string;
  archivedAt?: number;
};
type Transaction = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  categoryId?: string;
  type?: string;
  status?: string;
  deletedAt?: number;
  currency?: string;
  amountMinor?: bigint | number | string;
  occurredAt?: number;
  title?: string;
  merchant?: string;
};
function ids(record: LocalRecord) {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}
function amount(value: unknown) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}
function selectedBounds(period: 'week' | 'month' | 'year', now: number) {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  if (period === 'week')
    return [
      Date.UTC(year, month, date.getUTCDate() - 6),
      Date.UTC(year, month, date.getUTCDate() + 1),
    ] as const;
  if (period === 'month') return [Date.UTC(year, month, 1), Date.UTC(year, month + 1, 1)] as const;
  return [Date.UTC(year, 0, 1), Date.UTC(year + 1, 0, 1)] as const;
}
export default function BudgetAnalyticsRoute() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const { userId, fetchTransactionRange } = useLocalSync();
  const budgets = useLocalRecords<Budget>(userId, 'budget');
  const categories = useLocalRecords<Category>(userId, 'category');
  const [payloadPeriod, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const budget = budgets.data?.find(
    (row) =>
      row.period === 'category' &&
      !!row.categoryId &&
      row.archivedAt === undefined &&
      (row.id === routeId || row._id === routeId || row.cloudId === routeId),
  );
  const category = categories.data?.find(
    (row) => budget && ids(row).includes(budget.categoryId ?? ''),
  );
  const categoryIds = category ? ids(category) : budget?.categoryId ? [budget.categoryId] : [];
  const [baseStart, baseEnd] = selectedBounds(payloadPeriod, Date.now());
  const startAt = Math.max(baseStart, Number(budget?.startAt ?? baseStart));
  const endAt = Math.min(baseEnd, Number(budget?.endAt ?? baseEnd));
  const rangeStart = startAt < endAt ? startAt : 0;
  const rangeEnd = startAt < endAt ? endAt : 1;
  const transactionState = useLocalTransactionRange<Transaction>(
    userId,
    rangeStart,
    rangeEnd,
    fetchTransactionRange,
  );
  const currency = budget?.currency ?? 'INR';
  const matching = (transactionState.data ?? [])
    .filter(
      (row) =>
        row.type === 'expense' &&
        row.status === 'posted' &&
        row.deletedAt === undefined &&
        row.currency === currency &&
        Number(row.occurredAt ?? 0) >= startAt &&
        Number(row.occurredAt ?? 0) < endAt &&
        categoryIds.includes(String(row.categoryId ?? '')),
    )
    .map((row) => ({
      id: ids(row)[0] ?? '',
      amountMinor: amount(row.amountMinor),
      currency,
      occurredAt: Number(row.occurredAt ?? 0),
      title: row.title ?? row.merchant ?? 'Expense',
    }))
    .filter((row) => !!row.id);
  const error = budgets.error ?? categories.error ?? transactionState.error;
  if (!userId) return <Text>Sign in to view budget analytics.</Text>;
  if (!budgets.loading && !budget)
    return <Text>Budget unavailable. Return to budgets and choose an active category budget.</Text>;
  return (
    <BudgetAnalyticsScreen
      name={budget?.name ?? 'Budget'}
      category={category?.name ?? 'Category'}
      icon={category?.icon}
      currency={currency}
      limit={amount(budget?.amountMinor)}
      transactions={matching}
      period={payloadPeriod}
      startAt={startAt}
      endAt={endAt}
      loading={budgets.loading || categories.loading || transactionState.loading}
      error={error ? String(error) : undefined}
      onPeriodChange={setPeriod}
      onBack={() => router.push(`/budget/${encodeURIComponent(routeId)}` as never)}
    />
  );
}
