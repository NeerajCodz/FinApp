import React, { useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import type { AnalyticsBucket } from '@convex/analytics/domain';
import { formatBucketAxisLabel, formatBucketDate, scaledMinor } from '../chart-utils';

export function CashFlowChart({
  buckets,
  currency,
  onSelectBucket,
  timeZone = 'UTC',
}: {
  buckets: readonly AnalyticsBucket[];
  currency: string;
  onSelectBucket?: (bucket: AnalyticsBucket) => void;
  timeZone?: string;
}) {
  const { tokens } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const scrollView = useRef<ScrollView>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const maximum = buckets.reduce((max, bucket) => {
    const amount =
      bucket.amountMinor > bucket.incomeMinor ? bucket.amountMinor : bucket.incomeMinor;
    return amount > max ? amount : max;
  }, 0n);
  const chartWidth = Math.max(screenWidth - 84, buckets.length * 46, 320);
  const itemWidth = buckets.length > 0 ? chartWidth / buckets.length : 0;
  const height = 150;
  const baseline = height / 2;
  const amplitude = (height - 24) / 2;
  const barWidth = Math.max(5, Math.min(13, itemWidth * 0.24));
  const points = buckets.map((bucket, index) => {
    const x = itemWidth * index + itemWidth / 2;
    const net = bucket.incomeMinor - bucket.amountMinor;
    return {
      x,
      y: baseline - scaledMinor(net, maximum) * amplitude,
      incomeHeight: scaledMinor(bucket.incomeMinor, maximum) * amplitude,
      expenseHeight: scaledMinor(bucket.amountMinor, maximum) * amplitude,
    };
  });
  const netPath = points.map((point) => `${point.x},${point.y}`).join(' ');
  const selectedBucket = selected === null ? undefined : buckets[selected];
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone }),
    [timeZone],
  );

  if (!buckets.length) return <Typography variant="small">No cash flow in this period.</Typography>;

  const selectBucket = (bucket: AnalyticsBucket, index: number) => {
    const label = `${formatBucketDate(bucket, timeZone)}: income ${formatMinor(bucket.incomeMinor, currency)}, expenses ${formatMinor(-bucket.amountMinor, currency)}, net cash flow ${formatMinor(bucket.incomeMinor - bucket.amountMinor, currency)}`;
    setSelected(index);
    AccessibilityInfo.announceForAccessibility(label);
    onSelectBucket?.(bucket);
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        accessibilityLabel="Cash flow chart legend"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}
      >
        <Typography variant="caption" style={{ color: tokens.income }}>
          ■ Income
        </Typography>
        <Typography variant="caption" style={{ color: tokens.expense }}>
          ■ Expenses (below zero)
        </Typography>
        <Typography variant="caption" style={{ color: tokens.foreground }}>
          ━ Net cash flow
        </Typography>
      </View>
      <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
        Scale ±{formatMinor(maximum, currency)} · zero baseline
      </Typography>
      <ScrollView
        ref={scrollView}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollView.current?.scrollToEnd({ animated: false })}
      >
        <View style={{ width: chartWidth }}>
          <Svg
            width={chartWidth}
            height={height}
            viewBox={`0 0 ${chartWidth} ${height}`}
            accessibilityLabel="Income bars rise above zero, expense bars fall below zero, and the line shows net cash flow."
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <Line
              x1={0}
              x2={chartWidth}
              y1={baseline - amplitude}
              y2={baseline - amplitude}
              stroke={tokens.borderSubtle}
              strokeDasharray="4 6"
            />
            <Line
              x1={0}
              x2={chartWidth}
              y1={baseline}
              y2={baseline}
              stroke={tokens.foregroundMuted}
              strokeWidth={1.5}
            />
            <Line
              x1={0}
              x2={chartWidth}
              y1={baseline + amplitude}
              y2={baseline + amplitude}
              stroke={tokens.borderSubtle}
              strokeDasharray="4 6"
            />
            {points.map((point, index) => (
              <React.Fragment key={buckets[index]!.startAt}>
                {point.incomeHeight > 0 && (
                  <Rect
                    x={point.x + 2}
                    y={baseline - point.incomeHeight}
                    width={barWidth}
                    height={point.incomeHeight}
                    rx={2}
                    fill={tokens.income}
                  />
                )}
                {point.expenseHeight > 0 && (
                  <Rect
                    x={point.x - barWidth - 2}
                    y={baseline}
                    width={barWidth}
                    height={point.expenseHeight}
                    rx={2}
                    fill={tokens.expense}
                  />
                )}
              </React.Fragment>
            ))}
            <Polyline
              points={netPath}
              fill="none"
              stroke={tokens.foreground}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((point, index) => (
              <Circle
                key={`net-${buckets[index]!.startAt}`}
                cx={point.x}
                cy={point.y}
                r={selected === index ? 5 : 3}
                fill={tokens.foreground}
                stroke={tokens.background}
                strokeWidth={2}
              />
            ))}
          </Svg>
          <View style={{ flexDirection: 'row', width: chartWidth }}>
            {buckets.map((bucket, index) => (
              <TouchableOpacity
                key={bucket.startAt}
                accessibilityRole="button"
                accessibilityLabel={`${dateFormatter.format(bucket.startAt)}: income ${formatMinor(bucket.incomeMinor, currency)}, expenses ${formatMinor(-bucket.amountMinor, currency)}, net cash flow ${formatMinor(bucket.incomeMinor - bucket.amountMinor, currency)}. Opens this date range.`}
                accessibilityState={{ selected: selected === index }}
                onPress={() => selectBucket(bucket, index)}
                activeOpacity={0.65}
                style={{
                  width: itemWidth,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  variant="caption"
                  numberOfLines={1}
                  style={{
                    color: selected === index ? tokens.foreground : tokens.foregroundMuted,
                    fontSize: 10,
                  }}
                >
                  {formatBucketAxisLabel(bucket, timeZone)}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      {selectedBucket && (
        <Typography variant="small" accessibilityLiveRegion="polite">
          {dateFormatter.format(selectedBucket.startAt)} · Income{' '}
          {formatMinor(selectedBucket.incomeMinor, currency)} · Expenses{' '}
          {formatMinor(-selectedBucket.amountMinor, currency)} · Net cash flow{' '}
          {formatMinor(selectedBucket.incomeMinor - selectedBucket.amountMinor, currency)}
        </Typography>
      )}
    </View>
  );
}
