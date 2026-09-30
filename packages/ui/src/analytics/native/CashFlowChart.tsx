import React, { useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, TouchableOpacity, View } from 'react-native';
import { Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import type { AnalyticsBucket } from '@convex/analytics/domain';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { cashFlowLineGeometry } from '../lineGeometry';

export function CashFlowChart({
  buckets,
  currency,
  onSelectBucket,
  variant = 'bars',
}: {
  buckets: readonly AnalyticsBucket[];
  currency: string;
  onSelectBucket?: (bucket: AnalyticsBucket) => void;
  variant?: 'bars' | 'lines';
}) {
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const scrollView = useRef<ScrollView>(null);
  if (variant === 'lines')
    return <CashFlowLines buckets={buckets} currency={currency} onSelectBucket={onSelectBucket} />;
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
function CashFlowLines({
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
  const geometry = cashFlowLineGeometry(buckets);
  if (!buckets.length) return <Typography variant="small">No cash flow in this period.</Typography>;
  const current = selected === null ? undefined : buckets[selected];
  const point = selected === null ? undefined : geometry.points[selected];
  const stride = Math.max(1, Math.ceil(buckets.length / 7));
  const barWidth = Math.max(4, Math.min(12, (900 / buckets.length) * 0.28));
  return (
    <View style={{ gap: 9 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Typography variant="caption" style={{ color: tokens.income }}>
          ■ Income
        </Typography>
        <Typography variant="caption" style={{ color: tokens.expense }}>
          ■ Expenses
        </Typography>
        <Typography variant="caption" style={{ color: tokens.foreground }}>
          ━ Net cash flow
        </Typography>
      </View>
      <View style={{ width: '100%', gap: 4 }}>
        <Svg
          width="100%"
          height={168}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          preserveAspectRatio="none"
          accessibilityLabel="Income and expense bars with net cash flow line"
        >
          {geometry.gridYs.map((y) => (
            <Line
              key={y}
              x1="0"
              x2={geometry.width}
              y1={y}
              y2={y}
              stroke={tokens.borderSubtle}
              strokeDasharray="5 8"
            />
          ))}
          <Line
            x1="0"
            x2={geometry.width}
            y1={geometry.zeroY}
            y2={geometry.zeroY}
            stroke={tokens.border}
          />
          {geometry.points.map((entry, index) => {
            const bucket = buckets[index]!;
            const expenseHeight = Math.abs(geometry.zeroY - entry.spendY);
            const incomeHeight = Math.abs(geometry.zeroY - entry.incomeY);
            return (
              <React.Fragment key={bucket.startAt}>
                {bucket.amountMinor > 0n && (
                  <Rect
                    x={entry.x - barWidth - 1}
                    y={Math.min(geometry.zeroY, entry.spendY)}
                    width={barWidth}
                    height={expenseHeight}
                    fill={tokens.expense}
                    rx={2}
                  />
                )}
                {bucket.incomeMinor > 0n && (
                  <Rect
                    x={entry.x + 1}
                    y={Math.min(geometry.zeroY, entry.incomeY)}
                    width={barWidth}
                    height={incomeHeight}
                    fill={tokens.income}
                    rx={2}
                  />
                )}
              </React.Fragment>
            );
          })}
          <Polyline
            points={geometry.net}
            fill="none"
            stroke={tokens.foreground}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {point && (
            <Circle
              cx={point.x}
              cy={point.netY}
              r="6"
              fill={tokens.foreground}
              stroke={tokens.background}
              strokeWidth="3"
            />
          )}
        </Svg>
        <View style={{ flexDirection: 'row', width: '100%' }}>
          {buckets.map((bucket, index) => (
            <TouchableOpacity
              key={bucket.startAt}
              accessibilityRole="button"
              accessibilityLabel={`${bucket.label}: expenses ${formatMinor(bucket.amountMinor, currency)}, income ${formatMinor(bucket.incomeMinor, currency)}, net cash flow ${formatMinor(bucket.incomeMinor - bucket.amountMinor, currency)}`}
              accessibilityState={{ selected: selected === index }}
              onPress={() => {
                setSelected(index);
                AccessibilityInfo.announceForAccessibility(bucket.label);
                onSelectBucket?.(bucket);
              }}
              activeOpacity={0.65}
              style={{ flex: 1, minWidth: 0, alignItems: 'center' }}
            >
              <Typography
                variant="caption"
                numberOfLines={1}
                style={{
                  color: selected === index ? tokens.foreground : tokens.foregroundMuted,
                  fontSize: 10,
                }}
              >
                {index % stride === 0 || index === buckets.length - 1
                  ? buckets.length > 12
                    ? bucket.label.split(' ').at(-1)
                    : bucket.label
                  : ''}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {current && (
        <Typography variant="small">
          {current.label} · Expenses {formatMinor(current.amountMinor, currency)} · Income{' '}
          {formatMinor(current.incomeMinor, currency)} · Net cash flow{' '}
          {formatMinor(current.incomeMinor - current.amountMinor, currency)}
        </Typography>
      )}
    </View>
  );
}
