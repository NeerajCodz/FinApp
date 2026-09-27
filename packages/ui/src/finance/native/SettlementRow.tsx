import React from 'react';
import { View } from 'react-native';
import { SemanticMarker } from './SemanticMarker';
import { BalanceRow } from './BalanceRow';

export function SettlementRow({
  name,
  amountMinor,
  currency,
}: {
  name: string;
  amountMinor: bigint;
  currency: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      <SemanticMarker type="settlement" />
      <BalanceRow name={name} balanceMinor={amountMinor} currency={currency} />
    </View>
  );
}
