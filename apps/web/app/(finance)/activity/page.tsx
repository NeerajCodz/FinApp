'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button, Empty, IconButton, Input, Tabs, Typography } from '@finapp/ui/web';
import { DateSection, MetricPair, TransactionRow, type TransactionType } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import {
  filterActivity,
  type ActivityFilter,
  type ActivityKind,
  type ActivityRow,
} from '@convex/activity/domain';
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

type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  groupId?: string;
  title?: string;
  merchant?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};
type NamedRecord = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Profile = LocalRecord & { defaultCurrency?: string; timezone?: string };

const filters: ActivityFilter[] = ['All', 'Expenses', 'Income', 'Transfers', 'Groups'];
const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

function asMinor(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function analyticsEntities(records: NamedRecord[]) {
  return records.flatMap((record) => {
    const aliases = [...new Set([record.id, record._id, record.cloudId].filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    ))];
    const id = aliases[0];
    return id && typeof record.name === 'string'
      ? [{ id, name: record.name, aliases }]
      : [];
  });
}

export default function ActivityPage() {
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<NamedRecord>('account');
  const categoryState = useLocalRecords<NamedRecord>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('month');
  const [filter, setFilter] = React.useState<ActivityFilter>('All');
  const [query, setQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const [referenceAt, setReferenceAt] = React.useState<number | null>(null);
  React.useEffect(() => setReferenceAt(Date.now()), []);
  const profile = profileState.records[0];
  const timeZone = profile?.timezone ?? 'UTC';
  const currency = profile?.defaultCurrency ?? 'INR';
  const range = React.useMemo(
    () => getAnalyticsRange(period, referenceAt ?? 0, timeZone),
    [period, referenceAt, timeZone],
  );

  React.useEffect(() => {
    if (!userId || referenceAt === null) return;
    let active = true;
    setRangeLoading(true);
    setRangeError('');
    void fetchTransactionRange(range.startAt, Math.min(range.endAt, Date.now() + 1))
      .catch((cause: unknown) => {
        if (active)
          setRangeError(
            !isConnected
              ? 'Offline: showing transactions already saved in this browser.'
              : cause instanceof Error
                ? cause.message
                : 'Could not refresh this date range.',
          );
      })
      .finally(() => {
        if (active) setRangeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, range.endAt, range.startAt, referenceAt, userId]);

  const accountById = React.useMemo(() => {
    const map = new Map<string, NamedRecord>();
    for (const account of accountState.records) {
      for (const id of [account.id, account._id, account.cloudId])
        if (typeof id === 'string' && id.length > 0) map.set(id, account);
    }
    return map;
  }, [accountState.records]);
  const categoryById = React.useMemo(() => {
    const map = new Map<string, NamedRecord>();
    for (const category of categoryState.records) {
      for (const id of [category.id, category._id, category.cloudId])
        if (typeof id === 'string' && id.length > 0) map.set(id, category);
    }
    return map;
  }, [categoryState.records]);
  const rows = React.useMemo(() => {
    const records = new Map<string, Transaction>();
    const activity: ActivityRow[] = [];
    for (const record of transactionState.records) {
      const id = String(record.id ?? record._id ?? record.cloudId ?? '');
      const occurredAt = Number(record.occurredAt ?? 0);
      if (
        !id ||
        record.deletedAt !== undefined ||
        occurredAt < range.startAt ||
        occurredAt >= range.endAt ||
        !['expense', 'income', 'transfer', 'refund', 'adjustment'].includes(record.type ?? '')
      )
        continue;
      const kind: ActivityKind =
        record.groupId && record.type === 'expense' ? 'group' : (record.type as ActivityKind);
      const amountMinor = asMinor(record.amountMinor);
      records.set(id, record);
      activity.push({
        id,
        ownerId: userId ?? '',
        kind,
        occurredAt,
        ...(record.merchant ? { merchant: record.merchant } : {}),
        amountMinor,
      });
    }
    const needle = query.trim().toLocaleLowerCase();
    return filterActivity(activity, filter)
      .filter((row) => {
        if (!needle) return true;
        const record = records.get(row.id);
        if (!record) return false;
        const account = accountById.get(record.accountId ?? '');
        const category = categoryById.get(record.categoryId ?? '');
        return [
          record.title,
          record.merchant,
          account?.name,
          category?.name,
          record.amountMinor,
          formatMinor(row.amountMinor, record.currency ?? currency),
        ].some((value) =>
          String(value ?? '')
            .toLocaleLowerCase()
            .includes(needle),
        );
      })
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .map((row) => records.get(row.id)!);
  }, [
    accountById,
    categoryById,
    currency,
    filter,
    query,
    range.endAt,
    range.startAt,
    transactionState.records,
    userId,
  ]);
  const dateSections = React.useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const sections = new Map<string, Transaction[]>();
    for (const record of rows) {
      const date = formatter.format(Number(record.occurredAt ?? 0));
      const section = sections.get(date) ?? [];
      section.push(record);
      sections.set(date, section);
    }
    return [...sections];
  }, [rows, timeZone]);


  const error =
    transactionState.error ?? accountState.error ?? categoryState.error ?? profileState.error;
  const ready =
    referenceAt !== null &&
    !!profile &&
    !transactionState.loading &&
    !accountState.loading &&
    !categoryState.loading &&
    !profileState.loading;
  const totals = React.useMemo(() => {
    const analyticsTransactions = rows.flatMap((record): AnalyticsTransaction[] => {
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
    return aggregateAnalytics(
      analyticsTransactions,
      analyticsEntities(categoryState.records),
      currency,
      period,
      range.startAt,
      range.endAt,
      timeZone,
      analyticsEntities(accountState.records),
    );
  }, [
    accountState.records,
    categoryState.records,
    currency,
    period,
    range.endAt,
    range.startAt,
    rows,
    timeZone,
  ]);
  if (!userId)
    return (
      <FinanceSignedOut
        section="ACTIVITY"
        title="Activity unavailable"
        description="Sign in to see your ledger."
      />
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        {searching ? (
          <div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>
            <Input
              autoFocus
              accessibilityLabel="Search transactions"
              onChangeText={setQuery}
              placeholder="Title, merchant, category, amount…"
              value={query}
            />
            <IconButton
              label="Close search"
              variant="ghost"
              onPress={() => {
                setQuery('');
                setSearching(false);
              }}
            >
              <X size={20} aria-hidden="true" />
            </IconButton>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="title">Activity</Typography>
            <IconButton label="Search activity" variant="ghost" onPress={() => setSearching(true)}>
              <Search size={21} aria-hidden="true" />
            </IconButton>
          </div>
        )}
      </header>
      <Tabs
        label="Activity period"
        value={period}
        onChange={(value) => setPeriod(value as AnalyticsPeriod)}
        tabs={periods}
      />
      {ready && (
        <section style={{ display: 'grid', gap: 12 }}>
          <Typography variant="label">
            {period} · {currency}
          </Typography>
          <MetricPair
            left={{ label: 'Spent', value: formatMinor(totals.spentMinor, currency) }}
            right={{ label: 'Income', value: formatMinor(totals.incomeMinor, currency) }}
          />
          <Typography variant="caption">
            Totals include posted transactions in {currency} only.
          </Typography>
        </section>
      )}
      <div style={{ overflowX: 'auto' }}>
        <Tabs
          label="Activity type filter"
          value={filter}
          onChange={(value) => setFilter(value as ActivityFilter)}
          tabs={filters.map((value) => ({ label: value, value }))}
        />
      </div>

      {(rangeLoading || rangeError || error) && (
        <p className="finance-muted" role={error || rangeError ? 'alert' : 'status'}>
          {rangeLoading ? 'Refreshing activity… ' : ''}
          {rangeError || (error ? 'Some saved records could not be loaded.' : '')}
        </p>
      )}
      {error && (
        <Button variant="outline" onPress={() => window.location.reload()}>
          Retry
        </Button>
      )}
      {!profileState.loading && !profile ? (
        <FinanceSignedOut
          section="ACTIVITY"
          title="Activity unavailable"
          description="Sign in to see your ledger."
        />
      ) : !ready && !error ? (
        <Typography variant="heading">Loading activity…</Typography>
      ) : ready && dateSections.length === 0 && !rangeError ? (
        <Empty
          title={query ? 'No search matches' : 'No activity this period'}
          description={
            query
              ? 'Try a merchant, title, category, account, or amount.'
              : 'No transactions match this period and filter.'
          }
        />
      ) : ready && dateSections.length === 0 ? (
        <Typography variant="small">
          No matching saved rows. Refresh to confirm the full period.
        </Typography>
      ) : (
        ready &&
        dateSections.map(([date, records]) => (
          <DateSection key={date} title={date}>
            {records.map((transaction) => {
              const id = String(transaction.id ?? transaction._id ?? transaction.cloudId ?? '');
              const category = categoryById.get(transaction.categoryId ?? '');
              const account = accountById.get(transaction.accountId ?? '');
              const type = transaction.type as TransactionType;
              return (
                <TransactionRow
                  key={id}
                  title={transaction.title || transaction.merchant || 'Transaction'}
                  merchant={transaction.merchant}
                  category={category?.name}
                  categoryIcon={category?.icon}
                  account={account?.name}
                  date={
                    transaction.occurredAt
                      ? new Intl.DateTimeFormat('en-US', {
                          day: 'numeric',
                          month: 'short',
                          timeZone,
                        }).format(transaction.occurredAt)
                      : 'Saved offline'
                  }
                  status={transaction.status}
                  amountMinor={asMinor(transaction.amountMinor)}
                  currency={transaction.currency ?? currency}
                  type={type}
                  semanticType={transaction.groupId ? 'split' : undefined}
                  onPress={() => router.push(`/transaction/${encodeURIComponent(id)}`)}
                />
              );
            })}
          </DateSection>
        ))
      )}
      {rangeError && !isConnected && (
        <p className="finance-data-footnote">
          Offline mode shows matching records already downloaded to this browser.
        </p>
      )}
    </div>
  );
}
