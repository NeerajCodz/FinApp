import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetProgress, Money } from '@/components/finance';
import { IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 40,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading">{id ?? 'Budget'}</Typography>
      </View>

      <View style={{ gap: 8 }}>
        <Money amountMinor={0n} currency="INR" size="display" />
        <Typography variant="caption">spent of ₹0</Typography>
        <Typography variant="heading">₹0 left</Typography>
      </View>

      <BudgetProgress title="This month" spentMinor={0n} limitMinor={0n} currency="INR" primary />
    </ScrollView>
  );
}
