'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button, Card, Empty, Input, Tabs, Typography, useTheme } from '@finapp/ui/web';
import { DateSection, TransactionRow, type TransactionType } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { filterActivity, type ActivityFilter, type ActivityKind, type ActivityRow } from '@convex/activity/domain';
import { getAnalyticsDayRange, getAnalyticsRange, type AnalyticsPeriod } from '@convex/analytics/domain';
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
type Range = { startAt: number; endAt: number; label: string };
type ActivityPeriod = AnalyticsPeriod | 'all';

const filters: ActivityFilter[] = ['All', 'Expenses', 'Income', 'Transfers', 'Groups'];
const periods: { value: ActivityPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];
const fieldStyle: React.CSSProperties = {
  minHeight: 38,
  border: '1px solid var(--finapp-border-subtle)',
  borderRadius: 10,
  padding: '0 11px',
  color: 'inherit',
  background: 'var(--finapp-surface-raised)',
  font: 'inherit',
};

function asMinor(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function aliases(record: LocalRecord) {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

function entityMap<T extends NamedRecord>(records: T[]) {
  const map = new Map<string, T>();
  for (const record of records) for (const id of aliases(record)) map.set(id, record);
  return map;
}

function rangeFromDay(at: number, timeZone: string): Range {
  const bounds = getAnalyticsDayRange(at, timeZone);
  return { ...bounds, label: 'Today' };
}

function formatRange(range: Range, timeZone: string) {
  if (range.label) return range.label;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  });
  const first = formatter.format(range.startAt);
  const last = formatter.format(Math.max(range.startAt, range.endAt - 1));
  return first === last ? first : `${first} – ${last}`;
}

export default function ActivityPage() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<NamedRecord>('account');
  const categoryState = useLocalRecords<NamedRecord>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const [period, setPeriod] = React.useState<ActivityPeriod>('month');
  const [customRange, setCustomRange] = React.useState<Range | null>(null);
  const [filter, setFilter] = React.useState<ActivityFilter>('All');
  const [query, setQuery] = React.useState('');
  const [accountFilter, setAccountFilter] = React.useState('all');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [referenceAt, setReferenceAt] = React.useState<number | null>(null);
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  React.useEffect(() => {
    setReferenceAt(Date.now());
    const params = new URLSearchParams(window.location.search);
    const startAt = Number(params.get('startAt'));
    const endAt = Number(params.get('endAt'));
    if (Number.isFinite(startAt) && Number.isFinite(endAt) && startAt >= 0 && endAt > startAt)
      setCustomRange({ startAt, endAt, label: '' });
  }, []);

  const profile = profileState.records[0];
  const timeZone = profile?.timezone ?? 'UTC';
  const currency = profile?.defaultCurrency ?? 'INR';
  const range = React.useMemo<Range | null>(() => {
    if (customRange) return customRange;
    if (referenceAt === null) return null;
    if (period === 'all') return { startAt: 0, endAt: referenceAt + 1, label: 'All time' };
    const selected = getAnalyticsRange(period, referenceAt, timeZone);
    return { startAt: selected.startAt, endAt: selected.endAt, label: '' };
  }, [customRange, period, referenceAt, timeZone]);

  React.useEffect(() => {
    if (!userId || !range) return;
    const endAt = Math.min(range.endAt, Date.now() + 1);
    if (range.startAt >= endAt) {
      setRangeLoading(false);
      setRangeError('');
      return;
    }
    let active = true;
    setRangeLoading(true);
    setRangeError('');
    void fetchTransactionRange(range.startAt, endAt)
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
  }, [fetchTransactionRange, isConnected, range, userId]);

  const accountById = React.useMemo(() => entityMap(accountState.records), [accountState.records]);
  const categoryById = React.useMemo(() => entityMap(categoryState.records), [categoryState.records]);
  const rows = React.useMemo(() => {
    if (!range) return [];
    const records = new Map<string, Transaction>();
    const activity: ActivityRow[] = [];
    for (const record of transactionState.records) {
      const id = String(record.id ?? record._id ?? record.cloudId ?? '');
      const occurredAt = Number(record.occurredAt ?? 0);
      if (
        !id ||
        record.deletedAt !== undefined ||
        occurredAt < range.startAt ||
        occurredAt >= Math.min(range.endAt, (referenceAt ?? Date.now()) + 1) ||
        !['expense', 'income', 'transfer', 'refund', 'adjustment'].includes(record.type ?? '')
      ) continue;
      const account = accountById.get(accountFilter);
      if (accountFilter !== 'all' && !(account ? aliases(account) : [accountFilter]).includes(String(record.accountId ?? ''))) continue;
      const category = categoryById.get(categoryFilter);
      if (categoryFilter !== 'all' && !(category ? aliases(category) : [categoryFilter]).includes(String(record.categoryId ?? ''))) continue;
      const kind: ActivityKind = record.groupId && record.type === 'expense' ? 'group' : (record.type as ActivityKind);
      const amountMinor = asMinor(record.amountMinor);
      records.set(id, record);
      activity.push({ id, ownerId: userId ?? '', kind, occurredAt, ...(record.merchant ? { merchant: record.merchant } : {}), amountMinor });
    }
    const needle = query.trim().toLocaleLowerCase();
    return filterActivity(activity, filter)
      .filter((row) => {
        if (!needle) return true;
        const record = records.get(row.id);
        if (!record) return false;
        const account = accountById.get(record.accountId ?? '');
        const category = categoryById.get(record.categoryId ?? '');
        return [record.title, record.merchant, account?.name, category?.name, record.amountMinor,
          formatMinor(row.amountMinor, record.currency ?? currency)]
          .some((value) => String(value ?? '').toLocaleLowerCase().includes(needle));
      })
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .map((row) => records.get(row.id)!)
      .filter((record) => (record.currency ?? currency) === currency);
  }, [accountById, accountFilter, categoryById, categoryFilter, currency, filter, query, range, referenceAt, transactionState.records, userId]);

  const dateSections = React.useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const sections = new Map<string, Transaction[]>();
    for (const record of rows) {
      const label = formatter.format(Number(record.occurredAt ?? 0));
      const section = sections.get(label) ?? [];
      section.push(record);
      sections.set(label, section);
    }
    return [...sections];
  }, [rows, timeZone]);

  const totals = React.useMemo(
    () => rows.reduce<{ income: bigint; expenses: bigint; transfers: bigint; count: number }>(
      (sum, record) => {
        if (record.status === 'pending' || record.status === 'voided') return sum;
        const amount = asMinor(record.amountMinor);
        if (record.type === 'income') sum.income += amount;
        if (record.type === 'expense') sum.expenses += amount;
        if (record.type === 'transfer') sum.transfers += amount;
        sum.count += 1;
        return sum;
      },
      { income: 0n, expenses: 0n, transfers: 0n, count: 0 },
    ),
    [rows],
  );

  const topCategories = React.useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const row of rows) {
      if (row.type !== 'expense' || row.status === 'pending' || row.status === 'voided') continue;
      const id = String(row.categoryId ?? '__uncategorized__');
      totals.set(id, (totals.get(id) ?? 0n) + asMinor(row.amountMinor));
    }
    return [...totals].map(([id, amount]) => ({ id, amount, category: categoryById.get(id) }))
      .sort((a, b) => a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1).slice(0, 5);
  }, [categoryById, rows]);
  const categoryTotal = rows.reduce(
    (sum, row) => row.type === 'expense' && row.status !== 'pending' && row.status !== 'voided' ? sum + asMinor(row.amountMinor) : sum,
    0n,
  );
  const allError = transactionState.error ?? accountState.error ?? categoryState.error ?? profileState.error;
  const ready = referenceAt !== null && !!profile && !transactionState.loading && !accountState.loading && !categoryState.loading && !profileState.loading;

  const selectRange = (nextPeriod: ActivityPeriod) => {
    setPeriod(nextPeriod);
    setCustomRange(null);
  };
  const setQuickRange = (name: 'Today' | 'This week' | 'This month' | 'Last month' | 'All time') => {
    if (referenceAt === null) return;
    if (name === 'Today') {
      setCustomRange(rangeFromDay(referenceAt, timeZone));
      return;
    }
    if (name === 'All time') {
      setPeriod('all');
      setCustomRange(null);
      return;
    }
    if (name === 'This week') {
      setPeriod('week');
      setCustomRange(null);
      return;
    }
    const monthRange = getAnalyticsRange('month', referenceAt, timeZone);
    if (name === 'This month') {
      setPeriod('month');
      setCustomRange(null);
    } else {
      setPeriod('month');
      setCustomRange({ startAt: monthRange.previousStartAt, endAt: monthRange.startAt, label: 'Last month' });
    }
  };

  if (!userId) return <FinanceSignedOut section="ACTIVITY" title="Activity unavailable" description="Sign in to see your ledger." />;
  if (!profileState.loading && !profile) return <FinanceSignedOut section="ACTIVITY" title="Activity unavailable" description="Your local profile could not be found." />;

  return (
    <div className="finance-page" style={{ display: 'grid', gap: 16, paddingBottom: 88 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 180 }}>
          <Typography variant="title">Activity</Typography>
          <Typography variant="caption">Your money, in motion · {currency}</Typography>
        </div>
        <div style={{ display: 'flex', flex: '1 1 360px', justifyContent: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', flex: '1 1 240px', maxWidth: 430, alignItems: 'center', gap: 8, padding: '0 12px', border: `1px solid ${tokens.borderSubtle}`, borderRadius: 11 }}>
            <Search size={17} aria-hidden="true" color={tokens.foregroundMuted} />
            <Input accessibilityLabel="Search transactions" onChangeText={setQuery} placeholder="Search transactions" value={query} />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}><X size={15} /></button>}
          </div>
          <Link className="finance-primary-link" href="/transaction/new">Add transaction</Link>
        </div>
      </header>

      <Card style={{ display: 'grid', gap: 12, padding: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Tabs label="Activity period" value={period} onChange={(value) => selectRange(value as ActivityPeriod)} tabs={periods} />
          <Typography variant="caption">{range ? formatRange(range, timeZone) : 'Loading range'} · {currency}</Typography>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8 }}>
          <label style={{ display: 'grid', gap: 5 }}><Typography variant="caption">Account</Typography><select aria-label="Filter by account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} style={fieldStyle}><option value="all">All accounts</option>{accountState.records.filter((item) => !item.archivedAt).map((item) => <option key={aliases(item)[0]} value={aliases(item)[0]}>{item.name ?? 'Account'}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><Typography variant="caption">Category</Typography><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={fieldStyle}><option value="all">All categories</option>{categoryState.records.filter((item) => !item.archivedAt).map((item) => <option key={aliases(item)[0]} value={aliases(item)[0]}>{item.name ?? 'Category'}</option>)}</select></label>
          <div style={{ display: 'grid', alignContent: 'end' }}><Typography variant="caption">LOCAL RECORDS · POSTED TOTALS</Typography></div>
        </div>
        <div style={{ overflowX: 'auto' }}><Tabs label="Activity type filter" value={filter} onChange={(value) => setFilter(value as ActivityFilter)} tabs={filters.map((value) => ({ label: value, value }))} /></div>
      </Card>

      {(rangeLoading || rangeError || allError) && <div role={rangeError || allError ? 'alert' : 'status'} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}><Typography variant="caption">{rangeLoading ? 'Refreshing activity… ' : ''}{rangeError || (allError ? 'Some saved records could not be loaded.' : '')}</Typography>{(allError || rangeError) && <Button variant="outline" onPress={() => window.location.reload()}>Retry</Button>}</div>}
      {rangeError && !isConnected && <Typography variant="caption">Offline mode shows matching records already downloaded to this browser.</Typography>}

      {ready && <section aria-label="Activity summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
        {[
          { label: 'Income', value: formatMinor(totals.income, currency), color: tokens.income },
          { label: 'Expenses', value: formatMinor(totals.expenses, currency), color: tokens.expense },
          { label: 'Transfers', value: formatMinor(totals.transfers, currency), color: tokens.transfer },
          { label: 'Transactions', value: String(totals.count), color: tokens.foreground },
        ].map((metric) => <Card key={metric.label} variant="subtle" style={{ display: 'grid', gap: 8, padding: '14px 16px', border: `1px solid ${tokens.borderSubtle}` }}><Typography variant="caption">{metric.label}</Typography><Typography variant="heading" style={{ color: metric.color, fontVariantNumeric: 'tabular-nums' }}>{metric.value}</Typography></Card>)}
      </section>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 14, alignItems: 'start' }}>
        <Card style={{ minWidth: 0, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}><Typography variant="bodyLarge">Transactions</Typography><Typography variant="caption">{rows.length} records</Typography></div>
          {!ready && !allError ? <Typography variant="small">Loading activity…</Typography> : ready && dateSections.length === 0 ? <Empty title={query ? 'No search matches' : 'No activity in this period'} description={query ? 'Try another merchant, title, category, account, or amount.' : 'Transactions matching this date range and filters will appear here.'} /> : dateSections.map(([date, records]) => <DateSection key={date} title={date}>{records.map((transaction) => {
            const id = String(transaction.id ?? transaction._id ?? transaction.cloudId ?? '');
            const category = categoryById.get(transaction.categoryId ?? '');
            const account = accountById.get(transaction.accountId ?? '');
            return <TransactionRow key={id} title={transaction.title || transaction.merchant || 'Transaction'} merchant={transaction.merchant} category={category?.name} categoryIcon={category?.icon} account={account?.name} date={transaction.occurredAt ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone }).format(transaction.occurredAt) : 'Saved offline'} status={transaction.status} amountMinor={asMinor(transaction.amountMinor)} currency={transaction.currency ?? currency} type={(transaction.type ?? 'expense') as TransactionType} semanticType={transaction.groupId ? 'split' : undefined} onPress={() => router.push(`/transaction/${encodeURIComponent(id)}`)} />;
          })}</DateSection>)}
        </Card>

        <aside style={{ display: 'grid', gap: 14 }}>
          <Card style={{ display: 'grid', gap: 11, padding: 16 }}>
            <div><Typography variant="bodyLarge">Quick filters</Typography><Typography variant="caption">Jump to a familiar date range</Typography></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
              {(['Today', 'This week', 'This month', 'Last month', 'All time'] as const).map((label) => <Button key={label} size="sm" variant="outline" onPress={() => setQuickRange(label)}>{label}</Button>)}
            </div>
            <Link className="finance-inline-link" href="/analytics">Explore analytics</Link>
          </Card>
          <Card style={{ display: 'grid', gap: 12, padding: 16 }}>
            <div><Typography variant="bodyLarge">Top categories</Typography><Typography variant="caption">Posted expenses · {range ? formatRange(range, timeZone) : 'Loading range'}</Typography></div>
            {topCategories.length ? topCategories.map(({ id, amount, category }, index) => {
              const share = categoryTotal > 0n ? Number((amount * 100n) / categoryTotal) : 0;
              const icon = typeof category?.icon === 'string' ? category.icon : '•';
              return <Link key={id} href={category ? `/category/${encodeURIComponent(id)}` : '/analytics'} style={{ display: 'grid', gap: 5, color: 'inherit', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true">{icon}</span><Typography variant="small" style={{ flex: 1 }}>{category?.name ?? (id === '__uncategorized__' ? 'Uncategorized' : 'Category')}</Typography><Typography variant="small">{formatMinor(amount, currency)}</Typography></div>
                <div style={{ height: 4, overflow: 'hidden', borderRadius: 8, background: tokens.borderSubtle }}><div style={{ width: `${share}%`, height: '100%', borderRadius: 8, background: index === 0 ? tokens.primary : tokens.foregroundMuted }} /></div>
              </Link>;
            }) : <Typography variant="caption">No posted expenses in this range.</Typography>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
