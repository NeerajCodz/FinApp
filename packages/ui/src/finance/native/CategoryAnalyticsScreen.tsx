import React, { useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChartLineUp as BarChart3, MagnifyingGlass as Search, ReceiptText as Tag, Wallet } from '@finapp/ui/icons/native';
import { Empty, Input, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import { FinanceBrand } from './FinanceBrand';

export type AnalyticsCategory = { id: string; name: string; icon?: string; kind: 'expense' | 'income'; currency: string; monthlyLimitMinor?: bigint };
export type AnalyticsAccount = { id: string; name: string; currency?: string };
export type AnalyticsTransaction = { id: string; categoryId?: string; accountId?: string; amountMinor: bigint; currency: string; type: string; title: string; merchant?: string; occurredAt: number; status: string; deletedAt?: number };
export type AnalyticsBudget = { id: string; categoryId?: string; amountMinor: bigint; currency: string; period: string; startAt: number; endAt: number; archivedAt?: number };
export type CategoryAnalyticsScreenProps = {
  categories: readonly AnalyticsCategory[];
  accounts: readonly AnalyticsAccount[];
  transactions: readonly AnalyticsTransaction[];
  budgets: readonly AnalyticsBudget[];
  defaultCurrency: string;
  loading?: boolean;
  error?: string;
  onOpenCategory: (id: string) => void;
};
type Period = 'week' | 'month' | 'year';
type Scope = 'all' | 'expense' | 'income' | 'with-limit';
const palette = ['#ff697a', '#ffa347', '#5e9bff', '#a785ff', '#f4d34e', '#48d79b', '#57d9d0', '#b7ff4a'];
const day = 86_400_000;

export function CategoryAnalyticsScreen({ categories, accounts, transactions, budgets, defaultCurrency, loading = false, error, onOpenCategory }: CategoryAnalyticsScreenProps) {
  const { tokens } = useTheme();
  const [period, setPeriod] = useState<Period>('month');
  const [scope, setScope] = useState<Scope>('all');
  const [accountId, setAccountId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [search, setSearch] = useState('');
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let startAt: number;
  let endAt: number;
  let previousStartAt: number;
  let previousEndAt: number;
  if (period === 'week') {
    endAt = Date.UTC(y, m, now.getUTCDate() + 1);
    startAt = endAt - day * 7;
    previousEndAt = startAt;
    previousStartAt = previousEndAt - day * 7;
  } else if (period === 'month') {
    startAt = Date.UTC(y, m, 1);
    endAt = Date.UTC(y, m + 1, 1);
    previousStartAt = Date.UTC(y, m - 1, 1);
    previousEndAt = startAt;
  } else {
    startAt = Date.UTC(y, 0, 1);
    endAt = Date.UTC(y, m, now.getUTCDate() + 1);
    previousStartAt = Date.UTC(y - 1, 0, 1);
    previousEndAt = startAt;
  }
  const currencyOptions = useMemo(() => [...new Set([defaultCurrency, ...categories.map((item) => item.currency), ...transactions.map((item) => item.currency)])].filter(Boolean), [categories, defaultCurrency, transactions]);
  const limitFor = (category: AnalyticsCategory, at = Date.now()) => {
    if (category.monthlyLimitMinor !== undefined) return category.monthlyLimitMinor;
    return budgets.find((item) => item.period === 'category' && item.categoryId === category.id && item.archivedAt === undefined && item.startAt <= at && item.endAt > at && item.currency === category.currency)?.amountMinor;
  };
  const scopedCategories = categories.filter((item) => (categoryId === 'all' || item.id === categoryId) && (scope !== 'expense' || item.kind === 'expense') && (scope !== 'income' || item.kind === 'income') && (scope !== 'with-limit' || limitFor(item) !== undefined) && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const categoryById = new Map(scopedCategories.map((item) => [item.id, item]));
  const matchesAccount = (item: AnalyticsTransaction) => accountId === 'all' || item.accountId === accountId;
  const isValid = (item: AnalyticsTransaction, from: number, until: number) => item.status === 'posted' && item.deletedAt === undefined && (item.type === 'expense' || item.type === 'income') && item.occurredAt >= from && item.occurredAt < until && item.currency === currency && categoryById.has(item.categoryId ?? '') && matchesAccount(item);
  const currentTx = transactions.filter((item) => isValid(item, startAt, endAt));
  const previousTx = transactions.filter((item) => isValid(item, previousStartAt, previousEndAt));
  const monthStart = Date.UTC(y, m, 1);
  const monthEnd = Date.UTC(y, m + 1, 1);
  const monthSpentByCategory = new Map<string, bigint>();
  for (const transaction of transactions) {
    const category = categoryById.get(transaction.categoryId ?? '');
    if (!category || transaction.status !== 'posted' || transaction.deletedAt !== undefined || transaction.type !== 'expense' || transaction.occurredAt < monthStart || transaction.occurredAt >= monthEnd || transaction.currency !== category.currency || !matchesAccount(transaction)) continue;
    monthSpentByCategory.set(category.id, (monthSpentByCategory.get(category.id) ?? 0n) + transaction.amountMinor);
  }
  const summarize = (rows: readonly AnalyticsTransaction[]) => {
    const perCategory = new Map<string, { spent: bigint; received: bigint; count: number }>();
    let spent = 0n;
    let received = 0n;
    for (const row of rows) {
      const key = row.categoryId ?? '';
      const value = perCategory.get(key) ?? { spent: 0n, received: 0n, count: 0 };
      value.count += 1;
      if (row.type === 'expense') { value.spent += row.amountMinor; spent += row.amountMinor; }
      else { value.received += row.amountMinor; received += row.amountMinor; }
      perCategory.set(key, value);
    }
    return { spent, received, perCategory };
  };
  const current = summarize(currentTx);
  const previous = summarize(previousTx);
  const rows = scopedCategories.map((category) => {
    const total = current.perCategory.get(category.id) ?? { spent: 0n, received: 0n, count: 0 };
    const prior = previous.perCategory.get(category.id)?.spent ?? 0n;
    const change = prior > 0n ? Number((total.spent - prior) * 100n / prior) : null;
    return { ...category, ...total, change, monthSpent: monthSpentByCategory.get(category.id) ?? 0n, limitMinor: limitFor(category) };
  });
  const expenseRows = rows.filter((item) => item.spent > 0n).sort((a, b) => a.spent === b.spent ? a.name.localeCompare(b.name) : a.spent > b.spent ? -1 : 1);
  const incomeRows = rows.filter((item) => item.received > 0n).sort((a, b) => a.received > b.received ? -1 : 1);
  const limitsAtRisk = rows.filter((item) => item.limitMinor !== undefined && item.limitMinor > 0n && Number(item.monthSpent * 100n / item.limitMinor) >= 80).length;
  const expenseCount = rows.filter((item) => item.kind === 'expense').length;
  const average = expenseCount > 0 ? current.spent / BigInt(expenseCount) : 0n;
  const donutRows = expenseRows;
  const donutTotal = expenseRows.reduce((sum, item) => sum + item.spent, 0n);
  const circumference = 2 * Math.PI * 51;
  let offset = 0;
  const donutSegments = donutRows.map((item, index) => {
    const length = donutTotal > 0n ? circumference * Number(item.spent * 10000n / donutTotal) / 10000 : 0;
    const segment = { id: item.id, value: item.spent, color: palette[index % palette.length], length, offset };
    offset += length;
    return segment;
  });
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const from = Date.UTC(y, m - 5 + index, 1);
    const until = Date.UTC(y, m - 4 + index, 1);
    const values = scopedCategories.map((category) => ({ category, amount: transactions.filter((item) => item.status === 'posted' && item.deletedAt === undefined && item.type === 'expense' && item.categoryId === category.id && item.currency === currency && matchesAccount(item) && item.occurredAt >= from && item.occurredAt < until).reduce((sum, item) => sum + item.amountMinor, 0n) })).filter((item) => item.amount > 0n).sort((a, b) => a.amount > b.amount ? -1 : 1).slice(0, 6);
    return { start: from, label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(from), values, total: values.reduce((sum, item) => sum + item.amount, 0n) };
  });
  const maxMonth = monthly.reduce((max, item) => item.total > max ? item.total : max, 0n);
  const growing = [...rows].filter((item) => item.change !== null && item.change > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  const mostActive = [...rows].filter((item) => item.count > 0).sort((a, b) => b.count - a.count)[0];
  const inactive = rows.find((item) => item.count === 0);
  const highestIncome = incomeRows[0];
  const periodLabel = period === 'week' ? 'this week' : period === 'year' ? 'this year' : 'this month';
  const usageRows = rows.filter((item) => item.limitMinor !== undefined).sort((a, b) => a.name.localeCompare(b.name));
  const performanceRows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const tone = { expense: tokens.expense, income: tokens.income, accent: tokens.primary, violet: '#aa83ff', warning: tokens.warning };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <FinanceBrand />
      <View style={styles.heading}><Typography variant="title">Category analytics</Typography><Typography variant="small" style={{ color: tokens.foregroundMuted }}>See where money goes across your categories.</Typography></View>
      <View style={styles.search}><Search size={16} color={tokens.foregroundMuted}/><Input accessibilityLabel="Search categories" placeholder="Search categories" value={search} onChangeText={setSearch} style={styles.searchInput}/></View>
      <FilterRail label="Period" values={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]} value={period} onChange={(value) => setPeriod(value as Period)}/>
      <FilterRail label="Type" values={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'with-limit', label: 'With limit' }]} value={scope} onChange={(value) => setScope(value as Scope)}/>
      <FilterRail label="Account" values={[{ value: 'all', label: 'All accounts' }, ...accounts.map((item) => ({ value: item.id, label: item.name }))]} value={accountId} onChange={setAccountId}/>
      <FilterRail label="Category" values={[{ value: 'all', label: 'All categories' }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} value={categoryId} onChange={setCategoryId}/>
      {currencyOptions.length > 1 && <FilterRail label="Currency" values={currencyOptions.map((value) => ({ value, label: value }))} value={currency} onChange={setCurrency}/>}
      {error ? <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>{error}</Typography> : null}
      {loading ? <Typography variant="small" accessibilityLiveRegion="polite" style={{ color: tokens.foregroundMuted, paddingVertical: 28 }}>Loading category analytics…</Typography> : <>
        <View style={styles.metrics}><Metric label="Spent" value={formatMinor(current.spent, currency)} note={periodLabel} tone={tone.expense}/><Metric label="Received" value={formatMinor(current.received, currency)} note={`${incomeRows.length} income categories`} tone={tone.income}/><Metric label="Average category spend" value={formatMinor(average, currency)} note={`${expenseCount} expense categories`} tone={tone.violet}/><Metric label="Limits at risk" value={String(limitsAtRisk)} note="At least 80% used" tone={tone.warning}/></View>
        <View style={styles.card}><Section title="Expense distribution" note={periodLabel}/>{donutRows.length ? <View style={styles.donutLayout}><View style={styles.donut}><Svg width="100%" height="100%" viewBox="0 0 140 140"><Circle cx="70" cy="70" r="51" fill="none" stroke={tokens.borderSubtle} strokeWidth="15"/>{donutSegments.map((segment) => <Circle key={segment.id} cx="70" cy="70" r="51" fill="none" stroke={segment.color} strokeWidth="15" strokeDasharray={`${segment.length} ${circumference - segment.length}`} strokeDashoffset={-segment.offset} rotation={-90} origin="70, 70"/> )}</Svg><View style={styles.donutText}><Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 12 }}>{formatMinor(donutTotal, currency)}</Typography><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>Total spend</Typography></View></View><View style={styles.legend}>{donutRows.map((item, index) => <TouchableOpacity key={item.id} accessibilityRole="button" onPress={() => onOpenCategory(item.id)} style={styles.legendItem}><View style={[styles.dot, { backgroundColor: palette[index % palette.length] }]}/><Typography variant="caption" numberOfLines={1} style={{ flex: 1 }}>{item.name}</Typography><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>{donutTotal > 0n ? Number(item.spent * 100n / donutTotal) : 0}%</Typography><Typography variant="caption">{formatMinor(item.spent, currency)}</Typography></TouchableOpacity>)}</View></View> : <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>No posted expenses in this range.</Typography>}</View>
        <View style={styles.card}><Section title="Top categories by spend" note="Highest posted expenses"/>{expenseRows.slice(0, 6).map((item, index) => <TouchableOpacity key={item.id} accessibilityRole="button" onPress={() => onOpenCategory(item.id)} style={styles.ranked}><CategoryIcon label={item.name} icon={item.icon}/><Typography variant="caption" numberOfLines={1} style={{ width: 83 }}>{item.name}</Typography><View style={[styles.rankTrack, { backgroundColor: tokens.borderSubtle }]}><View style={{ width: `${Math.max(5, Number(item.spent * 100n / (expenseRows[0]?.spent || 1n)))}%`, height: 8, borderRadius: 6, backgroundColor: palette[index % palette.length] }}/></View><Typography variant="caption">{formatMinor(item.spent, currency)}</Typography></TouchableOpacity>)}{expenseRows.length === 0 && <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>No posted expenses in this range.</Typography>}</View>
        <View style={styles.card}><Section title="Monthly category spending" note="Last six months"/><View style={styles.monthChart}>{monthly.map((item) => <View key={item.start} style={styles.monthColumn}><View style={styles.stackedBar}>{item.values.slice().reverse().map((value) => <View key={value.category.id} style={{ height: `${maxMonth > 0n ? Math.max(2, Number(value.amount * 10000n / maxMonth) / 100) : 0}%`, backgroundColor: palette[scopedCategories.findIndex((category) => category.id === value.category.id) % palette.length] }}/>)}</View><Typography variant="caption" style={{ color: tokens.foregroundMuted, fontSize: 10 }}>{item.label}</Typography></View>)}</View></View>
        <View style={styles.card}><Section title="Category limit utilization" note="Current active category limits"/>{usageRows.length ? usageRows.map((item) => { const used = item.limitMinor && item.limitMinor > 0n ? Number(item.monthSpent * 100n / item.limitMinor) : 0; return <TouchableOpacity key={item.id} accessibilityRole="button" onPress={() => onOpenCategory(item.id)} style={styles.usageRow}><CategoryIcon label={item.name} icon={item.icon}/><View style={{ flex: 1, gap: 4 }}><View style={styles.usageLabel}><Typography variant="caption" numberOfLines={1} style={{ flex: 1 }}>{item.name}</Typography><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>{used}% of {formatMinor(item.limitMinor!, item.currency)}</Typography></View><View style={[styles.rankTrack, { backgroundColor: tokens.borderSubtle }]}><View style={{ width: `${Math.min(100, used)}%`, height: 6, borderRadius: 5, backgroundColor: used >= 80 ? tokens.warning : tokens.primary }}/></View></View></TouchableOpacity>; }) : <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>No active category limits are set.</Typography>}</View>
        <View style={styles.card}><Section title="Key insights" note="From selected filters and period"/><Insight icon={<ArrowDownRight size={18} color={tokens.expense}/>} label="Fastest growing" value={growing?.name ?? 'No increase to report'} note={growing ? `${growing.change}% above the prior period` : 'Not enough comparable activity'}/><Insight icon={<ArrowUpRight size={18} color={tokens.income}/>} label="Highest income" value={highestIncome?.name ?? 'No income this period'} note={highestIncome ? `${formatMinor(highestIncome.received, highestIncome.currency)} received` : 'No posted income in this range'}/><Insight icon={<Wallet size={18} color={tokens.primary}/>} label="Most active" value={mostActive?.name ?? 'No activity yet'} note={mostActive ? `${mostActive.count} posted transactions` : 'No category activity in this range'}/><Insight icon={<Tag size={18} color={tokens.foregroundMuted}/>} label="No activity" value={inactive?.name ?? 'All active'} note={inactive ? `No posted transactions ${periodLabel}` : 'Every active category has activity'}/></View>
        <View style={styles.card}><Section title="Category performance" note={periodLabel}/>{performanceRows.length ? performanceRows.map((item) => { const limitUse = item.limitMinor && item.limitMinor > 0n ? Number(item.monthSpent * 100n / item.limitMinor) : null; return <TouchableOpacity key={item.id} accessibilityRole="button" onPress={() => onOpenCategory(item.id)} style={styles.performanceRow}><CategoryIcon label={item.name} icon={item.icon}/><View style={{ flex: 1, minWidth: 0 }}><View style={styles.performanceTitle}><Typography variant="bodyLarge" numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>{item.name}</Typography><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>{item.count} tx</Typography></View><View style={styles.performanceAmounts}><Typography variant="caption" style={{ color: tokens.expense }}>{item.spent ? formatMinor(item.spent, currency) : '—'}</Typography><Typography variant="caption" style={{ color: tokens.income }}>{item.received ? formatMinor(item.received, currency) : '—'}</Typography><Typography variant="caption" style={{ color: item.change && item.change > 0 ? tokens.expense : tokens.income }}>{item.change === null ? '—' : `${item.change > 0 ? '↑' : item.change < 0 ? '↓' : '–'} ${Math.abs(item.change)}%`}</Typography></View>{limitUse !== null && <View style={[styles.rankTrack, { backgroundColor: tokens.borderSubtle }]}><View style={{ width: `${Math.min(100, limitUse)}%`, height: 4, borderRadius: 3, backgroundColor: limitUse >= 80 ? tokens.warning : tokens.primary }}/></View>}</View><ArrowRight size={16} color={tokens.foregroundSubtle}/></TouchableOpacity>; }) : <Empty title="No matching categories." description="Change the filters to see category performance."/>}</View>
      </>}
    </ScrollView>
  );
}

function FilterRail({ label, values, value, onChange }: { label: string; values: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  const { tokens } = useTheme();
  return <View style={styles.filterLine}><Typography variant="caption" style={styles.filterLabel}>{label}</Typography><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>{values.map((item) => <TouchableOpacity key={item.value} accessibilityRole="button" accessibilityState={{ selected: value === item.value }} onPress={() => onChange(item.value)} style={[styles.filterChip, { borderColor: value === item.value ? tokens.primary : tokens.borderSubtle, backgroundColor: value === item.value ? tokens.primary : tokens.surfaceRaised }]}><Typography variant="caption" numberOfLines={1} style={{ color: value === item.value ? tokens.primaryForeground : tokens.foreground }}>{item.label}</Typography></TouchableOpacity>)}</ScrollView></View>;
}
function Section({ title, note }: { title: string; note: string }) {
  const { tokens } = useTheme();
  return <View style={{ gap: 3, marginBottom: 10 }}><Typography variant="heading" style={{ fontSize: 15 }}>{title}</Typography><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>{note}</Typography></View>;
}
function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  const { tokens } = useTheme();
  return <View style={[styles.metric, { borderColor: tokens.borderSubtle, backgroundColor: tokens.surfaceRaised }]}><View style={[styles.metricIcon, { backgroundColor: `${tone}18` }]}><BarChart3 size={15} color={tone}/></View><Typography variant="caption" numberOfLines={1} style={{ color: tokens.foregroundMuted }}>{label}</Typography><Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}>{value}</Typography><Typography variant="caption" numberOfLines={1} style={{ color: tokens.foregroundSubtle, fontSize: 10 }}>{note}</Typography></View>;
}
function Insight({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  const { tokens } = useTheme();
  return <View style={[styles.insight, { borderColor: tokens.borderSubtle, backgroundColor: tokens.surfaceRaised }]}><View style={styles.insightIcon}>{icon}</View><View style={{ flex: 1, gap: 2 }}><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>{label}</Typography><Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 13 }}>{value}</Typography><Typography variant="caption" style={{ color: tokens.foregroundSubtle }}>{note}</Typography></View></View>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40, gap: 10 },
  heading: { gap: 2, marginBottom: 2 },
  search: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#323632', borderRadius: 12, backgroundColor: '#101210' },
  searchInput: { flex: 1, minHeight: 40, borderWidth: 0, paddingHorizontal: 0, backgroundColor: 'transparent' },
  filterLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { width: 62, color: '#9da19c' },
  filterRail: { flexDirection: 'row', gap: 6 },
  filterChip: { minHeight: 31, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderRadius: 9 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: { flex: 1, minWidth: '46%', minHeight: 91, padding: 10, borderWidth: 1, borderRadius: 13, gap: 4 },
  metricIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 2 },
  card: { padding: 13, borderWidth: 1, borderColor: '#292d29', borderRadius: 14, backgroundColor: '#0b0d0b', gap: 8 },
  donutLayout: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  donut: { width: 126, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  donutText: { position: 'absolute', alignItems: 'center', width: 75 },
  legend: { flex: 1, gap: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  ranked: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7 },
  rankTrack: { flex: 1, height: 8, overflow: 'hidden', borderRadius: 6 },
  monthChart: { height: 132, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-around', gap: 8, borderBottomWidth: 1, borderBottomColor: '#292d29' },
  monthColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  stackedBar: { width: 27, flex: 1, flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  usageLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, borderWidth: 1, borderRadius: 11, marginBottom: 3 },
  insightIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#ffffff0a' },
  performanceRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#282b28' },
  performanceTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  performanceAmounts: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 4, marginBottom: 5 },
});
