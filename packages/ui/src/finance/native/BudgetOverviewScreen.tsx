import { Pressable, ScrollView, View } from 'react-native';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';

export type BudgetOverviewItem = {
  id: string;
  name: string;
  category: string;
  icon?: string;
  currency: string;
  spentMinor: bigint;
  limitMinor: bigint;
  startAt: number;
  endAt: number;
  alertThreshold?: number;
};
export type BudgetOverviewScreenProps = {
  items: readonly BudgetOverviewItem[];
  loading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onAnalytics?: () => void;
};

export function BudgetOverviewScreen({
  items,
  loading,
  error,
  onCreate,
  onOpen,
  onAnalytics,
}: BudgetOverviewScreenProps) {
  const { tokens } = useTheme();
  const sameCurrency = items.every((item) => item.currency === items[0]?.currency);
  const currency = items[0]?.currency ?? 'INR';
  const limit = items.reduce((sum, item) => sum + item.limitMinor, 0n);
  const spent = items.reduce((sum, item) => sum + item.spentMinor, 0n);
  const overBudget = items.filter((item) => item.spentMinor > item.limitMinor).length;
  const alerts = items.filter(
    (item) =>
      item.limitMinor > 0n &&
      item.spentMinor * 100n >= item.limitMinor * BigInt(Math.round(item.alertThreshold ?? 80)),
  );
  const money = (amount: bigint) =>
    sameCurrency ? formatMinor(amount, currency) : 'Multiple currencies';
  const panel = {
    gap: 12,
    padding: 16,
    borderWidth: 1 as const,
    borderColor: tokens.borderSubtle,
    borderRadius: 16,
    backgroundColor: tokens.surfaceRaised,
  };
  const metrics = [
    { label: 'Total monthly budget', value: money(limit), detail: 'Across active budgets' },
    { label: 'Total spent', value: money(spent), detail: 'Posted expenses' },
    { label: 'Remaining budget', value: money(limit - spent), detail: 'Across active budgets' },
    {
      label: 'Over-budget categories',
      value: String(overBudget),
      detail: `of ${items.length} categories`,
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 40, gap: 16 }}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Typography variant="title">Budgets</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            Monitor category limits and control your spending.
          </Text>
        </View>
        {onAnalytics && items.length > 0 && (
          <Button size="sm" variant="outline" onPress={onAnalytics}>
            Analytics
          </Button>
        )}
        <Button size="sm" onPress={onCreate}>
          ＋ New
        </Button>
      </View>

      {loading ? (
        <Text accessibilityRole="text">Loading your budgets…</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {error}
        </Text>
      ) : !items.length ? (
        <FinanceEmptyState
          kind="budget"
          title="Give your spending a plan."
          description="Set a limit for a category you already use. Only posted expenses count."
          action={<Button onPress={onCreate}>Create a budget</Button>}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {metrics.map((item) => (
              <View
                key={item.label}
                style={{
                  flexGrow: 1,
                  flexBasis: '46%',
                  minWidth: 145,
                  gap: 5,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: tokens.surfaceRaised,
                }}
              >
                <Text style={{ color: tokens.foregroundMuted }}>{item.label}</Text>
                <Typography variant="heading">{item.value}</Typography>
                <Text style={{ color: tokens.foregroundMuted }}>{item.detail}</Text>
              </View>
            ))}
          </View>

          <View style={panel}>
            <Typography variant="heading">Budget by category</Typography>
            {items.map((item) => {
              const ratio =
                item.limitMinor > 0n
                  ? Number((item.spentMinor * 10000n) / item.limitMinor) / 100
                  : 0;
              const threshold = item.alertThreshold ?? 80;
              const over = ratio >= 100;
              const atRisk = !over && ratio >= threshold;
              const tone = over ? tokens.destructive : atRisk ? '#e9aa2b' : tokens.primary;
              const daysLeft = Math.max(0, Math.ceil((item.endAt - Date.now()) / 86_400_000));
              const remaining = item.limitMinor - item.spentMinor;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => onOpen(item.id)}
                  style={{
                    gap: 10,
                    padding: 13,
                    borderRadius: 14,
                    backgroundColor: tokens.surfaceRaised,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <CategoryIcon label={item.category} icon={item.icon} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Typography variant="bodyLarge">{item.name}</Typography>
                      <Text style={{ color: tokens.foregroundMuted }}>{item.category}</Text>
                    </View>
                    <Text style={{ color: tone, fontWeight: '600' }}>
                      {over ? 'Over budget' : atRisk ? 'At risk' : 'On track'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text>
                      {formatMinor(item.spentMinor, item.currency)} /{' '}
                      {formatMinor(item.limitMinor, item.currency)}
                    </Text>
                    <Text style={{ color: tone }}>{ratio.toFixed(0)}%</Text>
                  </View>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 5,
                      backgroundColor: tokens.surfaceSubtle,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, ratio))}%`,
                        backgroundColor: tone,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: tokens.foregroundMuted }}>{daysLeft} days left</Text>
                    <Text style={{ color: over ? tokens.destructive : tokens.foregroundMuted }}>
                      {formatMinor(remaining < 0n ? -remaining : remaining, item.currency)}{' '}
                      {over ? 'over' : 'remaining'}
                    </Text>
                    <Text style={{ color: tokens.primary }}>View budget ›</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={panel}>
            <Typography variant="heading">Budget alerts</Typography>
            {alerts.length ? (
              alerts.map((item) => {
                const over = item.spentMinor > item.limitMinor;
                const percent =
                  item.limitMinor > 0n ? Number((item.spentMinor * 100n) / item.limitMinor) : 0;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => onOpen(item.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 7,
                    }}
                  >
                    <CategoryIcon label={item.category} icon={item.icon} />
                    <View style={{ flex: 1 }}>
                      <Text>
                        {item.name} {over ? 'is over budget' : 'is nearing its limit'}
                      </Text>
                      <Text style={{ color: tokens.foregroundMuted }}>
                        {over
                          ? `${formatMinor(item.spentMinor - item.limitMinor, item.currency)} over the limit`
                          : `${percent}% of the limit used`}
                      </Text>
                    </View>
                    <Text style={{ color: tokens.primary }}>›</Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={{ color: tokens.foregroundMuted }}>
                All categories are below their alert thresholds.
              </Text>
            )}
          </View>

          <View style={panel}>
            <Typography variant="heading">Spending vs budget</Typography>
            {sameCurrency ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text>Spent {money(spent)}</Text>
                  <Text style={{ color: tokens.foregroundMuted }}>
                    Remaining {money(limit - spent)}
                  </Text>
                </View>
                <View
                  style={{
                    height: 10,
                    borderRadius: 6,
                    backgroundColor: tokens.surfaceSubtle,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${limit > 0n ? Math.min(100, Math.max(0, Number((spent * 10000n) / limit) / 100)) : 0}%`,
                      backgroundColor: tokens.primary,
                    }}
                  />
                </View>
                <Text style={{ color: tokens.foregroundMuted }}>
                  {limit > 0n ? Number((spent * 100n) / limit) : 0}% used · {money(limit)} total
                </Text>
              </>
            ) : (
              <Text style={{ color: tokens.foregroundMuted }}>
                Budgets use different currencies and are not combined.
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
