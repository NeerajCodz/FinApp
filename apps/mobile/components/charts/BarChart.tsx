import React, { useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Text, Typography } from '@finapp/ui/native';
import { CategoryIcon } from '@/components/finance';
import { useTheme } from '@finapp/ui/native';
import { formatMinor } from '@/lib/money';
import type { AnalyticsBreakdownItem, AnalyticsBucket } from '@convex/analytics/domain';

export function SpendingLineChart({
  values,
  labels = ['1 Aug', 'Today'],
}: {
  values: readonly number[];
  labels?: readonly [string, string];
}) {
  const { tokens } = useTheme();
  const width = 350;
  const height = 132;
  const inset = 8;
  const maximum = Math.max(...values, 1);
  const minimum = Math.min(...values, 0);
  const range = Math.max(maximum - minimum, 1);
  const points = values.map((value, index) => ({
    x: inset + (index / Math.max(values.length - 1, 1)) * (width - inset * 2),
    y: inset + ((maximum - value) / range) * (height - inset * 2),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const lastPoint = points.at(-1);

  return (
    <View accessibilityLabel="Monthly spending line chart" style={{ gap: 8 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0.25, 0.5, 0.75].map((position) => (
          <Line
            key={position}
            x1={0}
            x2={width}
            y1={height * position}
            y2={height * position}
            stroke={tokens.borderSubtle}
            strokeWidth={1}
          />
        ))}
        <Path
          d={path}
          fill="none"
          stroke={tokens.primary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {lastPoint && (
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4}
            fill={tokens.background}
            stroke={tokens.primary}
            strokeWidth={2}
          />
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Typography variant="caption">{labels[0]}</Typography>
        <Typography variant="caption">{labels[1]}</Typography>
      </View>
    </View>
  );
}

export function BarChart({
  values,
  labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  highlightIndex,
}: {
  values: readonly number[];
  labels?: readonly string[];
  highlightIndex?: number;
}) {
  const maximum = Math.max(...values, 1);
  const { tokens } = useTheme();
  return (
    <View accessibilityLabel="Spending bar chart" style={{ gap: 10 }}>
      <View style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        {values.map((value, index) => {
          const highlighted = index === highlightIndex;
          return (
            <View
              key={`${labels[index] ?? index}-${index}`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  height: `${Math.max(4, (value / maximum) * 100)}%`,
                  borderRadius: 5,
                  backgroundColor: highlighted ? tokens.primary : tokens.foreground,
                  opacity: highlighted ? 1 : 0.72,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {values.map((_, index) => (
          <Typography
            key={`${labels[index] ?? index}-${index}`}
            variant="caption"
            style={{ flex: 1, textAlign: 'center' }}
          >
            {labels[index] ?? ''}
          </Typography>
        ))}
      </View>
    </View>
  );
}

export function InsightBars({
  items,
}: {
  items: readonly { label: string; value: number; amount: string; color?: string }[];
}) {
  const { tokens } = useTheme();
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return (
    <View accessibilityLabel="Spending categories" style={{ gap: 20 }}>
      {items.map((item) => (
        <View key={item.label} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Typography variant="small" style={{ color: tokens.foreground }}>
              {item.label}
            </Typography>
            <Text style={{ fontVariant: ['tabular-nums'], fontFamily: 'SpaceGrotesk_500Medium' }}>
              {item.amount}
            </Text>
          </View>
          <View
            style={{
              height: 5,
              backgroundColor: tokens.borderSubtle,
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, (item.value / maximum) * 100))}%`,
                height: '100%',
                backgroundColor: item.color ?? tokens.foreground,
                borderRadius: 3,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const chartColors = ['volt', 'blue', 'violet'] as const;

export function CashFlowChart({
  buckets,
  currency,
  onSelectBucket,
}: {
  buckets: readonly AnalyticsBucket[];
  currency: string;
  onSelectBucket?: (bucket: AnalyticsBucket) => void;
}) {
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const scrollView = useRef<ScrollView>(null);
  const maximum = buckets.reduce((max, bucket) => {
    const amount =
      bucket.amountMinor > bucket.incomeMinor ? bucket.amountMinor : bucket.incomeMinor;
    return amount > max ? amount : max;
  }, 0n);
  const height = 116;
  const barHeight = (amount: bigint) =>
    maximum > 0n ? Number((amount * BigInt(height)) / maximum) : 0;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
        <Typography variant="caption" style={{ color: tokens.expense }}>
          ■ Spend
        </Typography>
        <Typography variant="caption" style={{ color: tokens.income }}>
          ■ Income
        </Typography>
      </View>
      {buckets.length === 0 ? (
        <Typography variant="small">No cash flow in this period.</Typography>
      ) : (
        <ScrollView
          ref={scrollView}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollView.current?.scrollToEnd({ animated: false })}
        >
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            {buckets.map((bucket, index) => {
              const accessible = `${bucket.label}: spent ${formatMinor(bucket.amountMinor, currency)}, income ${formatMinor(bucket.incomeMinor, currency)}`;
              return (
                <TouchableOpacity
                  key={bucket.startAt}
                  accessibilityRole="button"
                  accessibilityLabel={accessible}
                  accessibilityState={{ selected: selected === index }}
                  onPress={() => {
                    setSelected(index);
                    AccessibilityInfo.announceForAccessibility(accessible);
                    onSelectBucket?.(bucket);
                  }}
                  activeOpacity={0.65}
                  style={{ width: periodWidth(buckets.length), gap: 7 }}
                >
                  <View
                    style={{
                      width: periodWidth(buckets.length),
                      height,
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      gap: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: tokens.border,
                    }}
                  >
                    <View
                      style={{
                        width: 11,
                        height: Math.max(
                          barHeight(bucket.amountMinor),
                          bucket.amountMinor > 0n ? 2 : 0,
                        ),
                        borderRadius: 2,
                        backgroundColor: tokens.expense,
                      }}
                    />
                    <View
                      style={{
                        width: 11,
                        height: Math.max(
                          barHeight(bucket.incomeMinor),
                          bucket.incomeMinor > 0n ? 2 : 0,
                        ),
                        borderRadius: 2,
                        backgroundColor: tokens.income,
                      }}
                    />
                  </View>
                  <Typography
                    variant="caption"
                    numberOfLines={1}
                    style={{
                      textAlign: 'center',
                      color: selected === index ? tokens.foreground : tokens.foregroundMuted,
                    }}
                  >
                    {buckets.length > 12
                      ? index % 5 !== 0 && index !== buckets.length - 1
                        ? ' '
                        : bucket.label.split(' ').at(-1)
                      : bucket.label}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
      {selected !== null && buckets[selected] && (
        <Typography variant="small">
          {buckets[selected].label} · Spent {formatMinor(buckets[selected].amountMinor, currency)} ·
          Income {formatMinor(buckets[selected].incomeMinor, currency)}
        </Typography>
      )}
    </View>
  );
}

function periodWidth(count: number) {
  return count > 12 ? 46 : count > 7 ? 54 : 48;
}

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
  const colors = chartColors.map((name) => tokens.chart[name]);
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
        <Typography variant="small">No posted expenses in this period.</Typography>
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
