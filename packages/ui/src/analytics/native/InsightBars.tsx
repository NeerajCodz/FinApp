import React, { useState } from 'react';
import { AccessibilityInfo, TouchableOpacity, View } from 'react-native';
import { Text, Typography, useTheme } from '@finapp/ui/native';

type InsightPoint = { label: string; value: number; amount: string; color?: string };

export function InsightBars({ items }: { items: readonly InsightPoint[] }) {
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const maximum = Math.max(...items.map((item) => Math.max(0, item.value)), 1);
  if (!items.length) return <Typography variant="small">No spending to compare.</Typography>;
  return (
    <View accessibilityLabel="Spending categories chart" style={{ gap: 16 }}>
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.label}
          accessibilityRole="button"
          accessibilityLabel={`${item.label}: ${item.amount}`}
          accessibilityState={{ selected: selected === index }}
          activeOpacity={0.65}
          onPress={() => {
            setSelected(index);
            AccessibilityInfo.announceForAccessibility(`${item.label}: ${item.amount}`);
          }}
          style={{ gap: 8, minHeight: 44, justifyContent: 'center' }}
        >
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
        </TouchableOpacity>
      ))}
      {selected !== null && items[selected] && (
        <Typography variant="small" accessibilityLiveRegion="polite">
          {items[selected].label} · {items[selected].amount}
        </Typography>
      )}
    </View>
  );
}
