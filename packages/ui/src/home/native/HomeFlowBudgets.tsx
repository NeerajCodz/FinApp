import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Wallet } from '@finapp/ui/icons/native';
import { Button, Card, SectionHeader, Tabs, Text, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import { CashFlowChart } from '../../analytics/native/CashFlowChart';
import type { HomeDashboardData } from '../model';
type CashFlowRange = 'week' | 'month' | 'year';

const cashFlowTabs = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

export function HomeFlowBudgets({
  data,
  currency,
  onOpenBudget,
  onSeeAllBudgets,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenBudget: (id: string) => void;
  onSeeAllBudgets: () => void;
}) {
  const { tokens } = useTheme();
  const [cashFlowRange, setCashFlowRange] = useState<CashFlowRange>('month');
  const rangeLabel = `THIS ${cashFlowRange.toUpperCase()}`;
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 13 }}>
        <SectionHeader
          title="Cash flow"
          action={<Typography variant="caption">{rangeLabel}</Typography>}
        />
        <Tabs
          tabs={cashFlowTabs}
          value={cashFlowRange}
          onChange={(value) => setCashFlowRange(value as CashFlowRange)}
        />
        <CashFlowChart buckets={data.cashFlowRanges[cashFlowRange]} currency={currency} />
      </Card>
      <Card style={{ gap: 8 }}>
        <SectionHeader
          title="Budgets"
          action={
            <Button variant="ghost" size="sm" onPress={onSeeAllBudgets}>
              See all
            </Button>
          }
        />
        {data.budgets.length ? (
          data.budgets.map((budget) => {
            const percent =
              budget.amountMinor > 0n
                ? Math.min(100, Number((budget.spentMinor * 100n) / budget.amountMinor))
                : 0;
            return (
              <TouchableOpacity
                key={budget.id}
                accessibilityRole="button"
                onPress={() => onOpenBudget(budget.id)}
                activeOpacity={0.75}
                style={{ paddingVertical: 8, gap: 7 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Typography variant="body" numberOfLines={1} style={{ flex: 1 }}>
                    {budget.name}
                  </Typography>
                  <Typography variant="caption">{Math.round(percent)}%</Typography>
                </View>
                <View
                  style={{
                    height: 5,
                    borderRadius: 4,
                    backgroundColor: tokens.surfaceSubtle,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${percent}%`,
                      borderRadius: 4,
                      backgroundColor: percent >= 100 ? tokens.expense : tokens.primary,
                    }}
                  />
                </View>
                <Typography variant="caption">
                  {formatMinor(budget.spentMinor, budget.currency)} of{' '}
                  {formatMinor(budget.amountMinor, budget.currency)}
                </Typography>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 14, gap: 7 }}>
            <Wallet size={21} color={tokens.foregroundMuted} />
            <Text style={{ color: tokens.foregroundMuted, textAlign: 'center' }}>
              No active budgets for this period.
            </Text>
            <Button size="sm" variant="outline" onPress={onSeeAllBudgets}>
              Create a budget
            </Button>
          </View>
        )}
      </Card>
    </View>
  );
}
