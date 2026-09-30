'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
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
  accountId?: string;
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
};
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; archivedAt?: number };
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

export default function PersonalBudgetsPage() {
  const { userId, fetchTransactionRange, isConnected } = useBrowserSync();
  const { records: budgetRecords, loading, error } = useLocalRecords<Budget>('budget');
  const { records: transactions } = useLocalRecords<Transaction>('transaction');
  const { records: accountRecords } = useLocalRecords<Account>('account');
  const { records: categoryRecords } = useLocalRecords<Category>('category');
  const [rangeError, setRangeError] = React.useState('');
  const budgets = budgetRecords
    .filter((item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined)
    .sort(
      (left, right) =>
        Number(left.startAt ?? 0) - Number(right.startAt ?? 0) ||
        (left.name ?? '').localeCompare(right.name ?? ''),
    );
  const rangeStartAt = budgets.length
    ? budgets.reduce(
        (minimum, item) => Math.min(minimum, Number(item.startAt ?? 0)),
        Number.MAX_SAFE_INTEGER,
      )
    : null;
  const rangeEndAt = budgets.length
    ? budgets.reduce((maximum, item) => Math.max(maximum, Number(item.endAt ?? 1)), 0)
    : null;
  React.useEffect(() => {
    if (!userId || rangeStartAt === null || rangeEndAt === null || !isConnected) return;
    let live = true;
    setRangeError('');
    void fetchTransactionRange(rangeStartAt, rangeEndAt).catch((cause: unknown) => {
      if (live)
        setRangeError(
          cause instanceof Error ? cause.message : 'Could not refresh budget activity.',
        );
    });
    return () => {
      live = false;
    };
  }, [fetchTransactionRange, isConnected, rangeEndAt, rangeStartAt, userId]);
  const accounts = accountRecords.filter((item) => userId && belongsToUser(item, userId));
  const categories = categoryRecords.filter((item) => userId && belongsToUser(item, userId));
  const categoryByAlias = new Map<string, Category>();
  const accountByAlias = new Map<string, Account>();
  for (const category of categories)
    for (const key of [category.id, category._id, category.cloudId])
      if (typeof key === 'string') categoryByAlias.set(key, category);
  for (const account of accounts)
    for (const key of [account.id, account._id, account.cloudId])
      if (typeof key === 'string') accountByAlias.set(key, account);

  const spentForBudget = (budget: Budget) => {
    const category = budget.categoryId ? categoryByAlias.get(budget.categoryId) : undefined;
    const account = budget.accountId ? accountByAlias.get(budget.accountId) : undefined;
    const currency = budget.currency ?? account?.currency ?? 'INR';
    return transactions.reduce((sum, transaction) => {
      if (
        transaction.type !== 'expense' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        Number(transaction.occurredAt ?? 0) < Number(budget.startAt ?? 0) ||
        Number(transaction.occurredAt ?? 0) >= Number(budget.endAt ?? Number.MAX_SAFE_INTEGER) ||
        transaction.currency !== currency
      )
        return sum;
      if (
        budget.period === 'category' &&
        transaction.categoryId !== budget.categoryId &&
        (!category || categoryByAlias.get(String(transaction.categoryId ?? '')) !== category)
      )
        return sum;
      if (
        budget.period === 'account' &&
        transaction.accountId !== budget.accountId &&
        (!account || accountByAlias.get(String(transaction.accountId ?? '')) !== account)
      )
        return sum;
      return sum + asMinor(transaction.amountMinor);
    }, 0n);
  };
  const featuredBudget = budgets[0];
  const featuredAccount = featuredBudget?.accountId
    ? accountByAlias.get(featuredBudget.accountId)
    : undefined;
  const featuredCurrency = featuredBudget?.currency ?? featuredAccount?.currency ?? 'INR';
  const featuredSpent = featuredBudget ? spentForBudget(featuredBudget) : 0n;
  const featuredLimit = featuredBudget ? asMinor(featuredBudget.amountMinor) : 0n;
  const featuredRemaining = featuredLimit - featuredSpent;
  const featuredPercent =
    featuredLimit > 0n ? Math.min(100, Number((featuredSpent * 100n) / featuredLimit)) : 0;
  if (!userId)
    return (
      <SignInGate eyebrow="BUDGETS" title="Spend with intention.">
        Sign in to open budgets and activity saved in your private browser workspace.
      </SignInGate>
    );
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <h1>Budgets</h1>
          <p className="finance-muted">Keep spending within reach</p>
        </div>
        <Link className="finance-secondary-action" href="/budget/new" aria-label="New budget">
          <Plus size={20} />
        </Link>
      </header>
      {featuredBudget && (
        <Card className="finance-metric-card finance-balance-card">
          <span className="finance-metric-label">Budget overview</span>
          <span className="finance-metric-foot">
            {featuredBudget.name ?? 'No active budget'} · {featuredCurrency}
          </span>
          <span className="finance-metric-foot">Spent so far</span>
          <strong>{formatMinor(featuredSpent, featuredCurrency)}</strong>
          <div
            className="finance-plan-track"
            role="progressbar"
            aria-label={`${featuredBudget.name ?? 'Budget'} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={featuredPercent}
          >
            <span style={{ width: `${featuredPercent}%` }} />
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <span>Budgeted {formatMinor(featuredLimit, featuredCurrency)}</span>
            <span>
              {featuredRemaining < 0n ? 'Over limit ' : 'Available '}
              {formatMinor(
                featuredRemaining < 0n ? -featuredRemaining : featuredRemaining,
                featuredCurrency,
              )}
            </span>
          </div>
        </Card>
      )}
      {rangeError && (
        <p className="finance-muted" role="status">
          Could not refresh this date range; totals use the records cached here. {rangeError}
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader title="Your budgets" action={<span>{budgets.length} active</span>} />
        {loading ? (
          <p className="finance-muted" role="status">
            Loading budgets…
          </p>
        ) : error ? (
          <p className="finance-form-error" role="alert">
            Budget data could not be opened: {error}
          </p>
        ) : budgets.length === 0 ? (
          <Empty
            title="Give your money a plan"
            description="Add a spending limit and watch real posted expenses move against it."
            icon={<CalendarDays size={20} />}
            action={
              <Link className="finance-inline-link" href="/budget/new">
                Create a budget
              </Link>
            }
          />
        ) : (
          <ul className="finance-plan-cards">
            {budgets.map((budget) => {
              const category = budget.categoryId
                ? categoryByAlias.get(budget.categoryId)
                : undefined;
              const account = budget.accountId ? accountByAlias.get(budget.accountId) : undefined;
              const currency = budget.currency ?? account?.currency ?? 'INR';
              const spent = spentForBudget(budget);
              const limit = asMinor(budget.amountMinor);
              const percent = limit > 0n ? Math.min(100, Number((spent * 100n) / limit)) : 0;
              const remaining = limit - spent;
              const scope =
                budget.period === 'category'
                  ? (category?.name ?? 'Category')
                  : budget.period === 'account'
                    ? (account?.name ?? 'Account')
                    : budget.period === 'custom'
                      ? 'Custom dates'
                      : 'Monthly';
              return (
                <li className="finance-plan-card" key={idOf(budget)}>
                  <Link
                    href={`/budget/${encodeURIComponent(idOf(budget))}`}
                    style={{ display: 'grid', gap: 10, color: 'inherit', textDecoration: 'none' }}
                  >
                    <div className="finance-budget-heading">
                      <span>
                        <strong>{budget.name ?? 'Budget'}</strong>
                        <small>
                          {scope} · {currency}
                        </small>
                      </span>
                      <strong>
                        {formatMinor(spent, currency)}{' '}
                        <small>of {formatMinor(limit, currency)}</small>
                      </strong>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        gap: 8,
                        color: 'var(--finance-muted)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <span>
                        {remaining < 0n ? 'Over by ' : 'Available '}
                        {formatMinor(remaining < 0n ? -remaining : remaining, currency)}
                      </span>
                      <span>{Math.round(Number((spent * 100n) / (limit || 1n)))}% used</span>
                    </div>
                    <div className="finance-plan-track">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <small className="finance-plan-dates">
                      {budget.startAt
                        ? new Date(budget.startAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}{' '}
                      –{' '}
                      {budget.endAt
                        ? new Date(budget.endAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </small>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="finance-form-note">
        Budget totals are based on posted transactions currently stored in this browser. A date
        range may be incomplete until loaded from sync.
      </p>
    </div>
  );
}
