import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BalanceRow } from '@/components/finance';
import { Button, Empty, Typography } from '@/components/ui';

export default function GroupHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">{id ?? 'Group'}</Typography>
      <Typography>5 members</Typography>
      <BalanceRow name="Your net balance" balanceMinor={0n} currency="INR" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button onPress={() => router.push('/split/new' as never)}>Add expense</Button>
        <Button variant="secondary" onPress={() => router.push('/settle/new' as never)}>
          Settle
        </Button>
      </View>
      <Empty title="No shared records" description="Expenses and settlements will appear here." />
    </View>
  );
}
