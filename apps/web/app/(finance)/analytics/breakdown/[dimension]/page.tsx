'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChartNoAxesCombined } from 'lucide-react';
import { Badge, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { aggregateAnalytics, getAnalyticsRange, UNCATEGORIZED_ID, UNASSIGNED_ACCOUNT_ID, UNSPECIFIED_MERCHANT, validateAnalyticsRange, type AnalyticsPeriod, type AnalyticsTransaction } from '@convex/analytics/domain';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, asMinor, belongsToUser, idOf, PageHeading, SignInGate } from '../../../_personal';

type Profile = LocalRecord & { defaultCurrency?: string; timezone?: string };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Account = LocalRecord & { name?: string; archivedAt?: number };
type Transaction = LocalRecord & { type?: string; amountMinor?: bigint | number | string; currency?: string; categoryId?: string; accountId?: string; merchant?: string; title?: string; occurredAt?: number; status?: string; deletedAt?: number };
type Query = { key: string; period: string; startAt: string; endAt: string };

export default function AnalyticsBreakdownPage() {
  const params = useParams<{ dimension: string }>();
  const dimension = Array.isArray(params.dimension) ? params.dimension[0] : params.dimension;
  const { userId, fetchTransactionRange, isConnected } = useBrowserSync();
  const { records: profileRecords, loading: profileLoading, error: profileError } = useLocalRecords<Profile>('profile');
  const { records: categoryRecords, loading: categoryLoading, error: categoryError } = useLocalRecords<Category>('category');
  const { records: accountRecords, loading: accountLoading, error: accountError } = useLocalRecords<Account>('account');
  const { records: transactionRecords, loading: transactionLoading, error: transactionError } = useLocalRecords<Transaction>('transaction');
  const [query, setQuery] = React.useState<Query | null>(null);
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const [serverRangeLoaded, setServerRangeLoaded] = React.useState(false);
  React.useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setQuery({ key: search.get('key') ?? '', period: search.get('period') ?? '', startAt: search.get('startAt') ?? '', endAt: search.get('endAt') ?? '' });
  }, []);
  const profile = profileRecords[0];
  const timeZone = profile?.timezone ?? 'UTC';
  const currency = profile?.defaultCurrency ?? 'INR';
  const startAt = query && /^\d+$/.test(query.startAt) ? Number(query.startAt) : NaN;
  const endAt = query && /^\d+$/.test(query.endAt) ? Number(query.endAt) : NaN;
  let valid = !!query?.key && (dimension === 'category' || dimension === 'account' || dimension === 'merchant') && (query.period === 'week' || query.period === 'month' || query.period === 'year') && Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt);
  if (valid && query) {
    try {
      validateAnalyticsRange(query.period as AnalyticsPeriod, startAt, endAt);
      const canonical = getAnalyticsRange(query.period as AnalyticsPeriod, startAt + 1, timeZone);
      valid = canonical.startAt === startAt && canonical.endAt === endAt;
    } catch { valid = false; }
  }
  React.useEffect(() => {
    if (!userId || !valid || !isConnected) return;
    let live = true;
    setRangeLoading(true); setRangeError(''); setServerRangeLoaded(false);
    void fetchTransactionRange(startAt, endAt).then(() => { if (live) setServerRangeLoaded(true); }).catch((cause: unknown) => { if (live) setRangeError(!isConnected ? 'Offline: only transactions already cached in this browser are included.' : cause instanceof Error ? cause.message : 'Could not load this date range.'); }).finally(() => { if (live) setRangeLoading(false); });
    return () => { live = false; };
  }, [endAt, fetchTransactionRange, isConnected, startAt, userId, valid]);
  const categories = categoryRecords.filter((item) => userId && belongsToUser(item, userId));
  const accounts = accountRecords.filter((item) => userId && belongsToUser(item, userId));
  const transactions = transactionRecords.filter((item) => userId && belongsToUser(item, userId));
  const categoryEntities = categories.map((item) => ({ id: idOf(item), name: item.name ?? 'Category', aliases: aliasesOf(item) }));
  const accountEntities = accounts.map((item) => ({ id: idOf(item), name: item.name ?? 'Account', aliases: aliasesOf(item) }));
  const analyticsTransactions: AnalyticsTransaction[] = transactions.flatMap((record) => {
    const type = record.type;
    if (type !== 'expense' && type !== 'income' && type !== 'transfer' && type !== 'refund' && type !== 'adjustment') return [];
    return [{ type, amountMinor: asMinor(record.amountMinor), currency: String(record.currency ?? ''), ...(typeof record.categoryId === 'string' ? { categoryId: record.categoryId } : {}), ...(typeof record.accountId === 'string' ? { accountId: record.accountId } : {}), ...(typeof record.merchant === 'string' ? { merchant: record.merchant } : {}), ...(typeof record.title === 'string' ? { title: record.title } : {}), occurredAt: typeof record.occurredAt === 'number' ? record.occurredAt : 0, status: record.status === 'pending' || record.status === 'voided' ? record.status : 'posted', ...(typeof record.deletedAt === 'number' ? { deletedAt: record.deletedAt } : {}) }];
  });
  const result = React.useMemo(() => {
    if (!valid || !query || !Number.isFinite(startAt) || !Number.isFinite(endAt)) return null;
    const summary = aggregateAnalytics(analyticsTransactions, categoryEntities, currency, query.period as AnalyticsPeriod, startAt, endAt, timeZone, accountEntities);
    const items = dimension === 'category' ? summary.categoryBreakdown : dimension === 'account' ? summary.accountBreakdown : summary.merchantBreakdown;
    const item = items.find((entry) => entry.id === query.key);
    const rows = transactions.filter((transaction) => {
      if (transaction.type !== 'expense' || (transaction.status !== undefined && transaction.status !== 'posted') || transaction.deletedAt !== undefined || transaction.currency !== currency || Number(transaction.occurredAt ?? 0) < startAt || Number(transaction.occurredAt ?? 0) >= endAt) return false;
      const category = categories.find((record) => aliasesOf(record).includes(String(transaction.categoryId ?? '')));
      const account = accounts.find((record) => aliasesOf(record).includes(String(transaction.accountId ?? '')));
      const value = dimension === 'category' ? category ? idOf(category) : UNCATEGORIZED_ID : dimension === 'account' ? account ? idOf(account) : UNASSIGNED_ACCOUNT_ID : transaction.merchant?.trim() || UNSPECIFIED_MERCHANT;
      return value === query.key;
    }).sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
    return { item, rows, spentMinor: summary.spentMinor };
  }, [accountEntities, accounts, analyticsTransactions, categories, categoryEntities, currency, dimension, endAt, query, startAt, timeZone, transactions, valid]);
  const dataError = profileError ?? categoryError ?? accountError ?? transactionError;
  const loading = query === null || profileLoading || categoryLoading || accountLoading || transactionLoading;
  const title = dimension === 'category' ? 'Category breakdown' : dimension === 'account' ? 'Account breakdown' : dimension === 'merchant' ? 'Merchant breakdown' : 'Breakdown';

  if (!userId) return <SignInGate eyebrow="ANALYTICS BREAKDOWN" title="Your spending stays private.">Sign in to inspect a breakdown from finance data saved in this browser.</SignInGate>;
  if (loading) return <div className="finance-page"><p className="finance-muted" role="status">Opening the selected date range…</p></div>;
  if (dataError) return <div className="finance-page"><p className="finance-form-error" role="alert">Analytics data could not be opened: {dataError}</p><Link className="finance-secondary-action" href="/analytics"><ArrowLeft size={15} /> Back to analytics</Link></div>;
  if (!valid || !result?.item) return <div className="finance-page"><Empty title="Breakdown unavailable" description="This dimension, item, or date range is invalid or no longer available in the current user's local records." icon={<ChartNoAxesCombined size={20} />} action={<Link className="finance-inline-link" href="/analytics">Back to analytics</Link>} /></div>;
  return <div className="finance-page"><Link className="finance-secondary-action" href="/analytics"><ArrowLeft size={15} /> Back to analytics</Link><PageHeading eyebrow={`ANALYTICS · ${query.period.toUpperCase()}`} title={result.item.label} description={`${title} · ${new Date(startAt).toLocaleDateString()} – ${new Date(endAt).toLocaleDateString()}`} /><p className="finance-muted" role="status">{rangeLoading ? 'Loading the selected transaction range…' : rangeError ? `${rangeError} Results may be incomplete.` : serverRangeLoaded ? 'The selected server date range was loaded; local unsynced records are included.' : 'Showing browser-cached records for this date range. Older uncached transactions may be missing.'}</p><div className="finance-dashboard-grid"><Card className="finance-metric-card finance-balance-card"><span className="finance-metric-label">TOTAL SPENDING · {currency}</span><strong>{formatMinor(result.item.amountMinor, currency)}</strong><span className="finance-metric-foot">{result.rows.length} matching cached expenses</span></Card><Card className="finance-metric-card"><span className="finance-metric-label">ALL SPENDING · {currency}</span><strong>{formatMinor(result.spentMinor, currency)}</strong><span className="finance-metric-foot">Across the selected period</span></Card></div><Card className="finance-record-panel"><SectionHeader title="Matching expenses" action={<Badge variant="neutral">{result.rows.length} saved</Badge>} />{result.rows.length === 0 ? <Empty title="No cached matching expenses" description="This breakdown has no matching posted expenses in the records currently available here." /> : <ul className="finance-record-list">{result.rows.map((record) => <li key={idOf(record)}><span className="finance-record-symbol"><ChartNoAxesCombined size={17} /></span><span className="finance-record-copy"><strong><Link href={`/transaction/${encodeURIComponent(idOf(record))}`}>{record.title ?? record.merchant ?? 'Expense'}</Link></strong><small>{record.occurredAt ? new Date(record.occurredAt).toLocaleDateString() : 'Date unavailable'} · {record.type}</small></span><strong>{formatMinor(asMinor(record.amountMinor), record.currency ?? currency)} <ArrowRight size={14} aria-hidden="true" /></strong></li>)}</ul>}</Card><p className="finance-form-note">Breakdown totals use the shared analytics domain and only transactions available in the browser's local cache or fetched date range. The app does not claim that uncached history is complete.</p></div>;
}
