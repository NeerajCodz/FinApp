import React, { useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, TouchableOpacity, View } from 'react-native';
import { Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import type { AnalyticsBucket } from '@convex/analytics/domain';

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
