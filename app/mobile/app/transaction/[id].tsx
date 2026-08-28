import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight, ReceiptText } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon, Money, SettingsRow } from '@/components/finance';
import { Button, IconButton, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function TransactionDetailScreen() {
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
        gap: 36,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading">Transaction</Typography>
      </View>

      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
        <CategoryIcon label="Expense" />
        <Money amountMinor={0n} currency="INR" type="expense" size="display" />
        <Typography variant="caption">{id ? 'TRANSACTION DETAIL' : 'DRAFT TRANSACTION'}</Typography>
      </View>

      <View>
        <SettingsRow label="Category" value="Uncategorized" />
        <Separator />
        <SettingsRow label="Account" value="Not selected" />
        <Separator />
        <SettingsRow label="Date" value="Today" />
        <Separator />
        <SettingsRow label="Note" value="None" />
      </View>

      <Button
        size="lg"
        variant="outline"
        onPress={() => router.push('/transaction/new?type=expense' as never)}
        style={{ justifyContent: 'space-between' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ReceiptText size={19} color={tokens.foreground} />
          <Text
            style={{
              color: tokens.foreground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Duplicate transaction
          </Text>
        </View>
        <ArrowRight size={18} color={tokens.foregroundSubtle} />
      </Button>
    </ScrollView>
  );
}
