import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MoneyText } from '@/components/finance';
import { Button, Empty, Typography } from '@/components/ui';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Transaction</Typography>
      <Typography>{id ?? 'Transaction'}</Typography>
      <MoneyText amountMinor={0n} currency="INR" type="expense" />
      <Empty
        title="Transaction details"
        description="Category, account, date, note, split, and receipt details appear here."
        action={<Button variant="secondary">Edit</Button>}
      />
    </View>
  );
}
