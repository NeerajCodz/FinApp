'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, Empty, IconButton, Text, Typography } from '@finapp/ui/web';
import {
  CategoryIcon,
  FinanceEmptyState,
  TransactionRow,
  formatTransactionDate,
} from '@finapp/ui/finance';
import {
  aggregateAnalytics,
  getAnalyticsRange,
  UNCATEGORIZED_ID,
  UNASSIGNED_ACCOUNT_ID,
  UNSPECIFIED_MERCHANT,
  validateAnalyticsRange,
  type AnalyticsPeriod,
  type AnalyticsTransaction,
} from '@convex/analytics/domain';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, asMinor, belongsToUser, idOf, SignInGate } from '../../../_personal';

type Profile = LocalRecord & { defaultCurrency?: string; timezone?: string };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Account = LocalRecord & { name?: string; archivedAt?: number };
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
type Query = { key: string; period: string; startAt: string; endAt: string };

export default function AnalyticsBreakdownPage() {
  const router = useRouter();
  const params = useParams<{ dimension: string }>();
  const dimension = Array.isArray(params.dimension) ? params.dimension[0] : params.dimension;
  const { userId, fetchTransactionRange, isConnected } = useBrowserSync();
  const {
    records: profileRecords,
    loading: profileLoading,
    error: profileError,
  } = useLocalRecords<Profile>('profile');
  const {
    records: categoryRecords,
    loading: categoryLoading,
    error: categoryError,
  } = useLocalRecords<Category>('category');
  const {
    records: accountRecords,
    loading: accountLoading,
    error: accountError,
  } = useLocalRecords<Account>('account');
  const {
    records: transactionRecords,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const [query, setQuery] = React.useState<Query | null>(null);
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const [serverRangeLoaded, setServerRangeLoaded] = React.useState(false);
  React.useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setQuery({
      key: search.get('key') ?? '',
      period: search.get('period') ?? '',
      startAt: search.get('startAt') ?? '',
      endAt: search.get('endAt') ?? '',
    });
  }, []);
  const profile = profileRecords[0];
  const timeZone = profile?.timezone ?? 'UTC';
  const currency = profile?.defaultCurrency ?? 'INR';
  const startAt = query && /^\d+$/.test(query.startAt) ? Number(query.startAt) : NaN;
  const endAt = query && /^\d+$/.test(query.endAt) ? Number(query.endAt) : NaN;
  let valid =
    !!query?.key &&
    (dimension === 'category' || dimension === 'account' || dimension === 'merchant') &&
    (query.period === 'week' || query.period === 'month' || query.period === 'year') &&
    Number.isSafeInteger(startAt) &&
    Number.isSafeInteger(endAt);
  if (valid && query) {
    try {
      validateAnalyticsRange(query.period as AnalyticsPeriod, startAt, endAt);
      const canonical = getAnalyticsRange(query.period as AnalyticsPeriod, startAt + 1, timeZone);
      valid = canonical.startAt === startAt && canonical.endAt === endAt;
    } catch {
      valid = false;
    }
  }
  React.useEffect(() => {
    if (!userId || !valid || !isConnected) return;
    let live = true;
    setRangeLoading(true);
    setRangeError('');
    setServerRangeLoaded(false);
    void fetchTransactionRange(startAt, endAt)
      .then(() => {
        if (live) setServerRangeLoaded(true);
      })
      .catch((cause: unknown) => {
        if (live)
          setRangeError(
            !isConnected
              ? 'Offline: only transactions already cached in this browser are included.'
              : cause instanceof Error
                ? cause.message
                : 'Could not load this date range.',
          );
      })
      .finally(() => {
        if (live) setRangeLoading(false);
      });
    return () => {
      live = false;
    };
  }, [endAt, fetchTransactionRange, isConnected, startAt, userId, valid]);
  const categories = categoryRecords.filter((item) => userId && belongsToUser(item, userId));
  const accounts = accountRecords.filter((item) => userId && belongsToUser(item, userId));
  const excludedAccounts = new Set(
    accounts.filter((account) => account.includeInAnalytics === false).flatMap(aliasesOf),
  );
  const transactions = transactionRecords.filter(
    (item) =>
      userId && belongsToUser(item, userId) && !excludedAccounts.has(String(item.accountId ?? '')),
  );
  const categoryIcon =
    dimension === 'category'
      ? categories.find((item) => query?.key && aliasesOf(item).includes(query.key))?.icon
      : undefined;
  const categoryEntities = categories.map((item) => ({
    id: idOf(item),
    name: item.name ?? 'Category',
    aliases: aliasesOf(item),
  }));
  const accountEntities = accounts.map((item) => ({
    id: idOf(item),
    name: item.name ?? 'Account',
    aliases: aliasesOf(item),
  }));
  const analyticsTransactions: AnalyticsTransaction[] = transactions.flatMap((record) => {
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
        amountMinor: asMinor(record.amountMinor),
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
  });
  const result = React.useMemo(() => {
    if (!valid || !query || !Number.isFinite(startAt) || !Number.isFinite(endAt)) return null;
    const summary = aggregateAnalytics(
      analyticsTransactions,
      categoryEntities,
      currency,
      query.period as AnalyticsPeriod,
      startAt,
      endAt,
      timeZone,
      accountEntities,
    );
    const items =
      dimension === 'category'
        ? summary.categoryBreakdown
        : dimension === 'account'
          ? summary.accountBreakdown
          : summary.merchantBreakdown;
    const item = items.find((entry) => entry.id === query.key);
    const rows = transactions
      .filter((transaction) => {
        if (
          transaction.type !== 'expense' ||
          (transaction.status !== undefined && transaction.status !== 'posted') ||
          transaction.deletedAt !== undefined ||
          transaction.currency !== currency ||
          Number(transaction.occurredAt ?? 0) < startAt ||
          Number(transaction.occurredAt ?? 0) >= endAt
        )
          return false;
        const category = categories.find((record) =>
          aliasesOf(record).includes(String(transaction.categoryId ?? '')),
        );
        const account = accounts.find((record) =>
          aliasesOf(record).includes(String(transaction.accountId ?? '')),
        );
        const value =
          dimension === 'category'
            ? category
              ? idOf(category)
              : UNCATEGORIZED_ID
            : dimension === 'account'
              ? account
                ? idOf(account)
                : UNASSIGNED_ACCOUNT_ID
              : transaction.merchant?.trim() || UNSPECIFIED_MERCHANT;
        return value === query.key;
      })
      .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
    return { item, rows, spentMinor: summary.spentMinor };
  }, [
    accountEntities,
    accounts,
    analyticsTransactions,
    categories,
    categoryEntities,
    currency,
    dimension,
    endAt,
    query,
    startAt,
    timeZone,
    transactions,
    valid,
  ]);
  const dataError = profileError ?? categoryError ?? accountError ?? transactionError;
  const loading =
    query === null || profileLoading || categoryLoading || accountLoading || transactionLoading;
  const sharePercent =
    result?.item && result.spentMinor > 0n
      ? Number((result.item.amountMinor * 1000n) / result.spentMinor) / 10
      : 0;

  if (!userId)
    return (
      <SignInGate eyebrow="ANALYTICS BREAKDOWN" title="Your spending stays private.">
        Sign in to inspect a breakdown from finance data saved in this browser.
      </SignInGate>
    );

  const dimensionTitle =
    dimension === 'category' ? 'Category' : dimension === 'account' ? 'Account' : 'Merchant';
  const unavailable =
    !valid ||
    (!profileLoading && !profile) ||
    (result && !result.item && !rangeLoading && !rangeError);

  return (
    <div className="finance-page" style={{ gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title">{dimensionTitle}</Typography>
      </header>

      {unavailable ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <Empty
            title="Breakdown unavailable"
            description="This selection or date range is no longer available."
          />
          <Button onPress={() => router.replace('/analytics')}>Back to analytics</Button>
        </div>
      ) : dataError ? (
        <div role="alert" style={{ display: 'grid', gap: 12 }}>
          <Text>Analytics data could not be opened: {dataError}</Text>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
          <Button variant="outline" onPress={() => router.replace('/analytics')}>
            Back to analytics
          </Button>
        </div>
      ) : (
        <>
          {rangeError && (
            <div role="alert" style={{ display: 'grid', gap: 10 }}>
              <Text>
                {result?.item
                  ? 'Showing saved data. Refresh failed; share may be incomplete.'
                  : 'Breakdown data is unavailable.'}
              </Text>
              <Button variant="outline" onPress={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}
          {rangeLoading && <Typography variant="caption">Refreshing transactions…</Typography>}
          {loading ? (
            <Typography variant="heading">Loading breakdown…</Typography>
          ) : result?.item ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {dimension === 'category' && (
                  <CategoryIcon
                    label={result.item.label}
                    icon={typeof categoryIcon === 'string' ? categoryIcon : undefined}
                  />
                )}
                <Typography variant="heading" style={{ flex: 1 }}>
                  {result.item.label}
                </Typography>
              </div>
              <Typography variant="heading">
                {formatMinor(result.item.amountMinor, currency)}
              </Typography>
              <Typography variant="caption">
                {sharePercent}% of spending · {query?.period}
              </Typography>
              {result.rows.length === 0 ? (
                <FinanceEmptyState
                  kind="transaction"
                  compact
                  title="No matching transactions"
                  description={
                    serverRangeLoaded
                      ? 'No posted expenses match this breakdown.'
                      : 'No matching saved rows. Refresh to confirm the full period.'
                  }
                />
              ) : (
                result.rows.map((record) => {
                  const id = idOf(record);
                  const category = categories.find((item) =>
                    aliasesOf(item).includes(String(record.categoryId ?? '')),
                  );
                  const account = accounts.find((item) =>
                    aliasesOf(item).includes(String(record.accountId ?? '')),
                  );
                  return (
                    <TransactionRow
                      key={id}
                      title={record.title ?? record.merchant ?? 'Expense'}
                      merchant={record.merchant}
                      category={category?.name}
                      categoryIcon={category?.icon}
                      account={account?.name}
                      date={
                        typeof record.occurredAt === 'number'
                          ? formatTransactionDate(
                              record.occurredAt,
                              record.hasTime === true,
                              timeZone,
                            )
                          : undefined
                      }
                      status={record.status}
                      amountMinor={asMinor(record.amountMinor)}
                      currency={currency}
                      type="expense"
                      semanticType={typeof record.groupId === 'string' ? 'split' : undefined}
                      onPress={() => router.push(`/transaction/${encodeURIComponent(id)}`)}
                    />
                  );
                })
              )}
            </>
          ) : rangeError ? (
            <Empty
              title="Breakdown unavailable"
              description="The selected transactions could not be loaded."
              action={
                <Button onPress={() => router.replace('/analytics')}>Back to analytics</Button>
              }
            />
          ) : (
            <Typography variant="heading">Loading breakdown…</Typography>
          )}
        </>
      )}
    </div>
  );
}
