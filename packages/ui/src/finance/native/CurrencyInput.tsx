import React from 'react';
import { View } from 'react-native';
import { Input, Text, Typography, useTheme } from '@finapp/ui/native';

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
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Typography variant="label">Amount</Typography>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            color: tokens.foreground,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: 44,
            lineHeight: 50,
            letterSpacing: -1.6,
          }}
        >
          {currency === 'INR' ? '₹' : currency}
        </Text>
        <Input
          accessibilityLabel={`Amount in ${currency}`}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          style={{
            minWidth: 80,
            maxWidth: 240,
            minHeight: 60,
            borderWidth: 0,
            paddingHorizontal: 8,
            backgroundColor: 'transparent',
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: 44,
            lineHeight: 50,
            letterSpacing: -1.6,
            textAlign: 'center',
          }}
        />
      </View>
    </View>
  );
}
