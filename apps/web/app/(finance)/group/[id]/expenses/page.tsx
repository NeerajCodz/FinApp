'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, ReceiptText } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered } from '@/lib/offline/repository';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & { name?: string; currency?: string };
type Expense = LocalRecord & {
  groupId?: string;
  type?: string;
  title?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};
const asMinor = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? BigInt(value)
        : 0n;
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function GroupExpensesPage() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const startAt = React.useMemo(() => Date.now() - 90 * 24 * 60 * 60 * 1000, []);
  const endAt = React.useMemo(() => Date.now() + 1, []);
  const { records: groups, loading: groupsLoading } = useLocalRecords<Group>('group');
  const { records: transactions, loading: transactionsLoading } =
    useLocalRecords<Expense>('transaction');
  const [rangeStatus, setRangeStatus] = React.useState<
    'idle' | 'loading' | 'loaded' | 'uncached' | 'error'
  >('idle');
  const [rangeError, setRangeError] = React.useState('');
  const group = groups.find((item) => aliases(item).includes(routeId));
  const groupId = group ? idOf(group) : routeId;
  const groupReady = Boolean(group);

  React.useEffect(() => {
    if (!userId || !group) return;
    let active = true;
    if (!isConnected) {
      void isGroupRangeCovered(userId, groupId, startAt, endAt).then(
        (covered) => {
          if (!active) return;
          setRangeStatus(covered ? 'loaded' : 'uncached');
          setRangeError(
            covered
              ? ''
              : 'Offline. Saved expenses remain visible, but this 90-day range may not be complete.',
          );
        },
        (cause: unknown) => {
          if (!active) return;
          setRangeStatus('error');
          setRangeError(
            cause instanceof Error ? cause.message : 'Saved range coverage could not be checked.',
          );
        },
      );
      return () => {
        active = false;
      };
    }
    setRangeStatus('loading');
    setRangeError('');
    void fetchGroupRange(groupId, startAt, endAt).then(
      () => {
        if (active) setRangeStatus('loaded');
      },
      (cause: unknown) => {
        if (active) {
          setRangeStatus('error');
          setRangeError(
            cause instanceof Error ? cause.message : 'The group range could not be loaded.',
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [fetchGroupRange, groupReady, groupId, isConnected, startAt, endAt, userId]);

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">GROUP EXPENSES</p>
        <h1>Keep shared spending together.</h1>
        <p>Sign in to view saved group expenses and create an allocation.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  if (groupsLoading && !group)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Opening saved group…
        </p>
      </div>
    );
  if (!group)
    return (
      <div className="finance-page">
        <Link className="finance-secondary-action" href="/groups">
          <ArrowLeft size={15} /> Groups
        </Link>
        <Empty
          title="Group unavailable offline"
          description="This group is not saved in the current browser. Reconnect, then open the group list again."
        />
      </div>
    );

  const groupIds = aliases(group);
  const expenses = transactions
    .filter(
      (item) =>
        typeof item.groupId === 'string' &&
        groupIds.includes(item.groupId) &&
        Number(item.occurredAt ?? 0) >= startAt &&
        Number(item.occurredAt ?? 0) < endAt,
    )
    .sort((left, right) => Number(left.occurredAt ?? 0) - Number(right.occurredAt ?? 0));
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <Link className="finance-secondary-action" href={`/group/${encodeURIComponent(groupId)}`}>
            <ArrowLeft size={15} /> {group.name ?? 'Group'}
          </Link>
          <p className="finance-kicker">SHARED LEDGER</p>
          <h1>Expenses</h1>
          <p className="finance-muted">
            The last 90 days are requested from the group range. Saved expenses remain available
            offline.
          </p>
        </div>
        <Link
          className="finance-primary-link"
          href={`/group/${encodeURIComponent(groupId)}/expenses/new`}
        >
          <Plus size={15} /> Add expense
        </Link>
      </header>
      {rangeStatus === 'loading' && (
        <p className="finance-form-note" role="status">
          Loading expense and repayment pages…
        </p>
      )}
      {(rangeStatus === 'uncached' || rangeStatus === 'error') && (
        <p
          className={rangeStatus === 'error' ? 'finance-form-error' : 'finance-form-note'}
          role={rangeStatus === 'error' ? 'alert' : 'status'}
        >
          {rangeError}
        </p>
      )}
      {transactionsLoading ? (
        <p className="finance-muted" role="status">
          Opening locally saved expenses…
        </p>
      ) : (
        <Card className="finance-record-panel">
          <SectionHeader
            title="Shared expenses"
            action={<Badge variant="neutral">{expenses.length}</Badge>}
          />
          {expenses.length ? (
            <ul className="finance-record-list">
              {expenses.map((expense) => (
                <li key={idOf(expense)}>
                  <span className="finance-record-symbol">
                    <ReceiptText size={17} />
                  </span>
                  <span className="finance-record-copy">
                    <strong>{expense.title ?? 'Group expense'}</strong>
                    <small>
                      {new Date(Number(expense.occurredAt ?? Date.now())).toLocaleDateString()} ·
                      Group expense
                    </small>
                  </span>
                  <strong className="finance-record-amount">
                    {formatMinor(
                      asMinor(expense.amountMinor),
                      expense.currency ?? group.currency ?? 'INR',
                    )}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="No group expenses"
              description="Add the first expense and choose who shared it."
              action={
                <Link
                  className="finance-secondary-action"
                  href={`/group/${encodeURIComponent(groupId)}/expenses/new`}
                >
                  Add expense <ArrowRight size={15} />
                </Link>
              }
            />
          )}
        </Card>
      )}
      {rangeStatus === 'error' && isConnected && (
        <Button
          variant="outline"
          onPress={() => {
            setRangeStatus('idle');
            setRangeError('');
            void fetchGroupRange(groupId, startAt, endAt).then(
              () => setRangeStatus('loaded'),
              (cause: unknown) => {
                setRangeStatus('error');
                setRangeError(
                  cause instanceof Error ? cause.message : 'The group range could not be loaded.',
                );
              },
            );
          }}
        >
          Retry range
        </Button>
      )}
    </div>
  );
}
