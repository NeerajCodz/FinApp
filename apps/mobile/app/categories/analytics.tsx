import React from 'react';
import { Empty } from '@finapp/ui/native';
import {
  CategoryAnalyticsScreen,
  type AnalyticsAccount,
  type AnalyticsCategory,
  type AnalyticsTransaction,
} from '@finapp/ui/finance';
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
  limitAlertPercent?: number;
};
type AccountRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  currency?: string;
  archivedAt?: number;
};
type ProfileRecord = LocalRecord & { defaultCurrency?: string; defaultIncomeCategoryId?: string };
type TransactionRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  categoryId?: string;
  accountId?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  type?: string;
  title?: string;
  merchant?: string;
  occurredAt?: number;
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

export default function CategoryAnalyticsRoute() {
  const { userId, fetchTransactionRange } = useLocalSync();
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const now = new Date();
  const rangeStartAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1);
  const rangeEndAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const transactionState = useLocalTransactionRange<TransactionRecord>(
    userId,
    rangeStartAt,
    rangeEndAt,
    fetchTransactionRange,
  );
  const owns = (record: LocalRecord) =>
    !!userId && (typeof record.ownerId !== 'string' || record.ownerId === userId);
  const categories = (categoryState.data ?? []).filter(
    (item) => owns(item) && item.archivedAt === undefined,
  );
  const accounts = (accountState.data ?? []).filter(
    (item) => owns(item) && item.archivedAt === undefined,
  );
  const profile = (profileState.data ?? []).find(owns);
  const categoryByAlias = new Map<string, CategoryRecord>();
  const accountByAlias = new Map<string, AccountRecord>();
  for (const item of categories)
    for (const alias of aliases(item)) categoryByAlias.set(alias, item);
  for (const item of accounts) for (const alias of aliases(item)) accountByAlias.set(alias, item);
  const transactionsInRange = (transactionState.data ?? []).filter(
    (item) => owns(item) && item.status === 'posted' && item.deletedAt === undefined,
  );
  const activity = new Map<string, { expense: boolean; income: boolean }>();
  for (const transaction of transactionsInRange) {
    const category = categoryByAlias.get(String(transaction.categoryId ?? ''));
    if (!category) continue;
    const current = activity.get(recordId(category)) ?? { expense: false, income: false };
    if (transaction.type === 'expense') current.expense = true;
    if (transaction.type === 'income') current.income = true;
    activity.set(recordId(category), current);
  }
  const analyticsCategories: AnalyticsCategory[] = categories.map((item) => {
    const usage = activity.get(recordId(item));
    const kind: 'expense' | 'income' =
      item.kind === 'expense' || item.kind === 'income'
        ? item.kind
        : usage?.income && !usage.expense
          ? 'income'
          : profile?.defaultIncomeCategoryId !== undefined &&
              aliases(item).includes(profile.defaultIncomeCategoryId)
            ? 'income'
            : 'expense';
    return {
      id: recordId(item),
      name: item.name ?? 'Category',
      icon: item.icon,
      kind,
      currency: item.limitCurrency ?? profile?.defaultCurrency ?? 'INR',
      monthlyLimitMinor:
        item.monthlyLimitMinor === undefined ? undefined : minor(item.monthlyLimitMinor),
      limitAlertPercent: item.limitAlertPercent,
    };
  });
  const analyticsAccounts: AnalyticsAccount[] = accounts.map((item) => ({
    id: recordId(item),
    name: item.name ?? 'Account',
    currency: item.currency,
  }));
  const analyticsTransactions: AnalyticsTransaction[] = transactionsInRange.flatMap((item) => {
    const category = categoryByAlias.get(String(item.categoryId ?? ''));
    const account = accountByAlias.get(String(item.accountId ?? ''));
    if (!item.currency || !item.type || !Number.isFinite(Number(item.occurredAt))) return [];
    return [
      {
        id: recordId(item),
        categoryId: category ? recordId(category) : undefined,
        accountId: account ? recordId(account) : undefined,
        amountMinor: minor(item.amountMinor),
        currency: item.currency,
        type: item.type,
        title: item.title ?? item.type,
        merchant: item.merchant,
        occurredAt: Number(item.occurredAt),
        status: item.status ?? 'posted',
        deletedAt: item.deletedAt,
      },
    ];
  });
  const loading =
    categoryState.loading ||
    accountState.loading ||
    profileState.loading ||
    transactionState.loading;
  const error =
    categoryState.error ?? accountState.error ?? profileState.error ?? transactionState.error;
  if (!userId)
    return (
      <Empty
        title="Sign in to view category analytics."
        description="Your category analytics are private to your account."
      />
    );
  return (
    <CategoryAnalyticsScreen
      categories={analyticsCategories}
      accounts={analyticsAccounts}
      transactions={analyticsTransactions}
      defaultCurrency={profile?.defaultCurrency ?? 'INR'}
      loading={loading}
      error={error ? `Category analytics could not be opened: ${error}` : undefined}
      onOpenCategory={(id) => router.push(`/category/${encodeURIComponent(id)}` as never)}
    />
  );
}
