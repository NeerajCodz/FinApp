'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  CategoryAnalyticsScreen,
  type AnalyticsAccount,
  type AnalyticsBudget,
  type AnalyticsCategory,
  type AnalyticsTransaction,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, asMinor, belongsToUser, idOf, SignInGate } from '../../_personal';

type Category = LocalRecord & {
  name?: string;
  icon?: string;
  kind?: string;
  archivedAt?: number;
  monthlyLimitMinor?: bigint | number | string;
  limitCurrency?: string;
  sortOrder?: number;
};
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Profile = LocalRecord & { defaultCurrency?: string; defaultIncomeCategoryId?: string };
type Transaction = LocalRecord & {
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
type Budget = LocalRecord & {
  amountMinor?: bigint | number | string;
  currency?: string;
  period?: string;
  categoryId?: string;
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
};

export default function CategoryAnalyticsPage() {
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const categoryState = useLocalRecords<Category>('category');
  const accountState = useLocalRecords<Account>('account');
  const profileState = useLocalRecords<Profile>('profile');
  const transactionState = useLocalRecords<Transaction>('transaction');
  const budgetState = useLocalRecords<Budget>('budget');
  const [rangeError, setRangeError] = React.useState('');
  const range = React.useMemo(() => {
    const now = new Date();
    const endAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    return { startAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1), endAt };
  }, []);
  React.useEffect(() => {
    if (!userId || !isConnected) return;
    let active = true;
    setRangeError('');
    void fetchTransactionRange(range.startAt, range.endAt).catch((cause: unknown) => {
      if (active)
        setRangeError(
          cause instanceof Error ? cause.message : 'Could not refresh category analytics activity.',
        );
    });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, range, userId]);

  const categories = categoryState.records
    .filter((item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined)
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        idOf(left).localeCompare(idOf(right)),
    );
  const accounts = accountState.records.filter(
    (item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined,
  );
  const budgets = budgetState.records.filter(
    (item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined,
  );
  const profile = profileState.records.find((item) => userId && belongsToUser(item, userId));
  const categoryByAlias = new Map<string, Category>();
  const accountByAlias = new Map<string, Account>();
  for (const item of categories)
    for (const alias of aliasesOf(item)) categoryByAlias.set(alias, item);
  for (const item of accounts) for (const alias of aliasesOf(item)) accountByAlias.set(alias, item);
  const ownedTransactions = transactionState.records.filter(
    (item) =>
      userId &&
      belongsToUser(item, userId) &&
      item.status === 'posted' &&
      item.deletedAt === undefined,
  );
  const categoryActivity = new Map<string, { expense: boolean; income: boolean }>();
  for (const transaction of ownedTransactions) {
    const category = categoryByAlias.get(String(transaction.categoryId ?? ''));
    if (!category || Number(transaction.occurredAt ?? 0) < range.startAt) continue;
    const activity = categoryActivity.get(idOf(category)) ?? { expense: false, income: false };
    if (transaction.type === 'expense') activity.expense = true;
    if (transaction.type === 'income') activity.income = true;
    categoryActivity.set(idOf(category), activity);
  }
  const categoryOptions: AnalyticsCategory[] = categories.map((item) => {
    const activity = categoryActivity.get(idOf(item));
    const isDefaultIncome =
      typeof profile?.defaultIncomeCategoryId === 'string' &&
      aliasesOf(item).includes(profile.defaultIncomeCategoryId);
    const kind: 'expense' | 'income' =
      item.kind === 'income' || item.kind === 'expense'
        ? item.kind
        : (activity?.income && !activity.expense) || isDefaultIncome
          ? 'income'
          : 'expense';
    return {
      id: idOf(item),
      name: item.name ?? 'Category',
      icon: item.icon,
      kind,
      currency: item.limitCurrency ?? profile?.defaultCurrency ?? 'INR',
      monthlyLimitMinor:
        item.monthlyLimitMinor === undefined ? undefined : asMinor(item.monthlyLimitMinor),
    };
  });
  const analyticsTransactions: AnalyticsTransaction[] = ownedTransactions.flatMap((item) => {
    const category = categoryByAlias.get(String(item.categoryId ?? ''));
    const account = accountByAlias.get(String(item.accountId ?? ''));
    if (!item.currency || !item.type || !Number.isFinite(Number(item.occurredAt))) return [];
    return [
      {
        id: idOf(item),
        categoryId: category ? idOf(category) : undefined,
        accountId: account ? idOf(account) : undefined,
        amountMinor: asMinor(item.amountMinor),
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
  const analyticsAccounts: AnalyticsAccount[] = accounts.map((item) => ({
    id: idOf(item),
    name: item.name ?? 'Account',
    currency: item.currency,
  }));
  const analyticsBudgets: AnalyticsBudget[] = budgets.flatMap((item) => {
    const category = item.categoryId ? categoryByAlias.get(item.categoryId) : undefined;
    if (
      !item.currency ||
      item.period !== 'category' ||
      !Number.isFinite(Number(item.startAt)) ||
      !Number.isFinite(Number(item.endAt))
    )
      return [];
    return [
      {
        id: idOf(item),
        categoryId: category ? idOf(category) : item.categoryId,
        amountMinor: asMinor(item.amountMinor),
        currency: item.currency,
        period: item.period,
        startAt: Number(item.startAt),
        endAt: Number(item.endAt),
        archivedAt: item.archivedAt,
      },
    ];
  });
  const loading =
    categoryState.loading ||
    accountState.loading ||
    profileState.loading ||
    transactionState.loading ||
    budgetState.loading;
  const error =
    categoryState.error ??
    accountState.error ??
    profileState.error ??
    transactionState.error ??
    budgetState.error;

  if (!userId)
    return (
      <SignInGate eyebrow="CATEGORY ANALYTICS" title="Know where your money goes.">
        Sign in to explore private category activity.
      </SignInGate>
    );
  return (
    <CategoryAnalyticsScreen
      categories={categoryOptions}
      accounts={analyticsAccounts}
      transactions={analyticsTransactions}
      budgets={analyticsBudgets}
      defaultCurrency={profile?.defaultCurrency ?? 'INR'}
      loading={loading}
      error={
        error
          ? `Category analytics could not be opened: ${error}`
          : rangeError
            ? 'Activity refresh failed. Showing saved transactions.'
            : undefined
      }
      onOpenCategory={(id) => router.push(`/category/${encodeURIComponent(id)}`)}
    />
  );
}
