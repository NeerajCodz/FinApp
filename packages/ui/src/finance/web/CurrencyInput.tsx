import React from 'react';
import { Input, Text, Typography, useTheme } from '@finapp/ui/web';

export function CurrencyInput({
  currency,
  value,
  onChangeText,
}: {
  currency: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
      <Typography variant="label">Amount</Typography>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Text
          style={{
            color: tokens.foreground,
            fontFamily: 'var(--font-space-grotesk, sans-serif)',
            fontSize: 44,
            lineHeight: '50px',
            fontWeight: 600,
            letterSpacing: -1.6,
          }}
        >
          {currency === 'INR' ? '₹' : currency}
        </Text>
        <Input
          aria-label={`Amount in ${currency}`}
          inputMode="decimal"
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          style={{
            minWidth: 80,
            maxWidth: 240,
            minHeight: 60,
            border: 0,
            paddingInline: 8,
            background: 'transparent',
            fontFamily: 'var(--font-space-grotesk, sans-serif)',
            fontSize: 44,
            lineHeight: '50px',
            fontWeight: 600,
            letterSpacing: -1.6,
            textAlign: 'center',
          }}
        />
      </div>
    </div>
  );
}
