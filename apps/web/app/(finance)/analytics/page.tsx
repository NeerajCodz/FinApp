'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ReceiptText } from 'lucide-react';
import { Button, Card, Empty, IconButton, SectionHeader, Tabs, Text, Typography, useTheme } from '@finapp/ui/web';
import { BreakdownDonut, CashFlowChart } from '@finapp/ui/analytics';
import { TransactionRow } from '@finapp/ui/finance';
import {
  aggregateAnalytics,
  getAnalyticsRange,
  type AnalyticsPeriod,
  type AnalyticsTransaction,
} from '@convex/analytics/domain';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & { defaultCurrency?: string; timezone?: string };
type Category = LocalRecord & { name?: string; icon?: string };
type Account = LocalRecord & { name?: string };
type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  accountId?: string;
  groupId?: string;
  merchant?: string;
  title?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};
function amountAsBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}
function idAliases(record: LocalRecord): string[] {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

export default function AnalyticsPage() {
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const router = useRouter();
  const { tokens } = useTheme();
  const {
    records: transactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useLocalRecords<Transaction>('transaction');
  const {
    records: categories,
    loading: categoriesLoading,
    error: categoriesError,
  } = useLocalRecords<Category>('category');
  const {
    records: accounts,
    loading: accountsLoading,
    error: accountsError,
  } = useLocalRecords<Account>('account');
  const {
    records: profiles,
    loading: profileLoading,
    error: profileError,
  } = useLocalRecords<Profile>('profile');
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('month');
  const [referenceAt, setReferenceAt] = React.useState<number | null>(null);
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const [loadedRange, setLoadedRange] = React.useState('');
  React.useEffect(() => setReferenceAt(Date.now()), []);
  const profile = profiles[0];
  const currency = profile?.defaultCurrency ?? 'INR';
  const timeZone = profile?.timezone ?? 'UTC';
  const range = React.useMemo(
    () => (referenceAt === null ? null : getAnalyticsRange(period, referenceAt, timeZone)),
    [period, referenceAt, timeZone],
  );
  const queryRange = React.useMemo(
    () =>
      range
        ? {
            startAt: range.previousStartAt,
            endAt: range.endAt,
          }
        : null,
    [range],
  );
  const rangeKey = queryRange ? `${queryRange.startAt}:${queryRange.endAt}` : '';
  React.useEffect(() => {
    if (!userId || !queryRange) return;
    let active = true;
    setRangeLoading(true);
    setRangeError('');
    void fetchTransactionRange(queryRange.startAt, queryRange.endAt)
      .then(() => {
        if (active) setLoadedRange(rangeKey);
      })
      .catch((cause: unknown) => {
        if (active)
          setRangeError(
            !isConnected
              ? 'Offline: results include only records already stored in this browser.'
              : cause instanceof Error
                ? cause.message
                : 'Could not load the selected date range.',
          );
      })
      .finally(() => {
        if (active) setRangeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, queryRange, rangeKey, userId]);
  const categoryEntities = React.useMemo(
    () =>
      categories.map((category) => ({
        id: String(category.id ?? category._id ?? ''),
        name: String(category.name ?? 'Category'),
        aliases: idAliases(category),
      })),
    [categories],
  );
  const categoryIcons = React.useMemo(
    () =>
      new Map(
        categories.map((category) => [String(category.id ?? category._id ?? ''), category.icon]),
      ),
    [categories],
  );
  const accountEntities = React.useMemo(
    () =>
      accounts.map((account) => ({
        id: String(account.id ?? account._id ?? ''),
        name: String(account.name ?? 'Account'),
        aliases: idAliases(account),
      })),
    [accounts],
  );
  const analyticsTransactions = React.useMemo(
    () =>
      transactions.flatMap((record): AnalyticsTransaction[] => {
        const type = record.type;
        if (
          type !== 'expense' &&
          type !== 'income' &&
          type !== 'transfer' &&
          type !== 'refund' &&
          type !== 'adjustment'
        )
          return [];
        return [
          {
            type,
            amountMinor: amountAsBigInt(record.amountMinor),
            currency: String(record.currency ?? currency),
            ...(typeof record.categoryId === 'string' ? { categoryId: record.categoryId } : {}),
            ...(typeof record.accountId === 'string' ? { accountId: record.accountId } : {}),
            ...(typeof record.merchant === 'string' ? { merchant: record.merchant } : {}),
            ...(typeof record.title === 'string' ? { title: record.title } : {}),
            occurredAt: typeof record.occurredAt === 'number' ? record.occurredAt : 0,
            status:
              record.status === 'pending' || record.status === 'voided' ? record.status : 'posted',
            ...(typeof record.deletedAt === 'number' ? { deletedAt: record.deletedAt } : {}),
          },
        ];
      }),
    [transactions, currency],
  );
  const result = React.useMemo(() => {
    if (!range) return null;
    return aggregateAnalytics(
      analyticsTransactions,
      categoryEntities,
      currency,
      period,
      range.startAt,
      range.endAt,
      timeZone,
      accountEntities,
    );
  }, [analyticsTransactions, categoryEntities, currency, period, range, timeZone, accountEntities]);
  const previous = React.useMemo(() => {
    if (!range) return null;
    return aggregateAnalytics(
      analyticsTransactions,
      categoryEntities,
      currency,
      period,
      range.previousStartAt,
      range.startAt,
      timeZone,
      accountEntities,
    );
  }, [analyticsTransactions, categoryEntities, currency, period, range, timeZone, accountEntities]);
  const flowTotals = React.useMemo(
    () =>
      transactions.reduce<{
        spend: bigint;
        income: bigint;
        transfer: bigint;
        split: bigint;
        other: bigint;
      }>(
        (totals, record) => {
          const occurredAt = Number(record.occurredAt ?? 0);
          if (
            record.status !== 'posted' ||
            record.deletedAt !== undefined ||
            (record.currency ?? currency) !== currency ||
            !range ||
            occurredAt < range.startAt ||
            occurredAt >= range.endAt
          )
            return totals;
          const amountMinor = amountAsBigInt(record.amountMinor);
          if (record.type === 'expense') {
            if (record.groupId) totals.split += amountMinor;
            else totals.spend += amountMinor;
          } else if (record.type === 'income') totals.income += amountMinor;
          else if (record.type === 'transfer') totals.transfer += amountMinor;
          else totals.other += amountMinor;
          return totals;
        },
        { spend: 0n, income: 0n, transfer: 0n, split: 0n, other: 0n },
      ),
    [transactions, currency, range],
  );
  const flowRows = [
    { key: 'spend', label: 'Spend', amountMinor: flowTotals.spend, color: tokens.expense },
    { key: 'income', label: 'Income', amountMinor: flowTotals.income, color: tokens.income },
    { key: 'transfer', label: 'Transfer', amountMinor: flowTotals.transfer, color: tokens.transfer },
    { key: 'split', label: 'Split', amountMinor: flowTotals.split, color: tokens.split },
    { key: 'other', label: 'Other', amountMinor: flowTotals.other, color: tokens.settlement },
  ];
  const comparison = previous
    ? previous.spentMinor === 0n
      ? result?.spentMinor === 0n
        ? 'No spending in either period'
        : 'No spending in the previous period'
      : `${result && result.spentMinor >= previous.spentMinor ? 'Up' : 'Down'} ${Number(
          ((result && result.spentMinor >= previous.spentMinor
            ? result.spentMinor - previous.spentMinor
            : previous.spentMinor - (result?.spentMinor ?? 0n)) *
            100n) /
            previous.spentMinor,
        )}% vs previous period`
    : '';
  const largestExpenses = React.useMemo(
    () =>
      range
        ? transactions
            .filter((record) => {
              const occurredAt = Number(record.occurredAt ?? 0);
              return (
                record.type === 'expense' &&
                record.status === 'posted' &&
                record.deletedAt === undefined &&
                (record.currency ?? currency) === currency &&
                occurredAt >= range.startAt &&
                occurredAt < range.endAt
              );
            })
            .sort((left, right) => {
              const leftAmount = amountAsBigInt(left.amountMinor);
              const rightAmount = amountAsBigInt(right.amountMinor);
              return leftAmount > rightAmount ? -1 : leftAmount < rightAmount ? 1 : 0;
            })
            .slice(0, 5)
        : [],
    [transactions, range, currency],
  );
  const breakdownHref = (dimension: 'category' | 'account' | 'merchant', key: string) => {
    if (!range) return '/analytics';
    const params = new URLSearchParams({
      key,
      period,
      startAt: String(range.startAt),
      endAt: String(range.endAt),
    });
    return `/analytics/breakdown/${dimension}?${params.toString()}`;
  };
  const allError = transactionsError ?? categoriesError ?? accountsError ?? profileError;
  const loading =
    referenceAt === null ||
    transactionsLoading ||
    categoriesLoading ||
    accountsLoading ||
    profileLoading;
  const rangeTransactions = React.useMemo(
    () =>
      range
        ? analyticsTransactions.filter(
            (transaction) =>
              transaction.occurredAt >= range.startAt &&
              transaction.occurredAt < range.endAt &&
              transaction.status === 'posted' &&
              transaction.deletedAt === undefined &&
              (transaction.currency ?? currency) === currency,
          )
        : [],
    [analyticsTransactions, range, currency],
  );

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">SEE THE PATTERN</p>
        <h1>Analytics</h1>
        <p>Sign in to view finance records saved in this browser.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  return (
    <div className="finance-page">
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title">Analytics</Typography>
      </header>
      <Tabs
        value={period}
        onChange={(value) => setPeriod(value as AnalyticsPeriod)}
        label="Analytics period"
        tabs={[
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
          { label: 'Year', value: 'year' },
        ]}
      />
      <Text role="status">
        {rangeLoading
          ? 'Refreshing transactions…'
          : rangeError
            ? 'Showing saved data. Refresh failed; totals may be incomplete.'
            : isConnected && loadedRange === rangeKey
              ? 'The selected server date range has been loaded.'
              : 'Showing browser-cached transactions for this period.'}
      </Text>
      {rangeError && (
        <Button variant="outline" onPress={() => window.location.reload()}>
          Retry
        </Button>
      )}
      {allError && (
        <div role="alert" style={{ display: 'grid', gap: 10 }}>
          <Text style={{ color: tokens.destructive }}>
            Local finance data could not be loaded: {allError}
          </Text>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}
      {loading ? (
        <Typography variant="heading" accessibilityLabel="Loading analytics">
          Loading analytics…
        </Typography>
      ) : allError ? null : (
        result && (
          <>
            <section style={{ display: 'grid', gap: 8 }}>
              <Typography variant="caption">
                {period.toUpperCase()} · {currency}
              </Typography>
              <Typography variant="display">Money in motion.</Typography>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                <Typography variant="label">Spent</Typography>
                <Typography
                  variant="display"
                  style={{ color: tokens.expense, fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatMinor(result.spentMinor, currency)}
                </Typography>
                <Typography variant="caption">{comparison}</Typography>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginTop: 12 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <Typography variant="caption">Income</Typography>
                  <Typography
                    variant="bodyLarge"
                    style={{ color: tokens.income, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatMinor(result.incomeMinor, currency)}
                  </Typography>
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <Typography variant="caption">Net</Typography>
                  <Typography
                    variant="heading"
                    style={{
                      color:
                        result.incomeMinor >= result.spentMinor
                          ? tokens.income
                          : tokens.expense,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatMinor(result.incomeMinor - result.spentMinor, currency)}
                  </Typography>
                </div>
              </div>
            </section>

            {rangeTransactions.length === 0 && (
              <Empty
                title="No activity in this period"
                description="Record a transaction to start seeing trends."
                icon={<ReceiptText size={20} aria-hidden="true" />}
                action={
                  <Link className="finance-inline-link" href="/transaction/new">
                    Add transaction
                  </Link>
                }
              />
            )}

            <section style={{ display: 'grid', gap: 16 }}>
              <SectionHeader title="Cash flow" />
              <CashFlowChart buckets={result.buckets} currency={currency} />
            </section>

            <section style={{ display: 'grid', gap: 12 }}>
              <SectionHeader title="By transaction type" />
              <Card
                variant="subtle"
                style={{
                  display: 'grid',
                  gap: 14,
                  padding: 16,
                  borderRadius: 18,
                  border: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                  {flowRows.map((item) => (
                    <span
                      key={item.key}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          background: item.color,
                        }}
                      />
                      <Typography variant="caption">{item.label}</Typography>
                    </span>
                  ))}
                </div>
                {flowRows.some((item) => item.amountMinor > 0n) ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {flowRows
                      .filter((item) => item.amountMinor > 0n)
                      .map((item) => (
                        <div
                          key={item.key}
                          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              background: item.color,
                            }}
                          />
                          <Typography variant="small" style={{ flex: 1 }}>
                            {item.label}
                          </Typography>
                          <Typography
                            variant="small"
                            style={{ color: item.color, fontVariantNumeric: 'tabular-nums' }}
                          >
                            {formatMinor(item.amountMinor, currency)}
                          </Typography>
                        </div>
                      ))}
                  </div>
                ) : (
                  <Text>No posted activity by type in this period.</Text>
                )}
                <Typography variant="caption">
                  Split expenses are included in total spent above.
                </Typography>
              </Card>
            </section>

            <section style={{ display: 'grid', gap: 16 }}>
              <Typography variant="bodyLarge">Spending by category</Typography>
              <BreakdownDonut
                items={result.categoryBreakdown}
                totalMinor={result.spentMinor}
                currency={currency}
                iconForCategory={(id) => {
                  const icon = categoryIcons.get(id);
                  return typeof icon === 'string' ? icon : undefined;
                }}
                onSelectItem={(item) => router.push(breakdownHref('category', item.id))}
              />
            </section>

            {(
              [
                ['account', 'By account', result.accountBreakdown],
                ['merchant', 'By merchant', result.merchantBreakdown],
              ] as const
            ).map(([dimension, title, items]) => (
              <section key={dimension} style={{ display: 'grid', gap: 12 }}>
                <SectionHeader title={title} />
                {items.length === 0 ? (
                  <Empty
                    title="No expenses to break down"
                    description="Posted expenses in this period will appear here."
                  />
                ) : (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {items.map((item, index) => {
                      const share =
                        result.spentMinor > 0n
                          ? Number((item.amountMinor * 1000n) / result.spentMinor) / 10
                          : 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={`${item.label}, ${formatMinor(item.amountMinor, currency)}, ${share}% of spending`}
                          onClick={() => router.push(breakdownHref(dimension, item.id))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            minHeight: 56,
                            width: '100%',
                            border: 0,
                            padding: 0,
                            background: 'transparent',
                            color: 'inherit',
                            font: 'inherit',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <Typography
                            variant="caption"
                            style={{ width: 20, color: tokens.primary }}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </Typography>
                          <Typography variant="small" style={{ flex: 1 }}>
                            {item.label}
                          </Typography>
                          <span style={{ display: 'grid', justifyItems: 'end' }}>
                            <Typography variant="small">
                              {formatMinor(item.amountMinor, currency)}
                            </Typography>
                            <Typography variant="caption">{share}%</Typography>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}

            <section style={{ display: 'grid', gap: 6 }}>
              <SectionHeader title="Compared with last period" />
              <Typography variant="heading">{comparison}</Typography>
              <Text>
                Previously spent {formatMinor(previous?.spentMinor ?? 0n, currency)}
              </Text>
            </section>

            <section style={{ display: 'grid', gap: 12 }}>
              <SectionHeader title="Largest expenses" />
              {largestExpenses.length === 0 ? (
                <Empty
                  title="No expenses yet"
                  description="Your largest posted expenses in this period will appear here."
                />
              ) : (
                largestExpenses.map((record) => {
                  const id = idAliases(record)[0];
                  const category = categories.find((item) =>
                    idAliases(item).includes(String(record.categoryId ?? '')),
                  );
                  const account = accounts.find((item) =>
                    idAliases(item).includes(String(record.accountId ?? '')),
                  );
                  return (
                    <TransactionRow
                      key={id ?? record.occurredAt}
                      title={record.title || record.merchant || 'Transaction'}
                      merchant={record.merchant}
                      category={typeof category?.name === 'string' ? category.name : undefined}
                      categoryIcon={
                        typeof category?.icon === 'string' ? category.icon : undefined
                      }
                      account={typeof account?.name === 'string' ? account.name : undefined}
                      date={
                        typeof record.occurredAt === 'number'
                          ? new Intl.DateTimeFormat('en-US', {
                              day: 'numeric',
                              month: 'short',
                              timeZone,
                            }).format(record.occurredAt)
                          : undefined
                      }
                      status={record.status}
                      amountMinor={amountAsBigInt(record.amountMinor)}
                      currency={String(record.currency ?? currency)}
                      type="expense"
                      semanticType={typeof record.groupId === 'string' ? 'split' : undefined}
                      onPress={
                        id
                          ? () => router.push(`/transaction/${encodeURIComponent(id)}`)
                          : undefined
                      }
                    />
                  );
                })
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}


