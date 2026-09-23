import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const accounts = useQuery(api.accounts.queries.list);
  const account = accounts?.find((item) => item.id === id);
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
          {account?.name ?? 'Account'}
        </Typography>
      </View>

      {account ? (
        <View style={{ gap: 8 }}>
          <Money amountMinor={account.balanceMinor} currency={account.currency} size="display" />
          <Typography variant="caption">Current balance</Typography>
        </View>
      ) : accounts === undefined && id ? (
        <Typography variant="small">Loading account…</Typography>
      ) : (
        <Empty
          title="Account unavailable."
          description="This account could not be found or is no longer available."
        />
      )}
    </ScrollView>
  );
}
