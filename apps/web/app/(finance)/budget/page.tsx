'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Plus } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { asMinor, belongsToUser, idOf, PageHeading, SignInGate } from '../_personal';

type Budget = LocalRecord & { name?: string; amountMinor?: bigint | number | string; currency?: string; period?: string; categoryId?: string; accountId?: string; startAt?: number; endAt?: number; archivedAt?: number };
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; archivedAt?: number };
type Transaction = LocalRecord & { type?: string; amountMinor?: bigint | number | string; currency?: string; categoryId?: string; accountId?: string; occurredAt?: number; status?: string; deletedAt?: number };

export default function PersonalBudgetsPage() {
  const { userId, fetchTransactionRange, isConnected } = useBrowserSync();
  const { records: budgetRecords, loading, error } = useLocalRecords<Budget>('budget');
  const { records: transactions } = useLocalRecords<Transaction>('transaction');
  const { records: accountRecords } = useLocalRecords<Account>('account');
  const { records: categoryRecords } = useLocalRecords<Category>('category');
  const [showArchived, setShowArchived] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const budgets = budgetRecords.filter((item) => userId && belongsToUser(item, userId)).sort((left, right) => Number(left.startAt ?? 0) - Number(right.startAt ?? 0) || (left.name ?? '').localeCompare(right.name ?? ''));
  const active = budgets.filter((item) => item.archivedAt === undefined);
  const shown = budgets.filter((item) => showArchived === (item.archivedAt !== undefined));
  const rangeStartAt = active.length ? active.reduce((minimum, item) => Math.min(minimum, Number(item.startAt ?? 0)), Number.MAX_SAFE_INTEGER) : null;
  const rangeEndAt = active.length ? active.reduce((maximum, item) => Math.max(maximum, Number(item.endAt ?? 1)), 0) : null;
  React.useEffect(() => {
    if (!userId || rangeStartAt === null || rangeEndAt === null || !isConnected) return;
    let live = true;
    setRangeError('');
    void fetchTransactionRange(rangeStartAt, rangeEndAt).catch((cause: unknown) => { if (live) setRangeError(cause instanceof Error ? cause.message : 'Could not refresh budget activity.'); });
    return () => { live = false; };
  }, [fetchTransactionRange, isConnected, rangeEndAt, rangeStartAt, userId]);
  const accounts = accountRecords.filter((item) => userId && belongsToUser(item, userId));
  const categories = categoryRecords.filter((item) => userId && belongsToUser(item, userId));
  const categoryByAlias = new Map<string, Category>();
  const accountByAlias = new Map<string, Account>();
  for (const category of categories) for (const key of [category.id, category._id, category.cloudId]) if (typeof key === 'string') categoryByAlias.set(key, category);
  for (const account of accounts) for (const key of [account.id, account._id, account.cloudId]) if (typeof key === 'string') accountByAlias.set(key, account);

  if (!userId) return <SignInGate eyebrow="BUDGETS" title="Spend with intention.">Sign in to open budgets and activity saved in your private browser workspace.</SignInGate>;
  return (
    <div className="finance-page">
      <PageHeading eyebrow="MAKE ROOM FOR WHAT MATTERS" title="Budgets" description="Review spending limits against posted expenses. Archived budgets remain available without changing past records." />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}><Badge variant="neutral">{active.length} active</Badge><Button type="button" variant={showArchived ? 'secondary' : 'outline'} onPress={() => setShowArchived((value) => !value)}>{showArchived ? 'Show active' : 'Show archived'}</Button><Link className="finance-primary-link" href="/budget/new">New budget <Plus size={16} /></Link></div>
      {rangeError && <p className="finance-muted" role="status">Could not refresh this date range; totals use the records cached here. {rangeError}</p>}
      <Card className="finance-record-panel"><SectionHeader title={showArchived ? 'Archived budgets' : 'Your budgets'} action={<Link href="/budget/new" aria-label="Add budget"><Plus size={17} /></Link>} />{loading ? <p className="finance-muted" role="status">Opening your local budgets…</p> : error ? <p className="finance-form-error" role="alert">Budget data could not be opened: {error}</p> : shown.length === 0 ? <Empty title={showArchived ? 'No archived budgets' : 'No budgets yet'} description={showArchived ? 'Archived budgets stay available for reference.' : 'Create a limit for all spending, a category, an account, or a custom date range.'} icon={<CalendarDays size={20} />} action={!showArchived ? <Link className="finance-inline-link" href="/budget/new">Create a budget</Link> : undefined} /> : (
        <ul className="finance-plan-cards">{shown.map((budget) => {
          const category = budget.categoryId ? categoryByAlias.get(budget.categoryId) : undefined;
          const account = budget.accountId ? accountByAlias.get(budget.accountId) : undefined;
          const currency = budget.currency ?? account?.currency ?? 'INR';
          const spent = transactions.filter((transaction) => {
            if (transaction.type !== 'expense' || (transaction.status !== undefined && transaction.status !== 'posted') || transaction.deletedAt !== undefined || Number(transaction.occurredAt ?? 0) < Number(budget.startAt ?? 0) || Number(transaction.occurredAt ?? 0) >= Number(budget.endAt ?? Number.MAX_SAFE_INTEGER) || transaction.currency !== currency) return false;
            if (budget.period === 'category' && transaction.categoryId !== budget.categoryId && (!category || categoryByAlias.get(String(transaction.categoryId ?? '')) !== category)) return false;
            if (budget.period === 'account' && transaction.accountId !== budget.accountId && (!account || accountByAlias.get(String(transaction.accountId ?? '')) !== account)) return false;
            return true;
          }).reduce((sum, transaction) => sum + asMinor(transaction.amountMinor), 0n);
          const limit = asMinor(budget.amountMinor);
          const percent = limit > 0n ? Math.min(100, Number((spent * 100n) / limit)) : 0;
          const scope = budget.period === 'category' ? category?.name ?? 'Category' : budget.period === 'account' ? account?.name ?? 'Account' : budget.period === 'custom' ? 'Custom dates' : 'Monthly';
          return <li className="finance-plan-card" key={idOf(budget)}><Link href={`/budget/${encodeURIComponent(idOf(budget))}`} style={{ display: 'grid', gap: 10, color: 'inherit', textDecoration: 'none' }}><div className="finance-budget-heading"><span><strong>{budget.name ?? 'Budget'}</strong><small>{scope} · {currency}{budget.archivedAt !== undefined ? ' · archived' : ''}</small></span><strong>{formatMinor(spent, currency)} <small>of {formatMinor(limit, currency)}</small></strong></div><div className="finance-plan-track"><span style={{ width: `${percent}%` }} /></div><small className="finance-plan-dates">{budget.startAt ? new Date(budget.startAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} – {budget.endAt ? new Date(budget.endAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</small></Link></li>;
        })}</ul>
      )}</Card>
      <p className="finance-form-note">Budget totals are based on posted transactions currently stored in this browser. A date range may be incomplete until loaded from sync.</p>
      <Link className="finance-secondary-action" href="/budgets">Open budgets overview <ArrowRight size={15} /></Link>
    </div>
  );
}
