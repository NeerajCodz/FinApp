import React from 'react';
import { View } from 'react-native';
import { Typography } from '@finapp/ui/native';
import { Money } from './Money';
import { SemanticMarker } from './SemanticMarker';

export function SplitMemberRow({
  name,
  amountMinor,
  currency,
}: {
  name: string;
  amountMinor: bigint;
  currency: string;
}) {
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="bodyLarge" numberOfLines={1}>
          {name}
        </Typography>
        <SemanticMarker type="split" />
      </View>
      <Money amountMinor={amountMinor} currency={currency} />
    </View>
  );
}
