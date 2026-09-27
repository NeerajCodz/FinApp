import React from 'react';
import { View } from 'react-native';
import { Text, Typography, useTheme } from '@finapp/ui/native';

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
