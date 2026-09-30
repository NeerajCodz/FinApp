'use client';

import React, { useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, ReceiptText, TrendingUp } from 'lucide-react';
import { Button, Empty, Input, Label, Sheet, Typography } from '@finapp/ui/web';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import { CategoryEmojiPicker } from './CategoryEmojiPicker';
import { BudgetProgress } from './BudgetProgress';
import { TransactionRow } from './TransactionRow';
import { formatTransactionDate } from '../datetime';
import styles from './CategoryDetailScreen.module.css';

export type CategoryDetailRecord = {
  id: string;
  name: string;
  icon?: string;
  kind: 'expense' | 'income';
  isSystem?: boolean;
  archivedAt?: number;
  monthlyLimitMinor?: bigint;
  limitCurrency?: string;
  updatedAt?: number;
};
export type CategoryDetailTransaction = {
  id: string;
  type: string;
  title: string;
  merchant?: string;
  account?: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: number;
  hasTime?: boolean;
  status: string;
  deletedAt?: number;
  groupId?: string;
};
export type CategoryDetailProfile = {
  timezone?: string;
  defaultExpenseCategoryId?: string;
  defaultIncomeCategoryId?: string;
};
export type CategoryDetailScreenProps = {
  category: CategoryDetailRecord | null;
  profile?: CategoryDetailProfile | null;
  transactions: readonly CategoryDetailTransaction[];
  currency: string;
  loading?: boolean;
  error?: string;
  pending?: boolean;
  formError?: string | null;
  editingName: boolean;
  nameValue: string;
  limitValue: string;
  isDefaultExpense: boolean;
  isDefaultIncome: boolean;
  confirmingArchive: boolean;
  onBack: () => void;
  onAddTransaction: () => void;
  onOpenTransaction: (id: string) => void;
  onEditName: () => void;
  onNameChange: (value: string) => void;
  onSaveName: () => void;
  onCancelName: () => void;
  onIconChange: (value?: string) => void;
  onLimitChange: (value: string) => void;
  onSaveLimit: () => void;
  onClearLimit: () => void;
  onToggleDefault: (type: 'expense' | 'income') => void;
  onRequestArchive: () => void;
  onConfirmArchive: () => void;
  onCancelArchive: () => void;
};

type DetailPeriod = 'week' | 'month' | 'year';
const dayMs = 86_400_000;
function selectedRange(period: DetailPeriod, now: Date): [number, number] {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (period === 'week')
    return [Date.UTC(y, m, now.getUTCDate() - 6), Date.UTC(y, m, now.getUTCDate() + 1)];
  if (period === 'month') return [Date.UTC(y, m, 1), Date.UTC(y, m + 1, 1)];
  return [Date.UTC(y, 0, 1), Date.UTC(y, m, now.getUTCDate() + 1)];
}
function amountTotal(
  rows: readonly CategoryDetailTransaction[],
  type: 'expense' | 'income',
  currency: string,
) {
  return rows
    .filter((row) => row.type === type && row.currency === currency)
    .reduce((sum, row) => sum + row.amountMinor, 0n);
}
function dateText(value?: number) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(value)
    : 'Not available';
}

export function CategoryDetailScreen({
  category,
  profile,
  transactions,
  currency,
  loading = false,
  error,
  pending = false,
  formError,
  editingName,
  nameValue,
  limitValue,
  isDefaultExpense,
  isDefaultIncome,
  confirmingArchive,
  onBack,
  onAddTransaction,
  onOpenTransaction,
  onEditName,
  onNameChange,
  onSaveName,
  onCancelName,
  onIconChange,
  onLimitChange,
  onSaveLimit,
  onClearLimit,
  onToggleDefault,
  onRequestArchive,
  onConfirmArchive,
  onCancelArchive,
}: CategoryDetailScreenProps) {
  const [period, setPeriod] = useState<DetailPeriod>('month');
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense');
  const now = new Date();
  const [startAt, endAt] = selectedRange(period, now);
  const validTransactions = transactions
    .filter((row) => row.status === 'posted' && row.deletedAt === undefined)
    .sort((a, b) => b.occurredAt - a.occurredAt);
  const inPeriod = validTransactions.filter(
    (row) => row.occurredAt >= startAt && row.occurredAt < endAt && row.currency === currency,
  );
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const thisMonth = validTransactions.filter(
    (row) => row.occurredAt >= monthStart && row.occurredAt < monthEnd && row.currency === currency,
  );
  const spent = amountTotal(inPeriod, 'expense', currency);
  const received = amountTotal(inPeriod, 'income', currency);
  const monthlySpent = amountTotal(thisMonth, 'expense', currency);
  const monthlyIncome = amountTotal(thisMonth, 'income', currency);
  const monthlyLimit = category?.monthlyLimitMinor;
  const monthlyExpenseTransactions = thisMonth.filter((row) => row.type === 'expense');
  const averageExpense = monthlyExpenseTransactions.length
    ? monthlySpent / BigInt(monthlyExpenseTransactions.length)
    : 0n;
  const biggestExpense = monthlyExpenseTransactions.reduce(
    (max, row) => (row.amountMinor > max ? row.amountMinor : max),
    0n,
  );
  const remaining = monthlyLimit === undefined ? undefined : monthlyLimit - monthlySpent;
  const remainingNote =
    remaining === undefined
      ? 'Set a monthly limit'
      : remaining < 0n
        ? 'Over monthly limit'
        : remaining === 0n
          ? 'Limit reached'
          : `${Number((remaining * 100n) / monthlyLimit!)}% left`;
  const limitUsed =
    monthlyLimit && monthlyLimit > 0n
      ? Math.min(100, Number((monthlySpent * 100n) / monthlyLimit))
      : 0;
  const buckets = Array.from({ length: period === 'week' ? 7 : 12 }, (_, index) => {
    if (period === 'year') {
      const start = Date.UTC(now.getUTCFullYear(), index, 1);
      const end = Date.UTC(now.getUTCFullYear(), index + 1, 1);
      const value = inPeriod
        .filter((row) => row.occurredAt >= start && row.occurredAt < end && row.type === chartType)
        .reduce((sum, row) => sum + row.amountMinor, 0n);
      return {
        label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(start),
        value,
        key: start,
      };
    }
    if (period === 'week') {
      const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6 + index);
      const end = start + dayMs;
      const value = inPeriod
        .filter((row) => row.occurredAt >= start && row.occurredAt < end && row.type === chartType)
        .reduce((sum, row) => sum + row.amountMinor, 0n);
      return {
        label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(start),
        value,
        key: start,
      };
    }
    const totalDays = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const fromDay = Math.floor((index * totalDays) / 12) + 1;
    const toDay = Math.floor(((index + 1) * totalDays) / 12) + 1;
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), fromDay);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), toDay);
    const value = inPeriod
      .filter(
        (row) =>
          row.occurredAt >= start &&
          row.occurredAt < Math.max(end, start + dayMs) &&
          row.type === chartType,
      )
      .reduce((sum, row) => sum + row.amountMinor, 0n);
    return { label: String(fromDay), value, key: start };
  });
  const maxBucket = buckets.reduce((max, bucket) => (bucket.value > max ? bucket.value : max), 0n);
  const merchants = new Map<string, { total: bigint; count: number }>();
  for (const row of inPeriod) {
    if (row.type !== 'expense') continue;
    const label = row.merchant?.trim() || row.title;
    const aggregate = merchants.get(label) ?? { total: 0n, count: 0 };
    aggregate.total += row.amountMinor;
    aggregate.count += 1;
    merchants.set(label, aggregate);
  }
  const topMerchants = [...merchants]
    .sort((a, b) =>
      a[1].total === b[1].total ? a[0].localeCompare(b[0]) : a[1].total > b[1].total ? -1 : 1,
    )
    .slice(0, 6);
  const periodLabel =
    period === 'week' ? 'This week' : period === 'year' ? 'This year' : 'This month';

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <button
            type="button"
            className={styles.back}
            onClick={onBack}
            aria-label="Back to categories"
          >
            <ArrowLeft size={18} />
          </button>
          {category && <CategoryIcon label={category.name} icon={category.icon} />}
          <div className={styles.titleCopy}>
            <small>
              <button type="button" onClick={onBack}>
                Categories
              </button>
              <span>/</span>Category
            </small>
            <Typography variant="title">{category?.name ?? 'Category'}</Typography>
            <p>Track spending, limits, defaults, and recent activity.</p>
          </div>
        </div>
        {category && (
          <div className={styles.headerActions}>
            {!category.isSystem && category.archivedAt === undefined && (
              <Button variant="outline" onPress={onEditName}>
                Edit name
              </Button>
            )}
            {category.archivedAt === undefined && (
              <CategoryEmojiPicker value={category.icon} onChange={onIconChange} compact />
            )}
            <Button onPress={onAddTransaction}>
              <span aria-hidden="true">＋</span> Add transaction
            </Button>
          </div>
        )}
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {formError && (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      )}
      {loading ? (
        <div className={styles.loading} role="status">
          Loading category activity…
        </div>
      ) : !category ? (
        <Empty
          title="Category unavailable."
          description="This category could not be found or is no longer available."
        />
      ) : (
        <>
          {category.archivedAt !== undefined && (
            <p className={styles.archived}>
              This category is archived and remains available for older transactions.
            </p>
          )}
          {editingName && !category.isSystem && (
            <form
              className={styles.editName}
              onSubmit={(event) => {
                event.preventDefault();
                onSaveName();
              }}
            >
              <Label htmlFor="category-name">Category name</Label>
              <Input
                id="category-name"
                value={nameValue}
                onChangeText={onNameChange}
                maxLength={80}
                required
              />
              <div>
                <Button type="submit" disabled={pending || !nameValue.trim()}>
                  {pending ? 'Saving…' : 'Save name'}
                </Button>
                <Button type="button" variant="ghost" onPress={onCancelName}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
          <section className={styles.metrics} aria-label="Category totals">
            <Metric
              label="Spent this month"
              value={formatMinor(monthlySpent, currency)}
              note="Current calendar month"
              tone="expense"
            />
            <Metric
              label="Received this month"
              value={formatMinor(monthlyIncome, currency)}
              note="Current calendar month"
              tone="income"
            />
            <Metric
              label="Monthly limit"
              value={
                monthlyLimit === undefined
                  ? 'Not set'
                  : formatMinor(monthlyLimit, category.limitCurrency ?? currency)
              }
              note={
                monthlyLimit === undefined ? 'Add a limit below' : `${limitUsed}% used this month`
              }
              tone="warning"
            />
            <Metric
              label="Remaining"
              value={
                remaining === undefined
                  ? 'Not set'
                  : formatMinor(remaining, category.limitCurrency ?? currency)
              }
              note={remainingNote}
              tone={remaining !== undefined && remaining < 0n ? 'expense' : 'lime'}
            />
          </section>
          <section className={styles.contentGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <Typography variant="heading">Category analytics</Typography>
                  <p>
                    {category.name} · {periodLabel.toLowerCase()}
                  </p>
                </div>
                <div className={styles.controls}>
                  <div className={styles.switch} role="group" aria-label="Chart period">
                    {(['week', 'month', 'year'] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={period === item}
                        onClick={() => setPeriod(item)}
                      >
                        {item[0]!.toUpperCase() + item.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className={styles.switch} role="group" aria-label="Transaction type">
                    {(['expense', 'income'] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={chartType === item}
                        onClick={() => setChartType(item)}
                      >
                        {item === 'expense' ? 'Expenses' : 'Income'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {inPeriod.length === 0 ? (
                <p className={styles.noData}>No posted transactions in this range.</p>
              ) : (
                <div
                  className={styles.chart}
                  role="img"
                  aria-label={`${chartType} activity over ${periodLabel.toLowerCase()}`}
                >
                  {buckets.map((bucket) => (
                    <div className={styles.barColumn} key={bucket.key}>
                      <div className={styles.barTrack}>
                        <span
                          data-type={chartType}
                          style={{
                            height: `${maxBucket > 0n ? Math.max(2, Number((bucket.value * 10000n) / maxBucket) / 100) : 0}%`,
                          }}
                          title={formatMinor(bucket.value, currency)}
                        />
                      </div>
                      <small>{bucket.label}</small>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.chartFoot}>
                <span>{periodLabel}</span>
                <strong className={chartType === 'income' ? styles.incomeText : styles.expenseText}>
                  {formatMinor(chartType === 'income' ? received : spent, currency)}
                </strong>
              </div>
            </article>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <Typography variant="heading">Limit usage</Typography>
                  <p>Current calendar month</p>
                </div>
                <Clock3 size={18} aria-hidden="true" />
              </div>
              {monthlyLimit === undefined ? (
                <div className={styles.noLimit}>
                  <div className={styles.ring}>
                    <span>—</span>
                  </div>
                  <strong>No monthly limit set</strong>
                  <small>Add a limit to track how much remains.</small>
                </div>
              ) : (
                <div className={styles.limitContent}>
                  <div
                    className={styles.ring}
                    style={{ '--used': `${Math.min(100, limitUsed)}%` } as React.CSSProperties}
                  >
                    <span>
                      <strong>{limitUsed}%</strong>
                      <small>used</small>
                    </span>
                  </div>
                  <div>
                    <strong>{formatMinor(monthlySpent, category.limitCurrency ?? currency)}</strong>
                    <small>
                      of {formatMinor(monthlyLimit, category.limitCurrency ?? currency)}
                    </small>
                  </div>
                  <BudgetProgress
                    spentMinor={monthlySpent}
                    limitMinor={monthlyLimit}
                    currency={category.limitCurrency ?? currency}
                    title="This month"
                    primary
                  />{' '}
                </div>
              )}
              <div className={styles.limitStats}>
                <div>
                  <ReceiptText size={16} aria-hidden="true" />
                  <span>Average transaction</span>
                  <strong>{formatMinor(averageExpense, currency)}</strong>
                </div>
                <div>
                  <CalendarDays size={16} aria-hidden="true" />
                  <span>Total transactions</span>
                  <strong>{monthlyExpenseTransactions.length}</strong>
                </div>
                <div>
                  <TrendingUp size={16} aria-hidden="true" />
                  <span>Biggest expense</span>
                  <strong>{formatMinor(biggestExpense, currency)}</strong>
                </div>
              </div>
              {category.archivedAt === undefined && (
                <form
                  className={styles.limitForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSaveLimit();
                  }}
                >
                  <Label htmlFor="category-limit">
                    {monthlyLimit === undefined ? 'Set monthly limit' : 'Change monthly limit'} ·{' '}
                    {currency}
                  </Label>
                  <div>
                    <Input
                      id="category-limit"
                      type="number"
                      min="0.01"
                      step={currency === 'JPY' || currency === 'KRW' ? '1' : '0.01'}
                      value={limitValue}
                      onChangeText={onLimitChange}
                      placeholder="Amount"
                    />
                    <Button type="submit" disabled={pending || !limitValue.trim()}>
                      {pending ? 'Saving…' : 'Save limit'}
                    </Button>
                  </div>
                  {monthlyLimit !== undefined && (
                    <Button type="button" variant="ghost" disabled={pending} onPress={onClearLimit}>
                      Clear limit
                    </Button>
                  )}
                </form>
              )}
            </article>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <Typography variant="heading">Category details</Typography>
                  <p>Preferences and defaults</p>
                </div>
                <CalendarDays size={17} aria-hidden="true" />
              </div>
              <dl className={styles.details}>
                <Detail label="Kind" value={category.kind === 'income' ? 'Income' : 'Expense'} />
                <Detail
                  label="Monthly limit"
                  value={
                    monthlyLimit === undefined
                      ? 'Not set'
                      : formatMinor(monthlyLimit, category.limitCurrency ?? currency)
                  }
                />
                <Detail
                  label="Default for expenses"
                  value={profile ? (isDefaultExpense ? 'Yes' : 'No') : 'Unavailable'}
                />
                <Detail
                  label="Default for income"
                  value={profile ? (isDefaultIncome ? 'Yes' : 'No') : 'Unavailable'}
                />
                <Detail label="Emoji" value={category.icon ?? 'No emoji'} />
                <Detail label="Last updated" value={dateText(category.updatedAt)} />
              </dl>
              {profile ? (
                <div className={styles.defaults}>
                  <span>Default for expenses</span>
                  <Button
                    size="sm"
                    variant={isDefaultExpense ? 'outline' : 'ghost'}
                    disabled={pending || category.archivedAt !== undefined}
                    onPress={() => onToggleDefault('expense')}
                  >
                    {isDefaultExpense ? 'Remove default' : 'Set default'}
                  </Button>
                  <span>Default for income</span>
                  <Button
                    size="sm"
                    variant={isDefaultIncome ? 'outline' : 'ghost'}
                    disabled={pending || category.archivedAt !== undefined}
                    onPress={() => onToggleDefault('income')}
                  >
                    {isDefaultIncome ? 'Remove default' : 'Set default'}
                  </Button>
                </div>
              ) : (
                <p className={styles.noData}>Default preferences are unavailable.</p>
              )}
            </article>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <Typography variant="heading">Top merchants</Typography>
                  <p>By posted expense in this period</p>
                </div>
                <TrendingUp size={17} aria-hidden="true" />
              </div>
              {topMerchants.length ? (
                <div className={styles.merchants}>
                  {topMerchants.map(([name, value], index) => (
                    <div className={styles.merchant} key={name}>
                      <span className={styles.merchantIndex}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>
                        <strong>{name}</strong>
                        <small>
                          {value.count} {value.count === 1 ? 'transaction' : 'transactions'}
                        </small>
                      </span>
                      <b>{formatMinor(value.total, currency)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.noData}>No merchant details in this period.</p>
              )}
            </article>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <Typography variant="heading">Recent transactions</Typography>
                <p>
                  {inPeriod.length} posted {inPeriod.length === 1 ? 'transaction' : 'transactions'}{' '}
                  · {periodLabel.toLowerCase()}
                </p>
              </div>
              <ReceiptText size={18} aria-hidden="true" />
            </div>
            {validTransactions.length === 0 ? (
              <Empty
                title="No transactions in this category."
                description="Choose this category when adding income or spending to see activity here."
                action={<Button onPress={onAddTransaction}>Add transaction</Button>}
              />
            ) : (
              <div className={styles.transactions}>
                {validTransactions.slice(0, 10).map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    title={transaction.title}
                    merchant={transaction.merchant}
                    category={category.name}
                    categoryIcon={category.icon}
                    account={transaction.account}
                    amountMinor={transaction.amountMinor}
                    currency={transaction.currency}
                    type={
                      transaction.type as
                        'expense' | 'income' | 'transfer' | 'refund' | 'adjustment'
                    }
                    date={formatTransactionDate(
                      transaction.occurredAt,
                      transaction.hasTime,
                      profile?.timezone,
                    )}
                    semanticType={transaction.groupId ? 'split' : undefined}
                    onPress={() => onOpenTransaction(transaction.id)}
                  />
                ))}
              </div>
            )}
          </section>
          {category.archivedAt === undefined && !category.isSystem && (
            <Button variant="destructive" onPress={onRequestArchive}>
              Archive category
            </Button>
          )}
        </>
      )}
      <Sheet visible={confirmingArchive} title="Archive category?" onClose={onCancelArchive}>
        <p className={styles.archiveCopy}>
          Past transactions remain in your history. This category will no longer appear in new
          transactions.
        </p>
        <Button variant="destructive" disabled={pending} onPress={onConfirmArchive}>
          Archive {category?.name ?? 'category'}
        </Button>
        <Button variant="outline" onPress={onCancelArchive}>
          Keep category
        </Button>
      </Sheet>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className={styles.metric} data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
