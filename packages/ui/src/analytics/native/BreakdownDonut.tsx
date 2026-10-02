import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Typography, useTheme } from '@finapp/ui/native';
import { CategoryIcon } from '../../finance/native/CategoryIcon';
import { formatMinor } from '@finapp/ui/finance/money';
import type { AnalyticsBreakdownItem } from '@convex/analytics/domain';
import { FinanceEmptyState } from '../../finance/native/FinanceEmptyState';

const chartColors = ['primary', 'blue', 'violet', 'orange', 'pink', 'cyan', 'yellow'] as const;

export function BreakdownDonut({
  items,
  totalMinor,
  currency,
  onSelectItem,
  iconForCategory,
}: {
  items: readonly AnalyticsBreakdownItem[];
  totalMinor: bigint;
  currency: string;
  onSelectItem?: (item: AnalyticsBreakdownItem) => void;
  iconForCategory?: (id: string) => string | undefined;
}) {
  const { tokens } = useTheme();
  const colors = chartColors.map((name) =>
    name === 'primary' ? tokens.primary : tokens.chart[name],
  );
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <View style={{ gap: 18 }}>
      {totalMinor > 0n && (
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 142 }}>
          <Svg
            width={142}
            height={142}
            viewBox="0 0 142 142"
            accessibilityLabel="Expense share by category"
          >
            <Circle
              cx={71}
              cy={71}
              r={radius}
              stroke={tokens.borderSubtle}
              strokeWidth={19}
              fill="none"
            />
            {items.map((item, index) => {
              const fraction = Number((item.amountMinor * 10000n) / totalMinor) / 10000;
              const length = circumference * fraction;
              const segment = (
                <Circle
                  key={item.id}
                  cx={71}
                  cy={71}
                  r={radius}
                  stroke={colors[index % colors.length]}
                  strokeWidth={19}
                  fill="none"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  rotation={-90}
                  origin="71, 71"
                />
              );
              offset += length;
              return segment;
            })}
          </Svg>
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <Typography variant="caption">Total spent</Typography>
            <Typography variant="small">{formatMinor(totalMinor, currency)}</Typography>
          </View>
        </View>
      )}
      {items.length === 0 ? (
        <FinanceEmptyState
          kind="analytics"
          title="No posted expenses in this period."
          description="Choose another period to review spending by category."
          compact
        />
      ) : (
        items.map((item, index) => {
          const percentage =
            totalMinor > 0n ? Number((item.amountMinor * 1000n) / totalMinor) / 10 : 0;
          return (
            <TouchableOpacity
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}, ${formatMinor(item.amountMinor, currency)}, ${percentage}% of spending`}
              onPress={() => onSelectItem?.(item)}
              activeOpacity={0.65}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors[index % colors.length],
                }}
              />
              {iconForCategory && (
                <CategoryIcon label={item.label} icon={iconForCategory(item.id)} />
              )}
              <Typography variant="small" numberOfLines={2} style={{ flex: 1 }}>
                {item.label}
              </Typography>
              <View style={{ alignItems: 'flex-end', minWidth: 88 }}>
                <Typography variant="small">{formatMinor(item.amountMinor, currency)}</Typography>
                <Typography variant="caption">{percentage}%</Typography>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}
