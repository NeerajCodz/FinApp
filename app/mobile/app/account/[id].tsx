import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MetricPair, Money } from '@/components/finance';
import { Button, Empty, IconButton, SectionHeader, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AccountDetailScreen() {
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
        <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {id ?? 'Account'}
        </Typography>
      </View>

      <View style={{ gap: 8 }}>
        <Money amountMinor={0n} currency="INR" size="display" />
        <Typography variant="caption">Current balance</Typography>
      </View>

      <View style={{ gap: 16 }}>
        <Typography variant="label">This month</Typography>
        <MetricPair
          left={{ label: 'Income', value: '₹0' }}
          right={{ label: 'Spent', value: '₹0' }}
        />
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="Activity" />
        <Empty
          title="No transactions."
          description="Transactions for this account will appear here."
          action={
            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push('/transaction/new' as never)}
            >
              Add transaction
            </Button>
          }
        />
      </View>
    </ScrollView>
  );
}
