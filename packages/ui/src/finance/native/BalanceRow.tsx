import React from 'react';
import { View } from 'react-native';
import { Typography } from '@finapp/ui/native';
import { Money } from './Money';

export function BalanceRow({
  name,
  balanceMinor,
  currency,
}: {
  name: string;
  balanceMinor: bigint;
  currency: string;
}) {
  const owesYou = balanceMinor >= 0n;
  const absolute = owesYou ? balanceMinor : -balanceMinor;
  return (
    <View
      style={{
        minHeight: 60,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View style={{ gap: 2 }}>
        <Typography variant="bodyLarge">{name}</Typography>
        <Typography variant="caption">{owesYou ? 'owes you' : 'you owe'}</Typography>
      </View>
      <Money amountMinor={absolute} currency={currency} />
    </View>
  );
}
