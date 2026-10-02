'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChartNoAxesCombined } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered } from '@/lib/offline/repository';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & { name?: string; currency?: string };
type Transaction = LocalRecord & {
  groupId?: string;
  type?: string;
  status?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  title?: string;
  occurredAt?: number;
  deletedAt?: number;
};
type Category = LocalRecord & { name?: string };
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter((id): id is string => typeof id === 'string');
const amount = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? BigInt(value)
        : 0n;

export default function GroupAnalyticsPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const {
    records: groups,
    loading: groupsLoading,
    error: groupsError,
  } = useLocalRecords<Group>('group');
  const {
    records: transactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useLocalRecords<Transaction>('transaction');
  const { records: categories } = useLocalRecords<Category>('category');
  const group = groups.find((item) => aliases(item).includes(routeId));
  const groupId = group ? String(group.id ?? group._id ?? '') : '';
  const groupIds = new Set(group ? aliases(group) : []);
  const endAt = React.useMemo(() => Date.now() + 1, []);
  const [rangeStatus, setRangeStatus] = React.useState<'loading' | 'ready' | 'offline' | 'error'>(
    'loading',
  );
  const [rangeError, setRangeError] = React.useState('');

  React.useEffect(() => {
    if (!userId || !groupId) return;
    let active = true;
    if (!isConnected) {
      void isGroupRangeCovered(userId, groupId, 0, endAt).then(
        (covered) => {
          if (!active) return;
          setRangeStatus(covered ? 'ready' : 'offline');
          setRangeError(
            covered ? '' : 'Offline. Saved entries are shown, but the full history is not cached.',
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
    void fetchGroupRange(groupId, 0, endAt).then(
      () => {
        if (active) setRangeStatus('ready');
      },
      (cause: unknown) => {
        if (!active) return;
        setRangeStatus('error');
        setRangeError(
          cause instanceof Error ? cause.message : 'Group history could not be loaded.',
        );
      },
    );
    return () => {
      active = false;
    };
  }, [endAt, fetchGroupRange, groupId, isConnected, userId]);

  if (!userId)
    return (
      <main className="finance-page">
        <h1>Group analytics</h1>
        <p>Sign in to view saved group records.</p>
        <Link className="finance-secondary-action" href="/sign-in">
          Sign in
        </Link>
      </main>
    );
  if (groupsLoading)
    return (
      <main className="finance-page">
        <p role="status">Loading group analytics…</p>
      </main>
    );
  if (!group)
    return (
      <main className="finance-page">
        <Link className="finance-secondary-action" href="/groups">
          ← All groups
        </Link>
        <section role="status">
          <h1>Group unavailable</h1>
          <p>
            {groupsError
              ? `Saved group records could not be read: ${groupsError}`
              : 'This group is not saved on this device.'}
          </p>
        </section>
      </main>
    );

  const expenses = transactions.filter(
    (record) =>
      groupIds.has(String(record.groupId ?? '')) &&
      record.type === 'expense' &&
      record.status === 'posted' &&
      record.deletedAt === undefined &&
      record.currency === (group.currency ?? 'INR'),
  );
  const categoryNames = new Map<string, string>();
  for (const category of categories)
    for (const key of aliases(category)) categoryNames.set(key, category.name ?? 'Uncategorized');
  const total = expenses.reduce((sum, expense) => sum + amount(expense.amountMinor), 0n);
  const average = expenses.length ? total / BigInt(expenses.length) : 0n;
  const byCategory = new Map<string, bigint>();
  for (const expense of expenses) {
    const key = typeof expense.categoryId === 'string' ? expense.categoryId : '';
    byCategory.set(key, (byCategory.get(key) ?? 0n) + amount(expense.amountMinor));
  }
  const topCategories = [...byCategory.entries()]
    .map(([key, value]) => ({
      name: key ? (categoryNames.get(key) ?? 'Other') : 'Uncategorized',
      value,
    }))
    .sort((a, b) => (a.value > b.value ? -1 : a.value < b.value ? 1 : 0))
    .slice(0, 5);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  monthStart.setMonth(monthStart.getMonth() - 5);
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(monthStart);
    date.setMonth(monthStart.getMonth() + index);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date),
      value: 0n,
    };
  });
  const monthMap = new Map(monthly.map((item) => [item.key, item]));
  for (const expense of expenses) {
    const date = new Date(Number(expense.occurredAt ?? 0));
    const bucket = monthMap.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.value += amount(expense.amountMinor);
  }
  const maxMonth = monthly.reduce((max, item) => (item.value > max ? item.value : max), 0n) || 1n;
  const maxCategory =
    topCategories.reduce((max, item) => (item.value > max ? item.value : max), 0n) || 1n;
  const rangeBusy = rangeStatus === 'loading' || transactionsLoading;
  const statusText =
    rangeStatus === 'offline'
      ? rangeError
      : rangeStatus === 'error'
        ? `Analytics may be incomplete: ${rangeError}`
        : !isConnected && rangeStatus === 'ready'
          ? 'Offline · showing saved group history'
          : rangeStatus === 'loading' && isConnected
            ? 'Updating full group history…'
            : '';

  return (
    <main
      className="finance-page"
      style={{
        display: 'grid',
        gap: 24,
        maxWidth: 1040,
        margin: '0 auto',
        padding: '24px clamp(16px, 4vw, 40px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          aria-label="Back to group"
          className="finance-secondary-action"
          href={`/group/${encodeURIComponent(routeId)}`}
        >
          <ArrowLeft size={16} /> Group
        </Link>
        <div>
          <p className="finance-kicker">SHARED LEDGER</p>
          <h1 style={{ margin: 0 }}>{group.name ?? 'Group'} analytics</h1>
        </div>
      </div>
      {groupsError || transactionsError ? (
        <p role="alert" className="finance-form-error">
          Saved analytics data could not be fully read. {groupsError ?? transactionsError}
        </p>
      ) : null}
      {statusText ? (
        <p role={rangeStatus === 'error' ? 'alert' : 'status'} className="finance-muted">
          {statusText}
        </p>
      ) : null}
      {rangeBusy ? (
        <div role="status" aria-label="Loading analytics" style={{ display: 'grid', gap: 12 }}>
          <div className="finance-chart-panel" style={{ minHeight: 110 }} />
          <div className="finance-chart-panel" style={{ minHeight: 220 }} />
        </div>
      ) : rangeStatus === 'error' ? (
        <section role="alert" className="finance-chart-panel">
          <h2>Analytics unavailable</h2>
          <p>{rangeError}</p>
        </section>
      ) : expenses.length === 0 ? (
        <section className="finance-chart-panel" style={{ padding: 28 }}>
          <ChartNoAxesCombined size={26} aria-hidden="true" />
          <h2>No group spending yet</h2>
          <p>Posted expenses will appear here once the group ledger has activity.</p>
        </section>
      ) : (
        <>
          <section
            aria-label="Group spending summary"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {[
              ['Total spending', formatMinor(total, group.currency ?? 'INR')],
              ['Posted expenses', String(expenses.length)],
              ['Average expense', formatMinor(average, group.currency ?? 'INR')],
            ].map(([label, value]) => (
              <div className="finance-metric-card" key={label}>
                <p className="finance-metric-label">{label}</p>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          <section
            className="finance-chart-panel"
            aria-labelledby="monthly-title"
            style={{ padding: 22 }}
          >
            <h2 id="monthly-title">Monthly spending</h2>
            <p className="finance-muted">Last six calendar months · {group.currency ?? 'INR'}</p>
            <div
              role="img"
              aria-label={`Monthly spending: ${monthly.map((item) => `${item.label} ${formatMinor(item.value, group.currency ?? 'INR')}`).join(', ')}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                alignItems: 'end',
                gap: 12,
                height: 190,
                marginTop: 20,
              }}
            >
              {monthly.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'grid',
                    alignItems: 'end',
                    justifyItems: 'center',
                    gap: 8,
                    height: '100%',
                  }}
                >
                  <span style={{ fontSize: 12 }}>
                    {item.value ? formatMinor(item.value, group.currency ?? 'INR') : '—'}
                  </span>
                  <div
                    style={{
                      width: 'min(100%, 40px)',
                      height: `${Math.max(4, Number((item.value * 100n) / maxMonth))}%`,
                      background: 'var(--finance-lime)',
                      borderRadius: 3,
                    }}
                  />
                  <span className="finance-muted">{item.label}</span>
                </div>
              ))}
            </div>
          </section>
          <section
            className="finance-chart-panel"
            aria-labelledby="categories-title"
            style={{ padding: 22 }}
          >
            <h2 id="categories-title">Spending by category</h2>
            {topCategories.length ? (
              <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
                {topCategories.map((item) => (
                  <div key={item.name} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>{item.name}</span>
                      <strong>{formatMinor(item.value, group.currency ?? 'INR')}</strong>
                    </div>
                    <div
                      role="meter"
                      aria-label={`${item.name} share`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Number((item.value * 100n) / maxCategory)}
                      style={{ height: 8, background: 'var(--finance-line)', borderRadius: 4 }}
                    >
                      <div
                        style={{
                          width: `${Math.max(2, Number((item.value * 100n) / maxCategory))}%`,
                          height: '100%',
                          background: 'var(--finance-lime)',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No category details are available for these expenses.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
