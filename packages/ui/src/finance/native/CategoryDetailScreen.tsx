import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  ArrowLeft,
  CalendarDays,
  ClockCounterClockwise as Clock3,
  ReceiptText,
  TrendUp as TrendingUp,
} from '@finapp/ui/icons/native';
import {
  Button,
  Empty,
  IconButton,
  Input,
  Label,
  Sheet,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import { CategoryEmojiPicker } from './CategoryEmojiPicker';
import { BudgetProgress } from './BudgetProgress';
import { TransactionRow } from './TransactionRow';
import { formatTransactionDate } from '../datetime';

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
  limitValue: string;
  isDefaultExpense: boolean;
  isDefaultIncome: boolean;
  confirmingArchive: boolean;
  onBack: () => void;
  onAddTransaction: () => void;
  onOpenTransaction: (id: string) => void;
  onEditName: () => void;
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

export function CategoryDetailScreen({
  category,
  profile,
  transactions,
  currency,
  loading = false,
  error,
  pending = false,
  formError,
  limitValue,
  isDefaultExpense,
  isDefaultIncome,
  confirmingArchive,
  onBack,
  onAddTransaction,
  onOpenTransaction,
  onEditName,
  onIconChange,
  onLimitChange,
  onSaveLimit,
  onClearLimit,
  onToggleDefault,
  onRequestArchive,
  onConfirmArchive,
  onCancelArchive,
}: CategoryDetailScreenProps) {
  const { tokens } = useTheme();
  const [period, setPeriod] = useState<DetailPeriod>('month');
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense');
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let startAt: number;
  let endAt: number;
  if (period === 'week') {
    startAt = Date.UTC(y, m, now.getUTCDate() - 6);
    endAt = Date.UTC(y, m, now.getUTCDate() + 1);
  } else if (period === 'month') {
    startAt = Date.UTC(y, m, 1);
    endAt = Date.UTC(y, m + 1, 1);
  } else {
    startAt = Date.UTC(y, 0, 1);
    endAt = Date.UTC(y, m, now.getUTCDate() + 1);
  }
  const valid = transactions
    .filter((row) => row.status === 'posted' && row.deletedAt === undefined)
    .slice()
    .sort((a, b) => b.occurredAt - a.occurredAt);
  const inPeriod = valid.filter(
    (row) => row.occurredAt >= startAt && row.occurredAt < endAt && row.currency === currency,
  );
  const monthStart = Date.UTC(y, m, 1);
  const monthEnd = Date.UTC(y, m + 1, 1);
  const inMonth = valid.filter(
    (row) => row.occurredAt >= monthStart && row.occurredAt < monthEnd && row.currency === currency,
  );
  const totalFor = (rows: readonly CategoryDetailTransaction[], type: 'expense' | 'income') =>
    rows.filter((row) => row.type === type).reduce((sum, row) => sum + row.amountMinor, 0n);
  const spent = totalFor(inPeriod, 'expense');
  const received = totalFor(inPeriod, 'income');
  const monthlySpent = totalFor(inMonth, 'expense');
  const monthlyIncome = totalFor(inMonth, 'income');
  const limit = category?.monthlyLimitMinor;
  const monthlyExpenseTransactions = inMonth.filter((row) => row.type === 'expense');
  const averageExpense = monthlyExpenseTransactions.length
    ? monthlySpent / BigInt(monthlyExpenseTransactions.length)
    : 0n;
  const biggestExpense = monthlyExpenseTransactions.reduce(
    (max, row) => (row.amountMinor > max ? row.amountMinor : max),
    0n,
  );
  const remaining = limit === undefined ? undefined : limit - monthlySpent;
  const remainingNote =
    remaining === undefined
      ? 'Set a monthly limit'
      : remaining < 0n
        ? 'Over monthly limit'
        : remaining === 0n
          ? 'Limit reached'
          : `${Number((remaining * 100n) / limit!)}% left`;
  const limitUsed = limit && limit > 0n ? Math.min(100, Number((monthlySpent * 100n) / limit)) : 0;
  const buckets = Array.from({ length: period === 'week' ? 7 : 12 }, (_, index) => {
    if (period === 'year') {
      const from = Date.UTC(y, index, 1);
      const until = Date.UTC(y, index + 1, 1);
      return {
        label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(from),
        key: from,
        value: inPeriod
          .filter(
            (row) => row.occurredAt >= from && row.occurredAt < until && row.type === chartType,
          )
          .reduce((sum, row) => sum + row.amountMinor, 0n),
      };
    }
    if (period === 'week') {
      const from = Date.UTC(y, m, now.getUTCDate() - 6 + index);
      const until = from + dayMs;
      return {
        label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(from),
        key: from,
        value: inPeriod
          .filter(
            (row) => row.occurredAt >= from && row.occurredAt < until && row.type === chartType,
          )
          .reduce((sum, row) => sum + row.amountMinor, 0n),
      };
    }
    const monthLength = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const dayNumber = Math.floor((index * monthLength) / 12) + 1;
    const lastDay = Math.floor(((index + 1) * monthLength) / 12) + 1;
    const from = Date.UTC(y, m, dayNumber);
    const until = Date.UTC(y, m, lastDay);
    return {
      label: String(dayNumber),
      key: from,
      value: inPeriod
        .filter(
          (row) =>
            row.occurredAt >= from &&
            row.occurredAt < Math.max(until, from + dayMs) &&
            row.type === chartType,
        )
        .reduce((sum, row) => sum + row.amountMinor, 0n),
    };
  });
  const maxBucket = buckets.reduce((max, item) => (item.value > max ? item.value : max), 0n);
  const merchantTotals = new Map<string, { amount: bigint; count: number }>();
  for (const transaction of inPeriod) {
    if (transaction.type !== 'expense') continue;
    const key = transaction.merchant?.trim() || transaction.title;
    const total = merchantTotals.get(key) ?? { amount: 0n, count: 0 };
    total.amount += transaction.amountMinor;
    total.count += 1;
    merchantTotals.set(key, total);
  }
  const merchants = [...merchantTotals]
    .sort((left, right) =>
      left[1].amount === right[1].amount
        ? left[0].localeCompare(right[0])
        : left[1].amount > right[1].amount
          ? -1
          : 1,
    )
    .slice(0, 6);
  const periodLabel =
    period === 'week' ? 'This week' : period === 'year' ? 'This year' : 'This month';
  const dateUpdated = category?.updatedAt
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(category.updatedAt)
    : 'Not available';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <IconButton label="Back to categories" variant="ghost" onPress={onBack}>
          <ArrowLeft size={20} color={tokens.foreground} />
        </IconButton>
        {category && <CategoryIcon label={category.name} icon={category.icon} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
            CATEGORIES /
          </Typography>
          <Typography variant="title" numberOfLines={1} style={{ fontSize: 22 }}>
            {category?.name ?? 'Category'}
          </Typography>
          <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
            Spending, limits, defaults, and activity.
          </Typography>
        </View>
        {category && !category.isSystem && category.archivedAt === undefined && (
          <Button size="sm" variant="ghost" onPress={onEditName}>
            Edit
          </Button>
        )}
      </View>
      {category && category.archivedAt === undefined && (
        <View style={styles.iconPicker}>
          <CategoryEmojiPicker value={category.icon} onChange={onIconChange} />
          <Button size="sm" onPress={onAddTransaction}>
            <Typography variant="caption" style={{ color: tokens.primaryForeground }}>
              Add transaction
            </Typography>
          </Button>
        </View>
      )}
      {error ? (
        <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {error}
        </Typography>
      ) : null}
      {formError ? (
        <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {formError}
        </Typography>
      ) : null}
      {loading ? (
        <Typography
          variant="small"
          accessibilityLiveRegion="polite"
          style={{ color: tokens.foregroundMuted, paddingVertical: 24 }}
        >
          Loading category activity…
        </Typography>
      ) : !category ? (
        <Empty
          title="Category unavailable."
          description="This category could not be found or is no longer available."
        />
      ) : (
        <>
          {category.archivedAt !== undefined && (
            <View style={[styles.archived, { borderColor: tokens.warning }]}>
              <Typography variant="small">
                Archived category · past transactions remain available.
              </Typography>
            </View>
          )}
          <View style={styles.metrics}>
            <Metric
              label="Spent this month"
              value={formatMinor(monthlySpent, currency)}
              note="Current calendar month"
              color={tokens.expense}
            />
            <Metric
              label="Received this month"
              value={formatMinor(monthlyIncome, currency)}
              note="Current calendar month"
              color={tokens.income}
            />
            <Metric
              label="Monthly limit"
              value={
                limit === undefined
                  ? 'Not set'
                  : formatMinor(limit, category.limitCurrency ?? currency)
              }
              note={limit === undefined ? 'Set a limit below' : `${limitUsed}% used this month`}
              color={tokens.warning}
            />
            <Metric
              label="Remaining"
              value={
                remaining === undefined
                  ? 'Not set'
                  : formatMinor(remaining, category.limitCurrency ?? currency)
              }
              note={remainingNote}
              color={remaining !== undefined && remaining < 0n ? tokens.expense : tokens.primary}
            />
          </View>
          <View style={styles.card}>
            <View style={styles.panelHeading}>
              <View style={{ flex: 1 }}>
                <Typography variant="heading">Category analytics</Typography>
                <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                  {category.name} · {periodLabel.toLowerCase()}
                </Typography>
              </View>
              <View style={styles.switches}>
                {(['week', 'month', 'year'] as const).map((item) => (
                  <TouchableOpacity
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: period === item }}
                    onPress={() => setPeriod(item)}
                    style={[
                      styles.switch,
                      { backgroundColor: period === item ? tokens.primary : 'transparent' },
                    ]}
                  >
                    <Typography
                      variant="caption"
                      style={{
                        color: period === item ? tokens.primaryForeground : tokens.foregroundMuted,
                      }}
                    >
                      {item[0]!.toUpperCase() + item.slice(1)}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.typeSwitch}>
              {(['expense', 'income'] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chartType === item }}
                  onPress={() => setChartType(item)}
                  style={[
                    styles.typeOption,
                    { borderColor: chartType === item ? tokens.primary : tokens.borderSubtle },
                  ]}
                >
                  <Typography
                    variant="caption"
                    style={{ color: chartType === item ? tokens.primary : tokens.foregroundMuted }}
                  >
                    {item === 'expense' ? 'Expenses' : 'Income'}
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>
            {inPeriod.length ? (
              <View style={styles.chart} accessibilityLabel={`${chartType} category activity`}>
                <View style={[styles.chartGridline, { top: '0%' }]} />
                <View style={[styles.chartGridline, { top: '50%' }]} />
                {buckets.map((bucket) => (
                  <View key={bucket.key} style={styles.barColumn}>
                    <View style={styles.barSpace}>
                      <View
                        style={{
                          width: '54%',
                          minHeight: bucket.value > 0n ? 3 : 0,
                          height: `${maxBucket > 0n ? Math.max(2, Number((bucket.value * 10000n) / maxBucket) / 100) : 0}%`,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                          backgroundColor: chartType === 'income' ? tokens.income : tokens.expense,
                        }}
                      />
                    </View>
                    <Typography
                      variant="caption"
                      style={{ fontSize: 9, color: tokens.foregroundMuted }}
                    >
                      {bucket.label}
                    </Typography>
                  </View>
                ))}
              </View>
            ) : (
              <FinanceEmptyState
                kind="analytics"
                title="No activity in this range."
                description="Posted transactions will appear in this category chart when available."
                compact
              />
            )}
            <View style={styles.chartFooter}>
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                {periodLabel}
              </Typography>
              <Typography
                variant="bodyLarge"
                style={{ color: chartType === 'income' ? tokens.income : tokens.expense }}
              >
                {formatMinor(chartType === 'income' ? received : spent, currency)}
              </Typography>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.panelHeading}>
              <View style={{ flex: 1 }}>
                <Typography variant="heading">Limit usage</Typography>
                <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                  Current calendar month
                </Typography>
              </View>
              <Clock3 size={18} color={tokens.foregroundMuted} />
            </View>
            {limit === undefined ? (
              <View style={styles.noLimit}>
                <Typography variant="title" style={{ color: tokens.foregroundMuted }}>
                  —
                </Typography>
                <Typography variant="bodyLarge">No monthly limit set</Typography>
              </View>
            ) : (
              <>
                <View style={styles.limitSummary}>
                  <View style={styles.limitRing}>
                    <Svg width="100%" height="100%" viewBox="0 0 120 120">
                      <Circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke={tokens.borderSubtle}
                        strokeWidth="12"
                      />
                      <Circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke={tokens.warning}
                        strokeWidth="12"
                        strokeDasharray={`${(2 * Math.PI * 48 * limitUsed) / 100} ${2 * Math.PI * 48}`}
                        rotation={-90}
                        origin="60, 60"
                      />
                    </Svg>
                    <View style={styles.ringText}>
                      <Typography variant="bodyLarge">{limitUsed}%</Typography>
                      <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                        used
                      </Typography>
                    </View>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Typography variant="bodyLarge">
                      {formatMinor(monthlySpent, category.limitCurrency ?? currency)}
                    </Typography>
                    <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                      of {formatMinor(limit, category.limitCurrency ?? currency)}
                    </Typography>
                  </View>
                </View>
                <BudgetProgress
                  spentMinor={monthlySpent}
                  limitMinor={limit}
                  currency={category.limitCurrency ?? currency}
                  title="This month"
                  primary
                />
              </>
            )}
            <View style={[styles.limitStats, { borderTopColor: tokens.borderSubtle }]}>
              <View style={[styles.limitStat, { borderBottomColor: tokens.borderSubtle }]}>
                <ReceiptText size={16} color={tokens.foregroundMuted} />
                <Typography variant="caption" style={styles.limitStatLabel}>
                  Average transaction
                </Typography>
                <Typography variant="caption">{formatMinor(averageExpense, currency)}</Typography>
              </View>
              <View style={[styles.limitStat, { borderBottomColor: tokens.borderSubtle }]}>
                <CalendarDays size={16} color={tokens.foregroundMuted} />
                <Typography variant="caption" style={styles.limitStatLabel}>
                  Total transactions
                </Typography>
                <Typography variant="caption">{monthlyExpenseTransactions.length}</Typography>
              </View>
              <View style={styles.limitStat}>
                <TrendingUp size={16} color={tokens.foregroundMuted} />
                <Typography variant="caption" style={styles.limitStatLabel}>
                  Biggest expense
                </Typography>
                <Typography variant="caption">{formatMinor(biggestExpense, currency)}</Typography>
              </View>
            </View>
            {category.archivedAt === undefined && (
              <View style={styles.limitForm}>
                <Label>
                  {limit === undefined ? 'Set a monthly limit' : 'Change monthly limit'} ·{' '}
                  {currency}
                </Label>
                <Input
                  accessibilityLabel={`Monthly limit in ${currency}`}
                  keyboardType="decimal-pad"
                  value={limitValue}
                  onChangeText={onLimitChange}
                  placeholder="Amount"
                />
                <View style={styles.inlineButtons}>
                  <Button size="sm" disabled={pending || !limitValue.trim()} onPress={onSaveLimit}>
                    Save limit
                  </Button>
                  {limit !== undefined && (
                    <Button size="sm" variant="outline" disabled={pending} onPress={onClearLimit}>
                      Clear limit
                    </Button>
                  )}
                </View>
              </View>
            )}
          </View>
          <View style={styles.card}>
            <View style={styles.panelHeading}>
              <View>
                <Typography variant="heading">Category details</Typography>
                <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                  Preferences and defaults
                </Typography>
              </View>
              <CalendarDays size={18} color={tokens.foregroundMuted} />
            </View>
            <DetailRow label="Kind" value={category.kind === 'income' ? 'Income' : 'Expense'} />
            <DetailRow
              label="Limit"
              value={
                limit === undefined
                  ? 'Not set'
                  : formatMinor(limit, category.limitCurrency ?? currency)
              }
            />
            <DetailRow
              label="Default for expenses"
              value={profile ? (isDefaultExpense ? 'Yes' : 'No') : 'Unavailable'}
            />
            <DetailRow
              label="Default for income"
              value={profile ? (isDefaultIncome ? 'Yes' : 'No') : 'Unavailable'}
            />
            <DetailRow label="Emoji" value={category.icon ?? 'No emoji'} />
            <DetailRow label="Last updated" value={dateUpdated} />
            {profile ? (
              <View style={styles.defaultActions}>
                <Button
                  size="sm"
                  variant={isDefaultExpense ? 'outline' : 'ghost'}
                  disabled={pending || category.archivedAt !== undefined}
                  onPress={() => onToggleDefault('expense')}
                >
                  {isDefaultExpense ? 'Remove expense default' : 'Set expense default'}
                </Button>
                <Button
                  size="sm"
                  variant={isDefaultIncome ? 'outline' : 'ghost'}
                  disabled={pending || category.archivedAt !== undefined}
                  onPress={() => onToggleDefault('income')}
                >
                  {isDefaultIncome ? 'Remove income default' : 'Set income default'}
                </Button>
              </View>
            ) : (
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                Default preferences are unavailable.
              </Typography>
            )}
          </View>
          <View style={styles.card}>
            <View style={styles.panelHeading}>
              <View>
                <Typography variant="heading">Top merchants</Typography>
                <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                  By posted expense in this period
                </Typography>
              </View>
              <TrendingUp size={18} color={tokens.foregroundMuted} />
            </View>
            {merchants.length ? (
              merchants.map(([name, total], index) => (
                <View key={name} style={styles.merchant}>
                  <Typography
                    variant="caption"
                    style={{ width: 24, color: tokens.foregroundMuted }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 13 }}>
                      {name}
                    </Typography>
                    <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                      {total.count} {total.count === 1 ? 'transaction' : 'transactions'}
                    </Typography>
                  </View>
                  <Typography variant="caption">{formatMinor(total.amount, currency)}</Typography>
                </View>
              ))
            ) : (
              <FinanceEmptyState
                kind="analytics"
                title="No merchant details this period."
                description="Merchant information will appear here when transactions include it."
                compact
              />
            )}
          </View>
          <View style={styles.card}>
            <View style={styles.panelHeading}>
              <View>
                <Typography variant="heading">Recent transactions</Typography>
                <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                  {inPeriod.length} {periodLabel.toLowerCase()}
                </Typography>
              </View>
              <ReceiptText size={18} color={tokens.foregroundMuted} />
            </View>
            {valid.length ? (
              valid
                .slice(0, 10)
                .map((item) => (
                  <TransactionRow
                    key={item.id}
                    title={item.title}
                    merchant={item.merchant}
                    category={category.name}
                    categoryIcon={category.icon}
                    account={item.account}
                    amountMinor={item.amountMinor}
                    currency={item.currency}
                    type={item.type as 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment'}
                    date={formatTransactionDate(item.occurredAt, item.hasTime, profile?.timezone)}
                    semanticType={item.groupId ? 'split' : undefined}
                    onPress={() => onOpenTransaction(item.id)}
                  />
                ))
            ) : (
              <FinanceEmptyState
                kind="category"
                title="No transactions in this category."
                description="Choose this category when adding income or spending to see activity here."
                action={
                  <Button size="sm" onPress={onAddTransaction}>
                    Add transaction
                  </Button>
                }
                compact
              />
            )}
          </View>
          {category.archivedAt === undefined && !category.isSystem && (
            <Button variant="destructive" onPress={onRequestArchive}>
              Archive category
            </Button>
          )}
        </>
      )}
      <Sheet visible={confirmingArchive} title="Archive category?" onClose={onCancelArchive}>
        <Typography variant="small" style={{ marginBottom: 12, color: tokens.foregroundMuted }}>
          Past transactions remain in your history. This category will no longer appear in new
          transactions.
        </Typography>
        <Button variant="destructive" disabled={pending} onPress={onConfirmArchive}>
          Archive {category?.name ?? 'category'}
        </Button>
        <Button variant="outline" onPress={onCancelArchive}>
          Keep category
        </Button>
      </Sheet>
    </ScrollView>
  );
}

function Metric({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.metric,
        { backgroundColor: tokens.surfaceRaised, borderColor: tokens.borderSubtle },
      ]}
    >
      <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
        {label}
      </Typography>
      <Typography variant="bodyLarge" numberOfLines={1} style={{ color, fontSize: 15 }}>
        {value}
      </Typography>
      <Typography variant="caption" numberOfLines={1} style={{ color: tokens.foregroundSubtle }}>
        {note}
      </Typography>
    </View>
  );
}
function DetailRow({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.detailRow, { borderBottomColor: tokens.borderSubtle }]}>
      <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
        {label}
      </Typography>
      <Typography variant="caption" numberOfLines={1} style={{ maxWidth: '58%' }}>
        {value}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 40, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  archived: { padding: 10, borderWidth: 1, borderRadius: 10, backgroundColor: '#f2be4e12' },
  inlineButtons: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: '44%',
    minHeight: 83,
    padding: 10,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    gap: 4,
  },
  card: {
    padding: 13,
    borderWidth: 1,
    borderColor: '#292d29',
    borderRadius: 14,
    backgroundColor: '#0b0d0b',
    gap: 7,
  },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  switches: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 9,
    backgroundColor: '#080a08',
  },
  switch: {
    minHeight: 29,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: 7,
  },
  typeSwitch: { flexDirection: 'row', gap: 7 },
  typeOption: {
    minHeight: 29,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderWidth: 1,
    borderRadius: 8,
  },
  chart: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#292d29',
    paddingTop: 4,
  },
  chartGridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#292d29',
  },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barSpace: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  chartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 5,
  },
  limitSummary: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 3 },
  limitRing: { width: 94, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', alignItems: 'center' },
  noLimit: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  limitForm: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#292d29',
  },
  limitStats: { marginTop: 5, paddingTop: 5, borderTopWidth: StyleSheet.hairlineWidth },
  limitStat: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  limitStatLabel: { flex: 1, color: '#a3a8a3' },
  detailRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  defaultActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 5 },
  merchant: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#292d29',
  },
});
