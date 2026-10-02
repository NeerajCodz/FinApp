import React from 'react';
import { Empty } from '@finapp/ui/native';
import { CategoriesOverview, type CategoryOverviewItem } from '@finapp/ui/finance';
import { router } from 'expo-router';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type CategoryRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  icon?: string;
  kind?: string;
  sortOrder?: number;
  archivedAt?: number;
  monthlyLimitMinor?: bigint | number | string;
  limitCurrency?: string;
};
type ProfileRecord = LocalRecord & { defaultCurrency?: string; defaultIncomeCategoryId?: string };
type TransactionRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  categoryId?: string;
  occurredAt?: number;
  amountMinor?: bigint | number | string;
  currency?: string;
  type?: string;
  status?: string;
  deletedAt?: number;
};
function recordId(record: LocalRecord) {
  return String(record.id ?? record._id ?? record.cloudId ?? '');
}
function aliases(record: LocalRecord) {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}
function minor(value: unknown) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

export default function CategoriesIndexScreen() {
  const { userId, fetchTransactionRange } = useLocalSync();
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const nowAt = Date.now();
  const now = new Date(nowAt);
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const recentStart = nowAt - 30 * 86_400_000;
  const recentEnd = nowAt + 1;
  const rangeStart = Math.min(monthStart, recentStart);
  const transactionState = useLocalTransactionRange<TransactionRecord>(
    userId,
    rangeStart,
    monthEnd,
    fetchTransactionRange,
  );
  const owns = (record: LocalRecord) =>
    !!userId && (typeof record.ownerId !== 'string' || record.ownerId === userId);
  const categories = (categoryState.data ?? [])
    .filter((item) => owns(item) && item.archivedAt === undefined)
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        recordId(left).localeCompare(recordId(right)),
    );
  const profile = (profileState.data ?? []).find(owns);
  const categoryByAlias = new Map<string, CategoryRecord>();
  for (const item of categories)
    for (const alias of aliases(item)) categoryByAlias.set(alias, item);
  const monthly = new Map<string, { spent: bigint; received: bigint; count: number }>();
  const recent = new Map<string, { spent: bigint; lastActivityAt?: number }>();
  for (const transaction of transactionState.data ?? []) {
    const occurredAt = Number(transaction.occurredAt ?? 0);
    if (
      !owns(transaction) ||
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      (transaction.type !== 'expense' && transaction.type !== 'income')
    )
      continue;
    const category = categoryByAlias.get(String(transaction.categoryId ?? ''));
    const currency = category?.limitCurrency ?? profile?.defaultCurrency;
    if (!category || !currency || transaction.currency !== currency) continue;
    const key = recordId(category);
    if (occurredAt >= monthStart) {
      const value = monthly.get(key) ?? { spent: 0n, received: 0n, count: 0 };
      if (transaction.type === 'expense') value.spent += minor(transaction.amountMinor);
      else value.received += minor(transaction.amountMinor);
      value.count += 1;
      monthly.set(key, value);
    }
    if (occurredAt >= recentStart && occurredAt < recentEnd) {
      const value = recent.get(key) ?? { spent: 0n };
      if (transaction.type === 'expense') value.spent += minor(transaction.amountMinor);
      value.lastActivityAt = Math.max(value.lastActivityAt ?? 0, occurredAt);
      recent.set(key, value);
    }
  }
  const items: CategoryOverviewItem[] = categories.map((item) => {
    const id = recordId(item);
    const monthTotals = monthly.get(id) ?? { spent: 0n, received: 0n, count: 0 };
    const recentTotals = recent.get(id);
    const kind =
      item.kind === 'expense' || item.kind === 'income'
        ? item.kind
        : (monthTotals.received > 0n && monthTotals.spent === 0n) ||
            (profile?.defaultIncomeCategoryId !== undefined &&
              aliases(item).includes(profile.defaultIncomeCategoryId))
          ? 'income'
          : 'expense';
    return {
      id,
      name: item.name ?? 'Category',
      icon: item.icon,
      kind,
      currency: item.limitCurrency ?? profile?.defaultCurrency ?? 'INR',
      monthSpentMinor: monthTotals.spent,
      monthReceivedMinor: monthTotals.received,
      recentSpendMinor: recentTotals?.spent ?? 0n,
      monthlyLimitMinor:
        item.monthlyLimitMinor === undefined ? undefined : minor(item.monthlyLimitMinor),
      transactionCount: monthTotals.count,
      lastActivityAt: recentTotals?.lastActivityAt,
    };
  });
  const loading = categoryState.loading || profileState.loading || transactionState.loading;
  const error = categoryState.error ?? profileState.error ?? transactionState.error;
  if (!userId)
    return (
      <Empty
        title="Sign in to view categories."
        description="Your categories and spending activity are private to your account."
      />
    );
  return (
    <CategoriesOverview
      items={items}
      defaultCurrency={profile?.defaultCurrency ?? 'INR'}
      loading={loading}
      error={error ? `Category data could not be opened: ${error}` : undefined}
      onOpenCategory={(id) => router.push(`/category/${encodeURIComponent(id)}` as never)}
      onAddCategory={() => router.push('/categories/new' as never)}
      onOpenAnalytics={() => router.push('/categories/analytics' as never)}
    />
  );
}
