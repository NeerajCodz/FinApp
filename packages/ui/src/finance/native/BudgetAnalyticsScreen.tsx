import { ScrollView, View } from 'react-native';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
export type BudgetAnalyticsTransaction = {
  id: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: number;
  title: string;
};
export function BudgetAnalyticsScreen({
  name,
  category,
  icon,
  currency,
  limit,
  transactions,
  period,
  startAt,
  endAt,
  loading,
  error,
  onPeriodChange,
  onBack,
}: {
  name: string;
  category: string;
  icon?: string;
  currency: string;
  limit: bigint;
  transactions: readonly BudgetAnalyticsTransaction[];
  period: 'week' | 'month' | 'year';
  startAt: number;
  endAt: number;
  loading?: boolean;
  error?: string | null;
  onPeriodChange: (value: 'week' | 'month' | 'year') => void;
  onBack: () => void;
}) {
  const { tokens } = useTheme();
  const spent = transactions.reduce((sum, row) => sum + row.amountMinor, 0n);
  const remaining = limit - spent;
  const days = Math.max(1, Math.ceil((endAt - startAt) / 86400000));
  const buckets = Array.from({ length: Math.min(days, 31) }, () => 0n);
  for (const row of transactions) {
    const day = Math.floor((row.occurredAt - startAt) / 86400000);
    const index = Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((day * buckets.length) / days)),
    );
    buckets[index] = (buckets[index] ?? 0n) + row.amountMinor;
  }
  const max = buckets.reduce((m, value) => (value > m ? value : m), 0n) || 1n;
  return (
    <ScrollView
      contentContainerStyle={{ padding: 22, paddingTop: 16, paddingBottom: 40, gap: 16 }}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <Button variant="ghost" onPress={onBack}>
        ‹ Budgets
      </Button>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CategoryIcon label={category} icon={icon} />
        <View style={{ flex: 1 }}>
          <Typography variant="title">{name} analytics</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            Actual posted category expenses · {currency}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['week', 'month', 'year'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={period === value ? 'primary' : 'outline'}
            onPress={() => onPeriodChange(value)}
          >
            {value}
          </Button>
        ))}
      </View>
      {loading ? (
        <Text>Loading this budget period…</Text>
      ) : error ? (
        <Text style={{ color: tokens.destructive }}>{error}</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {[
              ['Spent', formatMinor(spent, currency)],
              ['Limit', formatMinor(limit, currency)],
              ['Remaining', formatMinor(remaining, currency)],
            ].map(([label, value]) => (
              <View
                key={label}
                style={{
                  flexGrow: 1,
                  minWidth: 120,
                  padding: 14,
                  borderRadius: 15,
                  backgroundColor: tokens.surfaceRaised,
                }}
              >
                <Text style={{ color: tokens.foregroundMuted }}>{label}</Text>
                <Typography variant="heading">{value}</Typography>
              </View>
            ))}
          </View>
          <View
            style={{
              height: 190,
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 5,
              padding: 12,
              borderRadius: 16,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            {buckets.map((value, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: `${Number((value * 100n) / max)}%`,
                  minHeight: value ? 4 : 1,
                  borderRadius: 4,
                  backgroundColor: tokens.primary,
                }}
              />
            ))}
          </View>
          <Text style={{ color: tokens.foregroundMuted }}>
            {transactions.length} posted expenses · {new Date(startAt).toLocaleDateString()} –{' '}
            {new Date(endAt - 1).toLocaleDateString()}
          </Text>
        </>
      )}
    </ScrollView>
  );
}
