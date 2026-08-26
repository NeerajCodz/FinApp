import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function BalancesScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 36,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Balances</Typography>
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="label">Your balance</Typography>
        <Money amountMinor={0n} currency="INR" size="display" />
        <Typography variant="caption">Nothing to settle</Typography>
      </View>
      <Empty
        title="All settled."
        description="Member balances will appear when the group shares an expense."
      />
    </ScrollView>
  );
}
