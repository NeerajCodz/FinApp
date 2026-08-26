import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Plus } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AccountsScreen() {
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
        <Typography variant="title" style={{ flex: 1 }}>
          Accounts
        </Typography>
        <IconButton
          label="Add account"
          variant="ghost"
          onPress={() => router.push('/account/new' as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>

      <View style={{ gap: 8 }}>
        <Typography variant="label">Total</Typography>
        <Money amountMinor={0n} currency="INR" size="display" />
      </View>

      <Empty
        title="No accounts yet."
        description="Add cash, a bank account, card, or wallet to organize your money."
        action={
          <Button size="sm" variant="outline" onPress={() => router.push('/account/new' as never)}>
            Add account
          </Button>
        }
      />
    </ScrollView>
  );
}
