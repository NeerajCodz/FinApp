import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AccountCard } from '@/components/finance';
import { Button, Empty, Typography } from '@/components/ui';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Account</Typography>
      <AccountCard name={id ?? 'Account'} balanceMinor={0n} currency="INR" />
      <Empty
        title="No transactions"
        description="Transactions for this account will appear here."
        action={
          <Button onPress={() => router.push('/transaction/new' as never)}>Add transaction</Button>
        }
      />
    </View>
  );
}
