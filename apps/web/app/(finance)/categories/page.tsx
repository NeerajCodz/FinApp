'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CategoriesOverview, type CategoryOverviewItem } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { asMinor, aliasesOf, belongsToUser, idOf, SignInGate } from '../_personal';

type Category = LocalRecord & {
  name?: string;
  icon?: string;
  kind?: string;
  sortOrder?: number;
  archivedAt?: number;
  monthlyLimitMinor?: bigint | number | string;
  limitCurrency?: string;
};
type Profile = LocalRecord & {
  defaultCurrency?: string;
  defaultIncomeCategoryId?: string;
};
type Transaction = LocalRecord & {
  categoryId?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  type?: string;
  status?: string;
  occurredAt?: number;
  deletedAt?: number;
};

export default function CategoriesPage() {
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const categoryState = useLocalRecords<Category>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const transactionState = useLocalRecords<Transaction>('transaction');
  const [rangeError, setRangeError] = React.useState('');
  const monthRange = React.useMemo(() => {
    const nowAt = Date.now();
    const now = new Date(nowAt);
    const monthStartAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const monthEndAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const recentStartAt = nowAt - 30 * 86_400_000;
    return {
      monthStartAt,
      monthEndAt,
      recentStartAt,
      recentEndAt: nowAt + 1,
      fetchStartAt: Math.min(monthStartAt, recentStartAt),
    };
  }, []);
  React.useEffect(() => {
    if (!userId || !isConnected) return;
    let active = true;
    setRangeError('');
    void fetchTransactionRange(monthRange.fetchStartAt, monthRange.monthEndAt).catch(
      (cause: unknown) => {
        if (active)
          setRangeError(
            cause instanceof Error ? cause.message : 'Could not refresh monthly category activity.',
          );
      },
    );
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, monthRange, userId]);

  const categories = categoryState.records
    .filter((item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined)
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        idOf(left).localeCompare(idOf(right)),
    );
  const profile = profileState.records.find((item) => userId && belongsToUser(item, userId));
  const categoryByAlias = new Map<string, Category>();
  for (const category of categories)
    for (const alias of aliasesOf(category)) categoryByAlias.set(alias, category);
  const monthly = new Map<string, { spent: bigint; received: bigint; count: number }>();
  const recent = new Map<string, { spent: bigint; lastActivityAt?: number }>();
  for (const transaction of transactionState.records) {
    const occurredAt = Number(transaction.occurredAt ?? 0);
    if (
      !userId ||
      !belongsToUser(transaction, userId) ||
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      (transaction.type !== 'expense' && transaction.type !== 'income') ||
      occurredAt < monthRange.fetchStartAt ||
      occurredAt >= monthRange.monthEndAt
    )
      continue;
    const category = categoryByAlias.get(String(transaction.categoryId ?? ''));
    const currency = category?.limitCurrency ?? profile?.defaultCurrency;
    if (!category || !currency || transaction.currency !== currency) continue;
    const key = idOf(category);
    if (occurredAt >= monthRange.monthStartAt) {
      const total = monthly.get(key) ?? { spent: 0n, received: 0n, count: 0 };
      if (transaction.type === 'expense') total.spent += asMinor(transaction.amountMinor);
      else total.received += asMinor(transaction.amountMinor);
      total.count += 1;
      monthly.set(key, total);
    }
    if (occurredAt >= monthRange.recentStartAt && occurredAt < monthRange.recentEndAt) {
      const total = recent.get(key) ?? { spent: 0n };
      if (transaction.type === 'expense') total.spent += asMinor(transaction.amountMinor);
      total.lastActivityAt = Math.max(total.lastActivityAt ?? 0, occurredAt);
      recent.set(key, total);
    }
  }
  const items: CategoryOverviewItem[] = categories.map((category) => {
    const id = idOf(category);
    const monthlyTotals = monthly.get(id) ?? { spent: 0n, received: 0n, count: 0 };
    const recentTotals = recent.get(id);
    const inferredKind =
      category.kind === 'income' || category.kind === 'expense'
        ? category.kind
        : (monthlyTotals.received > 0n && monthlyTotals.spent === 0n) ||
            (profile?.defaultIncomeCategoryId !== undefined &&
              aliasesOf(category).includes(profile.defaultIncomeCategoryId))
          ? 'income'
          : 'expense';
    return {
      id,
      name: category.name ?? 'Category',
      icon: category.icon,
      kind: inferredKind,
      currency: category.limitCurrency ?? profile?.defaultCurrency ?? 'INR',
      monthSpentMinor: monthlyTotals.spent,
      monthReceivedMinor: monthlyTotals.received,
      recentSpendMinor: recentTotals?.spent ?? 0n,
      monthlyLimitMinor:
        category.monthlyLimitMinor === undefined ? undefined : asMinor(category.monthlyLimitMinor),
      transactionCount: monthlyTotals.count,
      lastActivityAt: recentTotals?.lastActivityAt,
    };
  });
  const loading = categoryState.loading || profileState.loading || transactionState.loading;
  const error = categoryState.error ?? profileState.error ?? transactionState.error;

  if (!userId)
    return (
      <SignInGate eyebrow="CATEGORIES" title="Make every expense clearer.">
        Sign in to view and manage your private category list.
      </SignInGate>
    );
  return (
    <CategoriesOverview
      items={items}
      defaultCurrency={profile?.defaultCurrency ?? 'INR'}
      loading={loading}
      error={
        error
          ? `Category data could not be opened: ${error}`
          : rangeError
            ? 'Category activity could not be refreshed. Showing saved activity.'
            : undefined
      }
      onOpenCategory={(id) => router.push(`/category/${encodeURIComponent(id)}`)}
      onAddCategory={() => router.push('/category/new')}
      onOpenAnalytics={() => router.push('/categories/analytics')}
    />
  );
}
