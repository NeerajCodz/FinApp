'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Repeat2 } from 'lucide-react';
import { Badge, Button, Card, Empty, Input, SectionHeader } from '@finapp/ui/web';
import { filterActivity, type ActivityFilter, type ActivityKind, type ActivityRow } from '@convex/activity/domain';
import { getAnalyticsRange, type AnalyticsPeriod } from '@convex/analytics/domain';
import { formatMinor } from '@convex/shared/money';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
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
type NamedRecord = LocalRecord & { name?: string; archivedAt?: number };
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

export default function ActivityPage() {
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<NamedRecord>('account');
  const categoryState = useLocalRecords<NamedRecord>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('month');
  const [filter, setFilter] = React.useState<ActivityFilter>('All');
  const [query, setQuery] = React.useState('');
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
      const id = String(record.id ?? record._id ?? '');
      const occurredAt = Number(record.occurredAt ?? 0);
      if (
        !id ||
        record.deletedAt !== undefined ||
        (record.status !== undefined && record.status !== 'posted') ||
        occurredAt < range.startAt ||
        occurredAt >= range.endAt ||
        !['expense', 'income', 'transfer', 'refund', 'adjustment'].includes(record.type ?? '')
      )
        continue;
      const kind: ActivityKind = record.groupId && record.type === 'expense' ? 'group' : record.type as ActivityKind;
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
        ].some((value) => String(value ?? '').toLocaleLowerCase().includes(needle));
      })
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .map((row) => records.get(row.id)!);
  }, [accountById, categoryById, currency, filter, query, range.endAt, range.startAt, transactionState.records, userId]);

  if (!userId)
    return (
      <FinanceSignedOut
        section="ACTIVITY"
        title="Keep the details close."
        description="Sign in to open your activity. After your first sign-in, this browser keeps a local copy for offline access and syncs when connected."
      />
    );

  const error = transactionState.error ?? accountState.error ?? categoryState.error ?? profileState.error;
  const ready = referenceAt !== null && !transactionState.loading && !accountState.loading && !categoryState.loading && !profileState.loading;
  const spent = rows
    .filter((record) => record.type === 'expense')
    .reduce((sum, record) => sum + asMinor(record.amountMinor), 0n);
  const income = rows
    .filter((record) => record.type === 'income' || record.type === 'refund')
    .reduce((sum, record) => sum + asMinor(record.amountMinor), 0n);
  const currencyFormat = (amount: bigint, selectedCurrency: string) => {
    try {
      return formatMinor(amount, selectedCurrency);
    } catch {
      return `${selectedCurrency} ${amount}`;
    }
  };

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">EVERY MOVE, CLEARLY</p>
          <h1>Activity</h1>
          <p className="finance-muted">Search and filter transactions saved in your local ledger.</p>
        </div>
        <Badge variant={isConnected ? 'success' : 'neutral'}>{isConnected ? 'Online' : 'Offline'}</Badge>
      </header>

      <Card className="finance-record-panel" style={{ display: 'grid', gap: 16 }}>
        <label className="finance-form-field">
          <span>Search title, merchant, category, account, or amount</span>
          <Input
            aria-label="Search activity"
            onChangeText={setQuery}
            placeholder="Coffee, groceries, 25.00…"
            value={query}
          />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span className="finance-muted" style={{ marginRight: 4 }}>Period</span>
          {periods.map((option) => (
            <Button
              key={option.value}
              variant={period === option.value ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={period === option.value}
              onPress={() => setPeriod(option.value)}
            >
              {option.label}
            </Button>
          ))}
          <label className="finance-form-field" style={{ marginLeft: 'auto', minWidth: 180 }}>
            <span>Activity type</span>
            <select
              aria-label="Activity type filter"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value as ActivityFilter)}
            >
              {filters.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          <span className="finance-muted">Money out <strong>{currencyFormat(spent, currency)}</strong></span>
          <span className="finance-muted">Money in <strong>{currencyFormat(income, currency)}</strong></span>
          <span className="finance-muted">{rows.length} matching records</span>
        </div>
      </Card>

      {(rangeLoading || rangeError || error) && (
        <p className="finance-muted" role={error || rangeError ? 'alert' : 'status'}>
          {rangeLoading ? 'Refreshing this period… ' : ''}
          {rangeError || (error ? 'Some saved records could not be loaded.' : '')}
        </p>
      )}
      {error && <Button variant="outline" onPress={() => window.location.reload()}>Reload saved activity</Button>}
      {!ready ? (
        <p className="finance-muted" role="status">Opening your saved activity…</p>
      ) : rows.length === 0 ? (
        <Empty
          title={query ? 'No search matches' : 'No activity in this period'}
          description={query ? 'Try a different title, merchant, category, account, or amount.' : 'Transactions you add or sync will appear here.'}
          action={<Link className="finance-inline-link" href="/add">Add to your ledger</Link>}
        />
      ) : (
        <Card className="finance-record-panel">
          <SectionHeader title="Recent activity" action={<span>{rows.length} records</span>} />
          <ul className="finance-record-list" style={{ marginTop: 18 }}>
            {rows.map((transaction) => {
              const id = String(transaction.id ?? transaction._id ?? '');
              const isIncome = transaction.type === 'income' || transaction.type === 'refund';
              const isTransfer = transaction.type === 'transfer';
              const category = categoryById.get(transaction.categoryId ?? '');
              const account = accountById.get(transaction.accountId ?? '');
              const date = transaction.occurredAt
                ? new Date(transaction.occurredAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone })
                : 'Saved offline';
              return (
                <li key={id} style={{ listStyle: 'none' }}>
                  <Link
                    className="finance-record-item"
                    href={`/transaction/${encodeURIComponent(id)}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <div>
                      <strong>{transaction.title || transaction.merchant || 'Transaction'}</strong>
                      <small>
                        {date} · {transaction.type ?? 'expense'}
                        {category?.name ? ` · ${category.name}` : ''}
                        {account?.name ? ` · ${account.name}` : ''}
                        {transaction.groupId ? ' · Shared' : ''}
                      </small>
                    </div>
                    <strong className={isIncome ? 'finance-positive' : ''}>
                      {isTransfer ? '↔ ' : isIncome ? '+' : '−'}
                      {currencyFormat(asMinor(transaction.amountMinor), transaction.currency ?? currency)}
                    </strong>
                    <span aria-hidden="true">
                      {isTransfer ? <Repeat2 size={17} /> : isIncome ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {rangeError && !isConnected && <p className="finance-data-footnote">Offline mode shows matching records already downloaded to this browser.</p>}
    </div>
  );
}
