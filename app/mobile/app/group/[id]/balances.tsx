import React from 'react';
import { View } from 'react-native';
import { BalanceRow } from '@/components/finance';
import { Empty, Typography } from '@/components/ui';

export default function BalancesScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Balances</Typography>
      <BalanceRow name="No balance yet" balanceMinor={0n} currency="INR" />
      <Empty title="All settled" />
    </View>
  );
}
