import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, RadioGroup, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function CurrencySettingsScreen() {
  const [currency, setCurrency] = useState('INR');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Currency</Typography>
      </View>
      <View style={{ gap: 12 }}>
        <Typography variant="label">Default currency</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
          Used for new accounts, budgets, groups, and transactions.
        </Text>
        <RadioGroup
          value={currency}
          onChange={setCurrency}
          options={[
            { label: 'Indian rupee · INR', value: 'INR' },
            { label: 'US dollar · USD', value: 'USD' },
            { label: 'Euro · EUR', value: 'EUR' },
            { label: 'British pound · GBP', value: 'GBP' },
            { label: 'Japanese yen · JPY', value: 'JPY' },
          ]}
        />
      </View>
    </ScrollView>
  );
}
