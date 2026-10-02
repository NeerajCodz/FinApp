'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Plus, Search, Tag } from 'lucide-react';
import { Button, Empty, Input, Typography } from '@finapp/ui/web';
import { formatMinor } from '../money';
import { formatTransactionDate } from '../datetime';
import { CategoryIcon } from './CategoryIcon';
import styles from './CategoriesOverview.module.css';

export type CategoryOverviewItem = {
  id: string;
  name: string;
  icon?: string;
  kind: 'expense' | 'income';
  currency: string;
  monthSpentMinor: bigint;
  monthReceivedMinor: bigint;
  recentSpendMinor: bigint;
  monthlyLimitMinor?: bigint;
  transactionCount: number;
  lastActivityAt?: number;
};

export type CategoriesOverviewProps = {
  items: readonly CategoryOverviewItem[];
  defaultCurrency: string;
  loading?: boolean;
  error?: string;
  onOpenCategory: (id: string) => void;
  onAddCategory: () => void;
  onOpenAnalytics: () => void;
};

type Filter = 'all' | 'expense' | 'income' | 'with-limit';
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'with-limit', label: 'With limit' },
];

function dateLabel(timestamp?: number) {
  if (timestamp === undefined) return 'No activity in last 30 days';
  return formatTransactionDate(timestamp, false, 'UTC');
}

function percent(spent: bigint, limit?: bigint) {
  if (!limit || limit <= 0n) return 0;
  return Math.min(100, Number((spent * 100n) / limit));
}

export function CategoriesOverview({
  items,
  defaultCurrency,
  loading = false,
  error,
  onOpenCategory,
  onAddCategory,
  onOpenAnalytics,
}: CategoriesOverviewProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const summary = useMemo(
    () => ({
      total: items.length,
      limited: items.filter((item) => item.monthlyLimitMinor !== undefined).length,
      recentSpendMinor: items
        .filter((item) => item.currency === defaultCurrency)
        .reduce((total, item) => total + item.recentSpendMinor, 0n),
      inactive: items.filter((item) => item.lastActivityAt === undefined).length,
    }),
    [defaultCurrency, items],
  );
  const visible = items.filter((item) => {
    if (filter === 'expense' && item.kind !== 'expense') return false;
    if (filter === 'income' && item.kind !== 'income') return false;
    if (filter === 'with-limit' && item.monthlyLimitMinor === undefined) return false;
    return item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  const recentSpendLabel = formatMinor(summary.recentSpendMinor, defaultCurrency);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Typography variant="title">Categories</Typography>
          <p className={styles.lede}>
            Organize your spending and income, one clear view at a time.
          </p>
        </div>
        <div className={styles.actions}>
          <label className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChangeText={setQuery}
              placeholder="Search categories"
              accessibilityLabel="Search categories"
            />
          </label>
          <Button variant="outline" onPress={onOpenAnalytics} className={styles.analyticsAction}>
            <BarChart3 size={16} aria-hidden="true" />
            Category analytics
          </Button>
          <Button onPress={onAddCategory}>
            <Plus size={17} aria-hidden="true" />
            Add category
          </Button>
        </div>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <section className={styles.summary} aria-label="Category totals">
        <Summary label="Active categories" value={summary.total} hint="Available now" tone="lime" />
        <Summary
          label="Categories with limits"
          value={summary.limited}
          hint="Monthly limits set"
          tone="warning"
        />
        <Summary
          label="Spent in last 30 days"
          value={recentSpendLabel}
          hint={defaultCurrency}
          tone="expense"
        />
        <Summary
          label="No recent activity"
          value={summary.inactive}
          hint="In the last 30 days"
          tone="income"
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <Typography variant="heading">Your categories</Typography>
            <p>Track this month’s activity, set limits, and open a category for more detail.</p>
          </div>
          <div className={styles.filters} role="group" aria-label="Filter categories">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                className={filter === item.value ? styles.activeFilter : undefined}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.status} role="status">
            Loading your categories…
          </div>
        ) : items.length === 0 ? (
          <Empty
            title="No categories yet."
            description="Create a category to organize your income and spending."
            action={<Button onPress={onAddCategory}>Add category</Button>}
          />
        ) : visible.length === 0 ? (
          <Empty
            title="No matching categories."
            description={
              query ? 'Try a different search or filter.' : 'No categories match this filter yet.'
            }
          />
        ) : (
          <div className={styles.tableWrap}>
            <div className={styles.tableHead} aria-hidden="true">
              <span>Category</span>
              <span>Kind</span>
              <span>This month</span>
              <span>Limit</span>
              <span>Last activity</span>
              <span />
            </div>
            <div className={styles.rows}>
              {visible.map((item) => {
                const activePercent = percent(item.monthSpentMinor, item.monthlyLimitMinor);
                const isOver =
                  item.monthlyLimitMinor !== undefined &&
                  item.monthSpentMinor > item.monthlyLimitMinor;
                return (
                  <button
                    className={styles.row}
                    key={item.id}
                    type="button"
                    onClick={() => onOpenCategory(item.id)}
                    aria-label={`Open ${item.name} category`}
                  >
                    <span className={styles.categoryName}>
                      <CategoryIcon label={item.name} icon={item.icon} />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.transactionCount}{' '}
                          {item.transactionCount === 1 ? 'transaction' : 'transactions'} this month
                        </small>
                      </span>
                    </span>
                    <span
                      className={`${styles.kind} ${item.kind === 'income' ? styles.income : styles.expense}`}
                    >
                      {item.kind}
                    </span>
                    <span
                      className={`${styles.amount} ${item.kind === 'income' ? styles.incomeAmount : styles.expenseAmount}`}
                    >
                      {formatMinor(
                        item.kind === 'income' ? item.monthReceivedMinor : item.monthSpentMinor,
                        item.currency,
                      )}
                    </span>
                    <span className={styles.limitCell}>
                      {item.monthlyLimitMinor === undefined ? (
                        <span className={styles.muted}>No limit</span>
                      ) : (
                        <>
                          <span>
                            {activePercent}% of {formatMinor(item.monthlyLimitMinor, item.currency)}
                          </span>
                          <span
                            className={styles.track}
                            aria-label={`${activePercent}% of limit used`}
                          >
                            <span
                              className={isOver ? styles.overTrack : undefined}
                              style={{ width: `${activePercent}%` }}
                            />
                          </span>
                        </>
                      )}
                    </span>
                    <span className={styles.activity}>{dateLabel(item.lastActivityAt)}</span>
                    <ArrowRight size={17} className={styles.arrow} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <aside className={styles.note}>
        <span className={styles.noteIcon}>
          <Tag size={17} aria-hidden="true" />
        </span>
        <div>
          <strong>Keep limits close to your habits</strong>
          <p>Category limits use the currency and monthly amount saved with each category.</p>
        </div>
        <button type="button" onClick={onOpenAnalytics}>
          Explore activity <ArrowRight size={15} aria-hidden="true" />
        </button>
      </aside>
    </main>
  );
}

function Summary({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: string;
}) {
  return (
    <article className={styles.metric} data-tone={tone}>
      <span className={styles.metricMark}>
        <Tag size={17} aria-hidden="true" />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}
