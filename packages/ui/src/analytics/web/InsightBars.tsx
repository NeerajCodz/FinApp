import React from 'react';
import { Text, Typography, useTheme } from '@finapp/ui/web';

export function InsightBars({
  items,
}: {
  items: readonly { label: string; value: number; amount: string; color?: string }[];
}) {
  const { tokens } = useTheme();
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return (
    <div aria-label="Spending categories" style={{ display: 'grid', gap: 20 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <Typography variant="small" style={{ color: tokens.foreground }}>{item.label}</Typography>
            <Text style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'SpaceGrotesk_500Medium' }}>{item.amount}</Text>
          </div>
          <div style={{ height: 5, backgroundColor: tokens.borderSubtle, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(0, Math.min(100, (item.value / maximum) * 100))}%`,
              height: '100%',
              backgroundColor: item.color ?? tokens.foreground,
              borderRadius: 3,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
