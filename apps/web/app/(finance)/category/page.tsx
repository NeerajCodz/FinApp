'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { Empty, IconButton, Separator, Typography } from '@finapp/ui/web';
import { CategoryIcon } from '@finapp/ui/finance';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { asMinor, aliasesOf, belongsToUser, idOf, SignInGate } from '../_personal';

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
  const router = useRouter();
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
        String(left._id ?? left.id ?? '').localeCompare(String(right._id ?? right.id ?? '')),
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
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title" style={{ flex: 1 }}>
          Categories
        </Typography>
        <IconButton
          label="Add category"
          variant="ghost"
          onPress={() => router.push('/category/new')}
        >
          <Plus size={22} aria-hidden="true" />
        </IconButton>
      </header>
      {loading || profileLoading || transactionLoading ? (
        <Typography variant="small" role="status">Loading categories…</Typography>
      ) : error ? (
        <p className="finance-form-error" role="alert">
          Category data could not be opened: {error}
        </p>
      ) : categories.length === 0 ? (
        <Empty
          title="No categories yet."
          description="Create a category to organize your income and spending."
          action={
            <Link className="finance-inline-link" href="/category/new">
              Add category
            </Link>
          }
        />
      ) : (
        <section style={{ display: 'grid', gap: 12 }}>
          <Typography variant="label">Categories</Typography>
          <div>
            {categories.map((category, index) => {
              const currency = category.limitCurrency ?? profile?.defaultCurrency;
              const totals = monthlyTotals.get(idOf(category)) ?? { spent: 0n, received: 0n };
              return (
                <React.Fragment key={idOf(category)}>
                  <Link
                    href={`/category/${encodeURIComponent(idOf(category))}`}
                    aria-label={`Open ${category.name ?? 'Category'} category`}
                    style={{
                      display: 'flex',
                      minHeight: 72,
                      alignItems: 'center',
                      gap: 12,
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <CategoryIcon label={category.name ?? 'Category'} icon={category.icon} />
                    <span style={{ display: 'grid', minWidth: 0, flex: 1, gap: 2 }}>
                      <Typography variant="bodyLarge" style={{ overflow: 'hidden', fontSize: 15, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {category.name ?? 'Category'}
                      </Typography>
                      <Typography variant="caption">Monthly activity</Typography>
                    </span>
                    {currency && (
                      <span style={{ display: 'grid', justifyItems: 'end', gap: 4, flexShrink: 0 }}>
                        <Typography variant="caption">
                          Spent {formatMinor(totals.spent, currency)}
                        </Typography>
                        <Typography variant="caption">
                          Received {formatMinor(totals.received, currency)}
                        </Typography>
                        {category.monthlyLimitMinor !== undefined && (
                          <Typography variant="caption">
                            Limit {formatMinor(asMinor(category.monthlyLimitMinor), currency)}
                          </Typography>
                        )}
                      </span>
                    )}
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                  {index < categories.length - 1 && <Separator />}
                </React.Fragment>
              );
            })}
          </div>
        </section>
      )}
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
    </div>
  );
}
