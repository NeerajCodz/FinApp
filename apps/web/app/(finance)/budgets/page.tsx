'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { BudgetOverviewScreen } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { asMinor, belongsToUser, idOf, SignInGate } from '../_personal';
type Budget = LocalRecord & {
  name?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  period?: string;
  categoryId?: string;
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
  alertThreshold?: number;
  accountIds?: string[];
};
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Account = LocalRecord & { archivedAt?: number };
type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  accountId?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};
function ids(row: LocalRecord) {
  return [row.id, row._id, row.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}
export default function PersonalBudgetsPage() {
  const router = useRouter();
  const { userId, fetchTransactionRange, isConnected } = useBrowserSync();
  const budgetState = useLocalRecords<Budget>('budget');
  const categoryState = useLocalRecords<Category>('category');
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<Account>('account');
  const budgets = budgetState.records.filter(
    (row) =>
      !!userId &&
      belongsToUser(row, userId) &&
      row.period === 'category' &&
      !!row.categoryId &&
      row.archivedAt === undefined,
  );
  const startAt = budgets.length
    ? Math.min(...budgets.map((row) => Number(row.startAt ?? 0)))
    : null;
  const endAt = budgets.length ? Math.max(...budgets.map((row) => Number(row.endAt ?? 0))) : null;
  const [rangeError, setRangeError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!userId || startAt === null || endAt === null || endAt <= startAt || !isConnected) return;
    let active = true;
    setRangeError(null);
    void fetchTransactionRange(startAt, endAt).catch((cause: unknown) => {
      if (active)
        setRangeError(
          cause instanceof Error ? cause.message : 'Could not refresh budget activity.',
        );
    });
    return () => {
      active = false;
    };
  }, [userId, startAt, endAt, isConnected, fetchTransactionRange]);
  const categories = categoryState.records.filter((row) => !!userId && belongsToUser(row, userId));
  const categoryByAlias = new Map<string, Category>();
  for (const row of categories) for (const alias of ids(row)) categoryByAlias.set(alias, row);
  const accountAliases = new Map<string, Set<string>>();
  for (const account of accountState.records) {
    const aliases = ids(account);
    for (const alias of aliases) accountAliases.set(alias, new Set(aliases));
  }
  const items = budgets
    .map((budget) => {
      const category = categoryByAlias.get(budget.categoryId ?? '');
      const currency = budget.currency ?? 'INR';
      const matching = category
        ? transactionState.records.filter(
            (row) =>
              !!userId &&
              belongsToUser(row, userId) &&
              row.type === 'expense' &&
              row.status === 'posted' &&
              row.deletedAt === undefined &&
              row.currency === currency &&
              Number(row.occurredAt ?? 0) >= Number(budget.startAt ?? 0) &&
              Number(row.occurredAt ?? 0) < Number(budget.endAt ?? 0) &&
              categoryByAlias.get(String(row.categoryId ?? '')) === category &&
              (!budget.accountIds?.length ||
                (typeof row.accountId === 'string' &&
                  budget.accountIds.some((id) => accountAliases.get(id)?.has(row.accountId!)))),
          )
        : [];
      return {
        id: idOf(budget),
        name: budget.name ?? 'Budget',
        category: category?.name ?? 'Category',
        icon: category?.icon,
        currency,
        spentMinor: matching.reduce((sum, row) => sum + asMinor(row.amountMinor), 0n),
        limitMinor: asMinor(budget.amountMinor),
        startAt: Number(budget.startAt ?? 0),
        endAt: Number(budget.endAt ?? 0),
        alertThreshold: budget.alertThreshold,
      };
    })
    .filter((row) => !!row.id)
    .sort((a, b) => a.startAt - b.startAt || a.name.localeCompare(b.name));
  const error =
    budgetState.error ??
    categoryState.error ??
    transactionState.error ??
    accountState.error ??
    rangeError;
  if (!userId)
    return (
      <SignInGate eyebrow="BUDGETS" title="Spend with intention.">
        Sign in to review category limits and posted spending.
      </SignInGate>
    );
  return (
    <BudgetOverviewScreen
      items={items}
      loading={
        budgetState.loading ||
        categoryState.loading ||
        transactionState.loading ||
        accountState.loading
      }
      error={error ? String(error) : undefined}
      onCreate={() => router.push('/budgets/new')}
      onOpen={(id) => router.push(`/budget/${encodeURIComponent(id)}`)}
      onAnalytics={() => {
        const first = items[0];
        if (first) router.push(`/budget/${encodeURIComponent(first.id)}/analytics`);
      }}
    />
  );
}
