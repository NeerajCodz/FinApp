'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ChartNoAxesCombined, ReceiptText, Tags } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
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
    { key: 'spend', label: 'Spend', amountMinor: flowTotals.spend, color: '#ff9d8f' },
    {
      key: 'income',
      label: 'Income',
      amountMinor: flowTotals.income,
      color: 'var(--finance-lime)',
    },
    { key: 'transfer', label: 'Transfer', amountMinor: flowTotals.transfer, color: '#9eb4ff' },
    { key: 'split', label: 'Split', amountMinor: flowTotals.split, color: '#c7a2ff' },
    { key: 'other', label: 'Other', amountMinor: flowTotals.other, color: '#a8ad9e' },
  ];
  const comparison = previous
    ? previous.spentMinor === 0n
      ? result?.spentMinor === 0n
        ? 'No spending in either period'
        : 'No spending in the previous period'
      : result?.spentMinor === previous.spentMinor
        ? 'No change from previous period'
        : `${result && result.spentMinor > previous.spentMinor ? 'Up' : 'Down'} ${Number(
            ((result
              ? result.spentMinor >= previous.spentMinor
                ? result.spentMinor - previous.spentMinor
                : previous.spentMinor - result.spentMinor
              : 0n) *
              100n) /
              previous.spentMinor,
          )}% vs previous period`
    : '';
  const spendingShare = (amountMinor: bigint) =>
    result && result.spentMinor > 0n ? Number((amountMinor * 1000n) / result.spentMinor) / 10 : 0;
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
  const chartScale =
    result?.buckets.reduce((largest, bucket) => {
      const bucketTotal =
        bucket.amountMinor > bucket.incomeMinor ? bucket.amountMinor : bucket.incomeMinor;
      return bucketTotal > largest ? bucketTotal : largest;
    }, 0n) ?? 0n;

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
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">A CLEARER VIEW OF YOUR MONEY</p>
          <h1>Analytics</h1>
          <p className="finance-muted">
            Calculated for the selected period and profile time zone. Offline results may omit
            history not cached in this browser.
          </p>
        </div>
        <Badge variant="neutral">{transactions.length} local records</Badge>
      </header>
      <div className="finance-form-actions" role="group" aria-label="Analytics period">
        {(['week', 'month', 'year'] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant={period === option ? 'secondary' : 'outline'}
            aria-pressed={period === option}
            onPress={() => setPeriod(option)}
          >
            {option === 'week' ? 'Week' : option === 'month' ? 'Month' : 'Year'}
          </Button>
        ))}
      </div>
      <p className="finance-muted" role="status">
        {rangeLoading
          ? 'Loading transactions for this period…'
          : rangeError
            ? rangeError
            : isConnected && loadedRange === rangeKey
              ? 'The selected server date range has been loaded.'
              : 'Showing browser-cached transactions for this period.'}
      </p>
      {allError && (
        <p className="finance-form-error" role="alert">
          Local finance data could not be loaded: {allError}
        </p>
      )}
      {loading ? (
        <Card className="finance-record-panel">
          <p className="finance-muted" role="status">
            Calculating from your local records…
          </p>
        </Card>
      ) : allError ? (
        <Card className="finance-record-panel">
          <p className="finance-muted">Reload this page to retry opening browser data.</p>
        </Card>
      ) : (
        result && (
          <>
            <section style={{ display: 'grid', gap: 12 }}>
              <SectionHeader
                title="Money in motion"
                action={
                  <span>
                    {period} · {currency}
                  </span>
                }
              />
              <div className="finance-metric-grid">
                <Card className="finance-metric-card">
                  <span className="finance-metric-label">SPENT</span>
                  <strong style={{ color: '#ff9d8f' }}>
                    {formatMinor(result.spentMinor, currency)}
                  </strong>
                  <span className="finance-metric-foot">Posted expenses this {period}</span>
                </Card>
                <Card className="finance-metric-card">
                  <span className="finance-metric-label">INCOME</span>
                  <strong style={{ color: 'var(--finance-lime)' }}>
                    {formatMinor(result.incomeMinor, currency)}
                  </strong>
                  <span className="finance-metric-foot">Posted income this {period}</span>
                </Card>
                <Card className="finance-metric-card">
                  <span className="finance-metric-label">NET</span>
                  <strong
                    style={{
                      color:
                        result.incomeMinor >= result.spentMinor ? 'var(--finance-lime)' : '#ff9d8f',
                    }}
                  >
                    {formatMinor(result.incomeMinor - result.spentMinor, currency)}
                  </strong>
                  <span className="finance-metric-foot">Income minus spending</span>
                </Card>
              </div>
              <p className="finance-muted">{comparison}</p>
            </section>
            {rangeTransactions.length === 0 && (
              <Empty
                title="No activity in this period"
                description="Record a transaction to start seeing trends."
                icon={<ReceiptText size={20} />}
                action={
                  <Link className="finance-inline-link" href="/transaction/new">
                    Add transaction
                  </Link>
                }
              />
            )}
            <Card className="finance-chart-panel">
              <SectionHeader
                title="Cash flow"
                action={<span>{rangeTransactions.length} posted entries</span>}
              />
              {result.buckets.every(
                (bucket) => bucket.amountMinor === 0n && bucket.incomeMinor === 0n,
              ) ? (
                <Empty
                  title="No cash flow to chart"
                  description="Cash flow bars will appear when expenses or income are posted."
                  icon={<ChartNoAxesCombined size={20} />}
                />
              ) : (
                <ol
                  aria-label="Cash flow by date"
                  style={{ display: 'grid', gap: 14, margin: 0, padding: 0, listStyle: 'none' }}
                >
                  {result.buckets.map((bucket) => {
                    const expenseWidth =
                      chartScale > 0n ? Number((bucket.amountMinor * 100n) / chartScale) : 0;
                    const incomeWidth =
                      chartScale > 0n ? Number((bucket.incomeMinor * 100n) / chartScale) : 0;
                    return (
                      <li key={`${bucket.startAt}-${bucket.label}`}>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            gap: 5,
                            marginBottom: 6,
                            color: 'var(--finance-muted)',
                            fontSize: '0.75rem',
                          }}
                        >
                          <span>{bucket.label}</span>
                          <span>
                            {formatMinor(bucket.amountMinor, currency)} spent ·{' '}
                            {formatMinor(bucket.incomeMinor, currency)} income
                          </span>
                        </div>
                        <div
                          role="img"
                          aria-label={`${bucket.label}: ${formatMinor(bucket.amountMinor, currency)} expenses and ${formatMinor(bucket.incomeMinor, currency)} income`}
                          style={{ display: 'grid', gap: 4 }}
                        >
                          <span
                            style={{
                              display: 'block',
                              width: `${expenseWidth}%`,
                              minWidth: bucket.amountMinor > 0n ? 3 : 0,
                              height: 7,
                              borderRadius: 99,
                              background: '#ff9d8f',
                            }}
                          />
                          <span
                            style={{
                              display: 'block',
                              width: `${incomeWidth}%`,
                              minWidth: bucket.incomeMinor > 0n ? 3 : 0,
                              height: 7,
                              borderRadius: 99,
                              background: 'var(--finance-lime)',
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="finance-metric-foot" style={{ gap: 15, marginTop: 16 }}>
                <span>
                  <i
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      marginRight: 6,
                      borderRadius: '50%',
                      background: '#ff9d8f',
                    }}
                  />
                  Expenses
                </span>
                <span>
                  <i
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      marginRight: 6,
                      borderRadius: '50%',
                      background: 'var(--finance-lime)',
                    }}
                  />
                  Income
                </span>
              </p>
            </Card>
            <Card className="finance-record-panel">
              <SectionHeader title="By transaction type" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                {flowRows.map((item) => (
                  <span
                    key={item.key}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                  >
                    <i
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        height: 8,
                        borderRadius: '50%',
                        background: item.color,
                      }}
                    />
                    {item.label}
                  </span>
                ))}
              </div>
              {flowRows.some((item) => item.amountMinor > 0n) ? (
                <ul className="finance-record-list">
                  {flowRows
                    .filter((item) => item.amountMinor > 0n)
                    .map((item) => (
                      <li className="finance-record-item" key={item.key}>
                        <div>
                          <strong>{item.label}</strong>
                        </div>
                        <strong style={{ color: item.color }}>
                          {formatMinor(item.amountMinor, currency)}
                        </strong>
                      </li>
                    ))}
                </ul>
              ) : (
                <Empty
                  title="No activity by type"
                  description="Posted activity by type will appear here."
                />
              )}
              <p className="finance-form-note">
                Split expenses are shown separately by type and included in total spending.
              </p>
            </Card>
            <div className="finance-dashboard-grid">
              <Card className="finance-accounts-panel">
                <SectionHeader
                  title="Spending by category"
                  action={<span>{result.categoryBreakdown.length} categories</span>}
                />
                {result.categoryBreakdown.length === 0 ? (
                  <Empty
                    title="No expenses to break down"
                    description="Posted expenses with a matching currency will appear here."
                  />
                ) : (
                  <ul className="finance-record-list" aria-label="Spending totals by category">
                    {result.categoryBreakdown.slice(0, 8).map((item) => (
                      <li className="finance-record-item" key={item.id}>
                        <Link
                          href={breakdownHref('category', item.id)}
                          style={{
                            display: 'flex',
                            minWidth: 0,
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 14,
                            color: 'inherit',
                            textDecoration: 'none',
                          }}
                        >
                          <span className="finance-record-symbol" aria-hidden="true">
                            {categoryIcons.get(item.id) ?? <Tags size={17} />}
                          </span>
                          <div>
                            <strong>{item.label}</strong>
                            <small>{spendingShare(item.amountMinor)}% of spending</small>
                          </div>
                          <strong>
                            {formatMinor(item.amountMinor, currency)} <ArrowRight size={14} />
                          </strong>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="finance-accounts-panel">
                <SectionHeader
                  title="By account"
                  action={<span>{result.accountBreakdown.length} accounts</span>}
                />
                {result.accountBreakdown.length === 0 ? (
                  <Empty
                    title="No account breakdown yet"
                    description="Account-level expense totals appear with posted local activity."
                  />
                ) : (
                  <ul className="finance-record-list" aria-label="Spending totals by account">
                    {result.accountBreakdown.slice(0, 8).map((item) => (
                      <li className="finance-record-item" key={item.id}>
                        <Link
                          href={breakdownHref('account', item.id)}
                          style={{
                            display: 'flex',
                            minWidth: 0,
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 14,
                            color: 'inherit',
                            textDecoration: 'none',
                          }}
                        >
                          <div>
                            <strong>{item.label}</strong>
                            <small>{spendingShare(item.amountMinor)}% of spending</small>
                          </div>
                          <strong>
                            {formatMinor(item.amountMinor, currency)} <ArrowRight size={14} />
                          </strong>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            <Card className="finance-accounts-panel">
              <SectionHeader
                title="By merchant"
                action={<span>{result.merchantBreakdown.length} merchants</span>}
              />
              {result.merchantBreakdown.length === 0 ? (
                <Empty
                  title="No merchant breakdown yet"
                  description="Merchant totals appear with posted expense activity."
                />
              ) : (
                <ul className="finance-record-list" aria-label="Spending totals by merchant">
                  {result.merchantBreakdown.slice(0, 8).map((item) => (
                    <li className="finance-record-item" key={item.id}>
                      <Link
                        href={breakdownHref('merchant', item.id)}
                        style={{
                          display: 'flex',
                          minWidth: 0,
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 14,
                          color: 'inherit',
                          textDecoration: 'none',
                        }}
                      >
                        <div>
                          <strong>{item.label}</strong>
                          <small>{spendingShare(item.amountMinor)}% of spending</small>
                        </div>
                        <strong>
                          {formatMinor(item.amountMinor, currency)} <ArrowRight size={14} />
                        </strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="finance-record-panel">
              <SectionHeader title="Compared with last period" />
              <strong>{comparison}</strong>
              <p className="finance-muted">
                Previously spent {formatMinor(previous?.spentMinor ?? 0n, currency)}
              </p>
            </Card>
            <Card className="finance-record-panel">
              <SectionHeader title="Largest expenses" />
              {largestExpenses.length === 0 ? (
                <Empty
                  title="No expenses yet"
                  description="Your largest posted expenses in this period will appear here."
                />
              ) : (
                <ul className="finance-record-list">
                  {largestExpenses.map((record) => {
                    const id = idAliases(record)[0];
                    const content = (
                      <>
                        <span className="finance-record-copy">
                          <strong>{record.title || record.merchant || 'Expense'}</strong>
                          <small>
                            {record.occurredAt
                              ? new Date(record.occurredAt).toLocaleDateString()
                              : 'Date unavailable'}
                          </small>
                        </span>
                        <strong>{formatMinor(amountAsBigInt(record.amountMinor), currency)}</strong>
                      </>
                    );
                    return (
                      <li className="finance-record-item" key={id ?? record.occurredAt}>
                        {id ? (
                          <Link
                            href={`/transaction/${encodeURIComponent(id)}`}
                            style={{
                              display: 'flex',
                              minWidth: 0,
                              flex: 1,
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 14,
                              color: 'inherit',
                              textDecoration: 'none',
                            }}
                          >
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        )
      )}
    </div>
  );
}
