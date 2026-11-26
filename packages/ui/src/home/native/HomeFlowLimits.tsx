import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Button, Card, SectionHeader, Tabs, Typography } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import { Meter } from '../../charts/native';
import { FinanceEmptyState } from '../../finance/native/FinanceEmptyState';
import { CashFlowChart } from '../../analytics/native/CashFlowChart';
import type { HomeDashboardData } from '../model';
type CashFlowRange = 'week' | 'month' | 'year';

const cashFlowTabs = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

/** Cash flow and "Category limits": the categories closest to their monthly limit. */
export function HomeFlowLimits({
  data,
  currency,
  onOpenCategory,
  onSeeAllCategories,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenCategory: (id: string) => void;
  onSeeAllCategories: () => void;
}) {
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
          title="Category limits"
          action={
            <Button variant="ghost" size="sm" onPress={onSeeAllCategories}>
              See all
            </Button>
          }
        />
        {data.categoryLimits.length ? (
          data.categoryLimits.map((limit) => {
            const percent =
              limit.limitMinor > 0n ? Number((limit.spentMinor * 100n) / limit.limitMinor) : 0;
            return (
              <TouchableOpacity
                key={limit.id}
                accessibilityRole="button"
                onPress={() => onOpenCategory(limit.id)}
                activeOpacity={0.75}
                style={{ paddingVertical: 8, gap: 7 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Typography variant="body" numberOfLines={1} style={{ flex: 1 }}>
                    {limit.icon ? `${limit.icon} ` : ''}
                    {limit.name}
                  </Typography>
                  <Typography variant="caption">{Math.round(percent)}%</Typography>
                </View>
                <Meter
                  value={Number(limit.spentMinor)}
                  max={Number(limit.limitMinor)}
                  warnAt={limit.alertPercent / 100}
                  thin
                />
                <Typography variant="caption">
                  {formatMinor(limit.spentMinor, limit.currency)} of{' '}
                  {formatMinor(limit.limitMinor, limit.currency)}
                </Typography>
              </TouchableOpacity>
            );
          })
        ) : (
          <FinanceEmptyState
            kind="budget"
            title="No category limits yet."
            description="Set a monthly limit on a category to give your spending a plan."
            compact
            action={
              <Button size="sm" variant="outline" onPress={onSeeAllCategories}>
                Set a category limit
              </Button>
            }
          />
        )}
      </Card>
    </View>
  );
}
