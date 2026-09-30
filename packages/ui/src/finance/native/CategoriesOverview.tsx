import React, { useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View, StyleSheet } from 'react-native';
import { ArrowRight, ChartLineUp as BarChart3, Plus, MagnifyingGlass as Search, ReceiptText as Tag } from '@finapp/ui/icons/native';
import { Button, Empty, Input, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import { FinanceBrand } from './FinanceBrand';

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

export function CategoriesOverview({
  items,
  defaultCurrency,
  loading = false,
  error,
  onOpenCategory,
  onAddCategory,
  onOpenAnalytics,
}: CategoriesOverviewProps) {
  const { tokens } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const summary = useMemo(() => ({
    total: items.length,
    limited: items.filter((item) => item.monthlyLimitMinor !== undefined).length,
    recentSpendMinor: items.filter((item) => item.currency === defaultCurrency).reduce((total, item) => total + item.recentSpendMinor, 0n),
    inactive: items.filter((item) => item.lastActivityAt === undefined).length,
  }), [defaultCurrency, items]);
  const visible = items.filter((item) => {
    if (filter === 'expense' && item.kind !== 'expense') return false;
    if (filter === 'income' && item.kind !== 'income') return false;
    if (filter === 'with-limit' && item.monthlyLimitMinor === undefined) return false;
    return item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  const recentSpendLabel = formatMinor(summary.recentSpendMinor, defaultCurrency);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <FinanceBrand />
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}><Typography variant="title">Categories</Typography><Typography variant="small" style={{ color: tokens.foregroundMuted }}>A clear view of where money goes and where it comes from.</Typography></View>
        <View style={styles.actions}><Button size="sm" variant="outline" onPress={onOpenAnalytics}><BarChart3 size={16} color={tokens.foreground}/><Typography variant="small">Analytics</Typography></Button><Button size="sm" onPress={onAddCategory}><Plus size={16} color={tokens.primaryForeground}/><Typography variant="small" style={{ color: tokens.primaryForeground }}>Add</Typography></Button></View>
      </View>
      <View style={styles.search}><Search size={17} color={tokens.foregroundMuted}/><Input accessibilityLabel="Search categories" placeholder="Search categories" value={query} onChangeText={setQuery} style={styles.searchInput}/></View>
      {error ? <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>{error}</Typography> : null}
      <View style={styles.summary}>
        <Summary label="Active categories" value={summary.total} hint="Available now" tone="lime"/>
        <Summary label="Categories with limits" value={summary.limited} hint="Monthly limits set" tone="warning"/>
        <Summary label="Spent in last 30 days" value={recentSpendLabel} hint={defaultCurrency} tone="expense"/>
        <Summary label="No recent activity" value={summary.inactive} hint="In the last 30 days" tone="income"/>
      </View>
      <View style={styles.panel}>
        <View style={styles.panelTitle}><View style={{ flex: 1 }}><Typography variant="heading">Your categories</Typography><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>This month’s activity and saved limits.</Typography></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
          {filters.map((item) => <TouchableOpacity key={item.value} accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)} style={[styles.filter, { borderColor: filter === item.value ? tokens.primary : tokens.borderSubtle, backgroundColor: filter === item.value ? tokens.primary : 'transparent' }]}><Typography variant="caption" style={{ color: filter === item.value ? tokens.primaryForeground : tokens.foregroundMuted }}>{item.label}</Typography></TouchableOpacity>)}
        </ScrollView>
        {loading ? <Typography variant="small" accessibilityLiveRegion="polite" style={{ paddingVertical: 24, color: tokens.foregroundMuted }}>Loading your categories…</Typography> : items.length === 0 ? <Empty title="No categories yet." description="Create a category to organize your income and spending." action={<Button size="sm" onPress={onAddCategory}>Add category</Button>}/> : visible.length === 0 ? <Empty title="No matching categories." description="Try another search or filter."/> : <View>
          {visible.map((item, index) => {
            const used = item.monthlyLimitMinor && item.monthlyLimitMinor > 0n ? Math.min(100, Number(item.monthSpentMinor * 100n / item.monthlyLimitMinor)) : 0;
            const value = item.kind === 'income' ? item.monthReceivedMinor : item.monthSpentMinor;
            return <React.Fragment key={item.id}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${item.name} category`} activeOpacity={0.72} onPress={() => onOpenCategory(item.id)} style={styles.row}>
              <CategoryIcon label={item.name} icon={item.icon}/><View style={{ flex: 1, minWidth: 0, gap: 3 }}><Typography variant="bodyLarge" numberOfLines={1}>{item.name}</Typography><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>{item.transactionCount} {item.transactionCount === 1 ? 'transaction' : 'transactions'} this month</Typography></View>
              <View style={styles.rowValue}><Typography variant="small" style={{ color: item.kind === 'income' ? tokens.income : tokens.expense, fontVariant: ['tabular-nums'] }}>{formatMinor(value, item.currency)}</Typography>{item.monthlyLimitMinor !== undefined && <View style={{ width: 106, gap: 3 }}><Typography variant="caption" style={{ color: tokens.foregroundMuted, fontSize: 10 }}>{used}% of {formatMinor(item.monthlyLimitMinor, item.currency)}</Typography><View style={[styles.track, { backgroundColor: tokens.borderSubtle }]}><View style={{ width: `${used}%`, height: 5, borderRadius: 4, backgroundColor: used >= 80 ? tokens.warning : tokens.primary }}/></View></View>}</View><ArrowRight size={17} color={tokens.foregroundSubtle}/>
            </TouchableOpacity>{index < visible.length - 1 && <View style={[styles.separator, { backgroundColor: tokens.borderSubtle }]}/>}</React.Fragment>;
          })}
        </View>}
      </View>
      <View style={styles.note}><View style={[styles.noteIcon, { backgroundColor: `${tokens.primary}18` }]}><Tag size={17} color={tokens.primary}/></View><View style={{ flex: 1 }}><Typography variant="bodyLarge" style={{ fontSize: 13 }}>Keep limits close to your habits</Typography><Typography variant="caption" style={{ color: tokens.foregroundMuted }}>Category limits help you see what remains this month.</Typography></View><TouchableOpacity accessibilityRole="button" onPress={onOpenAnalytics} style={styles.noteAction}><Typography variant="caption" style={{ color: tokens.primary }}>Analytics</Typography></TouchableOpacity></View>
    </ScrollView>
  );
}

function Summary({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone: string }) {
  const { tokens } = useTheme();
  const color = tone === 'expense' ? tokens.expense : tone === 'income' ? tokens.income : tone === 'warning' ? tokens.warning : tokens.primary;
  return <View style={[styles.metric, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.borderSubtle }]}><View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}><Tag size={16} color={color}/></View><View style={{ flex: 1, gap: 2 }}><Typography variant="caption" numberOfLines={1} style={{ color: tokens.foregroundMuted }}>{label}</Typography><Typography variant="title" style={{ fontSize: 22, fontVariant: ['tabular-nums'] }}>{value}</Typography><Typography variant="caption" style={{ color: tokens.foregroundSubtle }}>{hint}</Typography></View></View>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderRadius: 13, borderColor: '#343834', backgroundColor: '#111311' },
  searchInput: { flex: 1, minHeight: 43, borderWidth: 0, paddingHorizontal: 0, backgroundColor: 'transparent' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48%', minHeight: 95, flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderWidth: 1, borderRadius: 14 },
  metricIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  panel: { padding: 13, borderWidth: 1, borderColor: '#292d29', borderRadius: 15, backgroundColor: '#0b0d0b', gap: 10 },
  panelTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filters: { flexDirection: 'row', gap: 6 },
  filter: { minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderRadius: 9 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 9 },
  rowValue: { alignItems: 'flex-end', gap: 5 },
  track: { height: 5, overflow: 'hidden', borderRadius: 4 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 3 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderWidth: 1, borderColor: '#292d29', borderRadius: 13, backgroundColor: '#0b0d0b' },
  noteIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  noteAction: { padding: 7 },
});
