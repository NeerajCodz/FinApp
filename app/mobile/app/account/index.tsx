import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, CaretRight, Plus } from '@/lib/icons';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, Separator, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

const ACCOUNT_TYPES = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  wallet: 'Wallet',
  loan: 'Loan',
  other: 'Other',
} as const;

export default function AccountsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const accounts = useQuery(api.accounts.queries.list);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 28,
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

      {accounts === undefined ? (
        <Typography variant="small">Loading accounts…</Typography>
      ) : accounts.length === 0 ? (
        <Empty
          title="No accounts yet."
          description="Add cash, a bank account, card, or wallet to organize your money."
          action={
            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push('/account/new' as never)}
            >
              Add account
            </Button>
          }
        />
      ) : (
        <View>
          {accounts.map((account, index) => (
            <React.Fragment key={account.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${account.name} account`}
                onPress={() => router.push(`/account/${account.id}` as never)}
                style={({ pressed }) => ({
                  minHeight: 76,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Typography variant="bodyLarge" numberOfLines={1}>
                    {account.name}
                  </Typography>
                  <Typography variant="caption">
                    {ACCOUNT_TYPES[account.type]} · {account.currency}
                  </Typography>
                </View>
                <Money amountMinor={account.balanceMinor} currency={account.currency} />
                <CaretRight size={18} color={tokens.foregroundSubtle} />
              </Pressable>
              {index < accounts.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        gap: 12,
        backgroundColor: tokens.background,
      }}
    >
      <Typography variant="heading">Could not load accounts.</Typography>
      <Typography variant="small">{error.message}</Typography>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
