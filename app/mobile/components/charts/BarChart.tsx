import React from 'react';
import { View } from 'react-native';
import { Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

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
          const active = highlightIndex === index;
          return (
            <View key={`${index}-${value}`} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 7 }}>
              <View
                accessibilityLabel={`${value}`}
                style={{
                  width: '100%',
                  height: `${Math.max(5, (value / maximum) * 100)}%`,
                  backgroundColor: active ? tokens.primary : tokens.surfaceRaised,
                  borderRadius: 8,
                  borderWidth: active ? 0 : 1,
                  borderColor: tokens.borderSubtle,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {values.map((_, index) => (
          <Typography key={`label-${index}`} variant="caption" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
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
  items: readonly { label: string; value: number; amount: string }[];
}) {
  const { tokens } = useTheme();
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return (
    <View accessibilityLabel="Spending categories" style={{ gap: 16 }}>
      {items.map((item) => (
        <View key={item.label} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13 }}>{item.label}</Text>
            <Text style={{ color: tokens.mutedForeground, fontSize: 13 }}>{item.amount}</Text>
          </View>
          <View style={{ height: 7, backgroundColor: tokens.muted, borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ width: `${(item.value / maximum) * 100}%`, height: '100%', backgroundColor: tokens.primary, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
