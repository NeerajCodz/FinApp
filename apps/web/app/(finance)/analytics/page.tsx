'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ChartNoAxesCombined } from 'lucide-react';
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
type Category = LocalRecord & { name?: string };
type Account = LocalRecord & { name?: string };
type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  accountId?: string;
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
    () => (range ? { startAt: range.startAt, endAt: Math.min(range.endAt, Date.now() + 1) } : null),
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
      categories
        .filter((category) => category.archivedAt === undefined)
        .map((category) => ({
          id: String(category.id ?? category._id ?? ''),
          name: String(category.name ?? 'Category'),
          aliases: idAliases(category),
        })),
    [categories],
  );
  const accountEntities = React.useMemo(
    () =>
      accounts
        .filter((account) => account.archivedAt === undefined)
        .map((account) => ({
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
            currency: String(record.currency ?? ''),
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
    [transactions],
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
              transaction.currency === currency,
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
            {option === 'week' ? 'This week' : option === 'month' ? 'This month' : 'This year'}
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
            <div className="finance-dashboard-grid">
              <Card className="finance-metric-card finance-balance-card">
                <span className="finance-metric-label">MONEY IN · {currency}</span>
                <strong>{formatMinor(result.incomeMinor, currency)}</strong>
                <span className="finance-metric-foot">Posted income this {period}</span>
              </Card>
              <Card className="finance-metric-card">
                <span className="finance-metric-label">MONEY OUT · {currency}</span>
                <strong>{formatMinor(result.spentMinor, currency)}</strong>
                <span className="finance-metric-foot">Posted expenses this {period}</span>
              </Card>
            </div>
            <Card className="finance-chart-panel">
              <SectionHeader
                title="Cash flow by period"
                action={<span>{rangeTransactions.length} posted entries</span>}
              />
              {result.buckets.every(
                (bucket) => bucket.amountMinor === 0n && bucket.incomeMinor === 0n,
              ) ? (
                <Empty
                  title="No posted activity in this period"
                  description="Once expenses or income are saved locally, the timeline will appear here."
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
                        <div>
                          <strong>{item.label}</strong>
                          <small>Expense total</small>
                        </div>
                        <strong>{formatMinor(item.amountMinor, currency)}</strong>
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
                        <div>
                          <strong>{item.label}</strong>
                          <small>Expense total</small>
                        </div>
                        <strong>{formatMinor(item.amountMinor, currency)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}
