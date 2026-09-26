'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, ReceiptText } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & { name?: string; currency?: string };
type Expense = LocalRecord & { groupId?: string; type?: string; title?: string; amountMinor?: bigint | number | string; currency?: string; occurredAt?: number; status?: string; deletedAt?: number };
const asMinor = (value: unknown) => typeof value === 'bigint' ? value : typeof value === 'number' && Number.isFinite(value) ? BigInt(Math.trunc(value)) : typeof value === 'string' && /^-?\d+$/.test(value) ? BigInt(value) : 0n;
const aliases = (record: LocalRecord) => [record.id, record._id, record.cloudId].filter((value): value is string => typeof value === 'string');
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');
const endAt = Date.now() + 1;
const startAt = endAt - 90 * 24 * 60 * 60 * 1000;

export default function GroupExpensesPage() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const { records: groups, loading: groupsLoading } = useLocalRecords<Group>('group');
  const { records: transactions, loading: transactionsLoading } = useLocalRecords<Expense>('transaction');
  const [rangeStatus, setRangeStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'uncached' | 'error'>('idle');
  const [rangeError, setRangeError] = React.useState('');
  const group = groups.find((item) => aliases(item).includes(routeId));
  const groupId = group ? idOf(group) : routeId;
  const groupReady = Boolean(group);

  React.useEffect(() => {
    if (!userId || !group) return;
    if (!isConnected) {
      setRangeStatus('uncached');
      setRangeError('Offline. Saved expenses remain visible, but this 90-day range may not be complete.');
      return;
    }
    let active = true;
    setRangeStatus('loading');
    setRangeError('');
    void fetchGroupRange(groupId, startAt, endAt).then(() => {
      if (active) setRangeStatus('loaded');
    }, (cause: unknown) => {
      if (active) {
        setRangeStatus('error');
        setRangeError(cause instanceof Error ? cause.message : 'The group range could not be loaded.');
      }
    });
    return () => { active = false; };
  }, [fetchGroupRange, groupReady, groupId, isConnected, userId]);

  if (!userId) return <section className="finance-welcome"><p className="finance-kicker">GROUP EXPENSES</p><h1>Keep shared spending together.</h1><p>Sign in to view saved group expenses and create an allocation.</p><Link className="finance-primary-link" href="/sign-in">Sign in <ArrowRight size={16} /></Link></section>;
  if (groupsLoading && !group) return <div className="finance-page"><p className="finance-muted" role="status">Opening saved group…</p></div>;
  if (!group) return <div className="finance-page"><Link className="finance-secondary-action" href="/groups"><ArrowLeft size={15} /> Groups</Link><Empty title="Group unavailable offline" description="This group is not saved in the current browser. Reconnect, then open the group list again." /></div>;

  const groupIds = aliases(group);
  const expenses = transactions.filter((item) => typeof item.groupId === 'string' && groupIds.includes(item.groupId) && item.type === 'expense' && item.deletedAt === undefined && item.currency === (group.currency ?? 'INR')).sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  return (
    <div className="finance-page">
      <header className="finance-page-heading"><div><Link className="finance-secondary-action" href={`/group/${encodeURIComponent(groupId)}`}>‹ {group.name ?? 'Group'}</Link><p className="finance-kicker">SHARED LEDGER</p><h1>Expenses</h1><p className="finance-muted">The last 90 days are requested from the group range. Saved expenses remain available offline.</p></div><Link className="finance-primary-link" href={`/group/${encodeURIComponent(groupId)}/expenses/new`}>Add expense <Plus size={15} /></Link></header>
      {rangeStatus === 'loading' && <p className="finance-form-note" role="status">Loading expense and repayment pages…</p>}
      {(rangeStatus === 'uncached' || rangeStatus === 'error') && <p className={rangeStatus === 'error' ? 'finance-form-error' : 'finance-form-note'} role={rangeStatus === 'error' ? 'alert' : 'status'}>{rangeError}</p>}
      {transactionsLoading ? <p className="finance-muted" role="status">Opening locally saved expenses…</p> : <Card className="finance-record-panel"><SectionHeader title="Shared expenses" action={<Badge variant="neutral">{expenses.length}</Badge>} />{expenses.length ? <ul className="finance-record-list">{expenses.map((expense) => <li key={idOf(expense)}><span className="finance-record-symbol"><ReceiptText size={17} /></span><span className="finance-record-copy"><strong>{expense.title ?? 'Group expense'}</strong><small>{new Date(Number(expense.occurredAt ?? Date.now())).toLocaleDateString()} · {expense.status === 'pending' ? 'Pending sync' : 'Expense'}</small></span><strong className="finance-record-amount">{formatMinor(asMinor(expense.amountMinor), group.currency ?? 'INR')}</strong></li>)}</ul> : <Empty title="No group expenses" description="Add the first expense and choose how it is shared." action={<Link className="finance-secondary-action" href={`/group/${encodeURIComponent(groupId)}/expenses/new`}>Add expense <ArrowRight size={15} /></Link>} />}</Card>}
      {rangeStatus === 'error' && isConnected && <Button variant="outline" onPress={() => { setRangeStatus('idle'); setRangeError(''); void fetchGroupRange(groupId, startAt, endAt).then(() => setRangeStatus('loaded'), (cause: unknown) => { setRangeStatus('error'); setRangeError(cause instanceof Error ? cause.message : 'The group range could not be loaded.'); }); }}>Retry range</Button>}
    </div>
  );
}
