'use client';
import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BudgetDetailScreen } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { asMinor, belongsToUser, idOf, matchesId, SignInGate } from '../../_personal';
type Budget = LocalRecord & {
  name?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  period?: string;
  categoryId?: string;
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
  updatedAt?: number;
  icon?: string;
  alertThreshold?: number;
  notes?: string;
  includeInAnalytics?: boolean;
  accountIds?: string[];
};
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
  accountId?: string;
  title?: string;
  merchant?: string;
};
function aliases(row: LocalRecord) {
  return [row.id, row._id, row.cloudId].filter(
    (value): value is string => typeof value === 'string' && !!value,
  );
}
export default function PersonalBudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, fetchTransactionRange, isConnected } = useBrowserSync();
  const budgets = useLocalRecords<Budget>('budget');
  const transactions = useLocalRecords<Transaction>('transaction');
  const categories = useLocalRecords<Category>('category');
  const accountState = useLocalRecords<Account>('account');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const budget = budgets.records.find(
    (row) =>
      !!userId &&
      belongsToUser(row, userId) &&
      matchesId(row, routeId) &&
      row.period === 'category' &&
      !!row.categoryId &&
      row.archivedAt === undefined,
  );
  const startAt = Number(budget?.startAt ?? 0);
  const endAt = Number(budget?.endAt ?? 1);
  const [rangeError, setRangeError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!userId || !budget || !isConnected || endAt <= startAt) return;
    let active = true;
    setRangeError(null);
    void fetchTransactionRange(startAt, endAt).catch((cause: unknown) => {
      if (active)
        setRangeError(
          cause instanceof Error ? cause.message : 'Could not refresh this budget range.',
        );
    });
    return () => {
      active = false;
    };
  }, [userId, budget?.id, budget?._id, isConnected, fetchTransactionRange, startAt, endAt]);
  const category = categories.records.find(
    (row) =>
      !!userId &&
      belongsToUser(row, userId) &&
      budget &&
      aliases(row).includes(budget.categoryId ?? ''),
  );
  const categoryIds = new Set(
    category ? aliases(category) : budget?.categoryId ? [budget.categoryId] : [],
  );
  const accountAliases = new Map<string, Account>();
  const accountRecords = accountState.records.filter(
    (account) => !!userId && belongsToUser(account, userId),
  );
  for (const account of accountRecords)
    for (const alias of aliases(account)) accountAliases.set(alias, account);
  const currency = budget?.currency ?? 'INR';
  const matching = transactions.records
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
        categoryIds.has(String(row.categoryId ?? '')) &&
        (!budget?.accountIds?.length ||
          (typeof row.accountId === 'string' &&
            budget.accountIds.some(
              (id) =>
                accountAliases.has(id) && aliases(accountAliases.get(id)!).includes(row.accountId!),
            ))),
    )
    .sort((a, b) => Number(b.occurredAt ?? 0) - Number(a.occurredAt ?? 0));
  const spent = matching.reduce((sum, row) => sum + asMinor(row.amountMinor), 0n);
  async function archive() {
    if (!userId || !budget || pending) return;
    const budgetId = String(budget._id ?? budget.cloudId ?? budget.id ?? '');
    if (!budgetId) {
      setActionError('This budget has no saved identifier.');
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      await commitLocalWrite(
        userId,
        'budget',
        'budget.archive',
        { ...budget, archivedAt: Date.now() },
        { budgetId },
        {
          recordId: String(budget.id ?? budget._id ?? budget.cloudId ?? ''),
          dependencies: budget.cloudId || budget._id ? [] : [`budget:${budgetId}`],
          baseUpdatedAt: typeof budget.updatedAt === 'number' ? budget.updatedAt : undefined,
        },
      );
      router.push('/budgets');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not archive this budget.');
    } finally {
      setPending(false);
    }
  }
  if (!userId)
    return (
      <SignInGate eyebrow="BUDGET DETAIL" title="Your budget stays private.">
        Sign in to review this category budget.
      </SignInGate>
    );
  if (budgets.loading || accountState.loading) return <p role="status">Opening budget…</p>;
  if (budgets.error || accountState.error)
    return (
      <p role="alert">
        Budget data could not be opened: {String(budgets.error ?? accountState.error)}
      </p>
    );
  if (!budget)
    return (
      <section>
        <p>Budget unavailable or not category-scoped.</p>
        <Link href="/budgets">Back to budgets</Link>
      </section>
    );
  const rows = matching.slice(0, 10).map((row) => ({
    id: idOf(row),
    title: row.title ?? row.merchant ?? 'Expense',
    date: row.occurredAt
      ? new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(row.occurredAt)
      : 'Date unavailable',
    amountMinor: asMinor(row.amountMinor),
    currency: row.currency ?? currency,
    occurredAt: Number(row.occurredAt ?? 0),
    merchant: row.merchant,
    accountId: row.accountId,
    accountName: row.accountId ? accountAliases.get(row.accountId)?.name : undefined,
    categoryName: category?.name,
  }));
  return (
    <BudgetDetailScreen
      name={budget.name ?? 'Budget'}
      category={category?.name ?? 'Category'}
      icon={category?.icon}
      currency={currency}
      limit={asMinor(budget.amountMinor)}
      spent={spent}
      transactions={rows}
      allTransactions={matching.map((row) => ({
        id: idOf(row),
        amountMinor: asMinor(row.amountMinor),
        currency: row.currency ?? currency,
        occurredAt: Number(row.occurredAt ?? 0),
        title: row.title ?? row.merchant ?? 'Expense',
        merchant: row.merchant,
        accountId: row.accountId,
        accountName: row.accountId ? accountAliases.get(row.accountId)?.name : undefined,
        categoryName: category?.name,
      }))}
      startAt={startAt}
      endAt={endAt}
      settings={{
        icon: budget.icon,
        alertThreshold: budget.alertThreshold,
        notes: budget.notes,
        includeInAnalytics: budget.includeInAnalytics,
        accountIds: budget.accountIds,
      }}
      accounts={accountRecords.flatMap((account) =>
        aliases(account).map((id) => ({ id, name: account.name ?? 'Account' })),
      )}
      loading={transactions.loading || accountState.loading}
      error={
        transactions.error || accountState.error
          ? String(transactions.error ?? accountState.error)
          : (rangeError ?? undefined)
      }
      actionError={actionError}
      pending={pending}
      onEdit={() => router.push(`/budget/${encodeURIComponent(routeId)}/edit`)}
      onAnalytics={() => router.push(`/budget/${encodeURIComponent(routeId)}/analytics`)}
      onArchive={() => void archive()}
      onOpenTransaction={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
      onAddExpense={() => {
        const query = new URLSearchParams({
          categoryId: String(category?._id ?? category?.id ?? budget.categoryId ?? ''),
        });
        if (budget.accountIds?.length === 1) query.set('accountId', budget.accountIds[0]!);
        router.push(`/transaction/new?${query.toString()}`);
      }}
    />
  );
}
