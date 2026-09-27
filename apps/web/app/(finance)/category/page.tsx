'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Tags } from 'lucide-react';
import { Badge, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { asMinor, aliasesOf, belongsToUser, idOf, PageHeading, SignInGate } from '../_personal';

type Category = LocalRecord & {
  name?: string;
  icon?: string;
  sortOrder?: number;
  archivedAt?: number;
  isSystem?: boolean;
  monthlyLimitMinor?: bigint | number | string;
  limitCurrency?: string;
};
type Profile = LocalRecord & { defaultCurrency?: string };
type Transaction = LocalRecord & {
  categoryId?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  type?: string;
  status?: string;
  occurredAt?: number;
  deletedAt?: number;
};

export default function PersonalCategoriesPage() {
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Category>('category');
  const {
    records: profiles,
    loading: profileLoading,
    error: profileError,
  } = useLocalRecords<Profile>('profile');
  const {
    records: transactions,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const [rangeError, setRangeError] = React.useState('');
  const monthRange = React.useMemo(() => {
    const now = new Date();
    return {
      startAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      endAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    };
  }, []);
  React.useEffect(() => {
    if (!userId || !isConnected) return;
    let active = true;
    setRangeError('');
    void fetchTransactionRange(monthRange.startAt, monthRange.endAt).catch((cause: unknown) => {
      if (active)
        setRangeError(
          cause instanceof Error ? cause.message : 'Could not refresh monthly category activity.',
        );
    });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, monthRange, userId]);
  const profile = profiles[0];
  const categories = records
    .filter((record) => userId && belongsToUser(record, userId) && record.archivedAt === undefined)
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        (left.name ?? '').localeCompare(right.name ?? ''),
    );
  const categoryById = new Map<string, Category>();
  for (const category of categories) {
    for (const id of aliasesOf(category)) categoryById.set(id, category);
  }
  const monthlyTotals = new Map<string, { spent: bigint; received: bigint }>();
  for (const transaction of transactions) {
    const occurredAt = Number(transaction.occurredAt ?? 0);
    if (
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      (transaction.type !== 'expense' && transaction.type !== 'income') ||
      occurredAt < monthRange.startAt ||
      occurredAt >= monthRange.endAt
    )
      continue;
    const category = categoryById.get(String(transaction.categoryId ?? ''));
    const currency = category?.limitCurrency ?? profile?.defaultCurrency;
    if (!category || !currency || transaction.currency !== currency) continue;
    const id = idOf(category);
    const total = monthlyTotals.get(id) ?? { spent: 0n, received: 0n };
    if (transaction.type === 'expense') total.spent += asMinor(transaction.amountMinor);
    else total.received += asMinor(transaction.amountMinor);
    monthlyTotals.set(id, total);
  }
  if (!userId)
    return (
      <SignInGate eyebrow="CATEGORIES" title="Make every expense clearer.">
        Sign in to view and manage your private category list.
      </SignInGate>
    );
  return (
    <div className="finance-page">
      <PageHeading
        eyebrow="ORGANIZE YOUR ACTIVITY"
        title="Categories"
        description="Keep category names and icons consistent across your local and synced transaction history."
      />
      {(profileError || transactionError) && (
        <p className="finance-form-error" role="alert">
          Monthly category activity could not be opened: {profileError ?? transactionError}
        </p>
      )}
      {rangeError && (
        <p className="finance-muted" role="status">
          Range refresh unavailable. Showing monthly activity already saved in this browser.
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge variant="neutral">{categories.length} active</Badge>
        <Link className="finance-primary-link" href="/category/new">
          New category <Plus size={16} />
        </Link>
      </div>
      <Card className="finance-record-panel">
        <SectionHeader
          title="Your categories"
          action={
            <Link href="/category/new" aria-label="Add category">
              <Plus size={17} />
            </Link>
          }
        />
        {loading || profileLoading || transactionLoading ? (
          <p className="finance-muted" role="status">
            Opening your local categories…
          </p>
        ) : error ? (
          <p className="finance-form-error" role="alert">
            Category data could not be opened: {error}
          </p>
        ) : categories.length === 0 ? (
          <Empty
            title="No categories yet"
            description="Add a category to organize transactions and set an optional monthly limit."
            icon={<Tags size={20} />}
            action={
              <Link className="finance-inline-link" href="/category/new">
                Create a category
              </Link>
            }
          />
        ) : (
          <ul className="finance-record-list">
            {categories.map((category) => {
              const currency = category.limitCurrency ?? profile?.defaultCurrency;
              const totals = monthlyTotals.get(idOf(category)) ?? { spent: 0n, received: 0n };
              return (
                <li key={idOf(category)}>
                  <span className="finance-record-symbol" aria-hidden="true">
                    {category.icon ?? <Tags size={17} />}
                  </span>
                  <span className="finance-record-copy">
                    <strong>
                      <Link href={`/category/${encodeURIComponent(idOf(category))}`}>
                        {category.name ?? 'Category'}
                      </Link>
                    </strong>
                    <small>{category.isSystem ? 'System category' : 'Personal category'}</small>
                    <small>Monthly activity{currency ? ` · ${currency}` : ''}</small>
                    {currency && (
                      <small>
                        Spent {formatMinor(totals.spent, currency)} · received{' '}
                        {formatMinor(totals.received, currency)}
                        {category.monthlyLimitMinor !== undefined
                          ? ` · limit ${formatMinor(asMinor(category.monthlyLimitMinor), currency)}`
                          : ''}
                      </small>
                    )}
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
