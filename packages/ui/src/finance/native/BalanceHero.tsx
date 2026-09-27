import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Typography, useTheme } from '@finapp/ui/native';
import { Eye, EyeOff } from '@finapp/ui/icons/native';
import { Money } from './Money';

export function BalanceHero({
  label = 'Available',
  amountMinor,
  currency,
  delta,
}: {
  label?: string;
  amountMinor: bigint;
  currency: string;
  delta?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Typography variant="label">{label}</Typography>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
          onPress={() => setHidden((current) => !current)}
          hitSlop={10}
          activeOpacity={0.64}
        >
          {hidden ? (
            <EyeOff size={17} color={tokens.foregroundSubtle} />
          ) : (
            <Eye size={17} color={tokens.foregroundSubtle} />
          )}
        </TouchableOpacity>
      </View>
      <Money amountMinor={amountMinor} currency={currency} size="hero" hidden={hidden} />
      {delta && (
        <Typography
          variant="small"
          style={{ color: tokens.primary, fontFamily: 'SpaceGrotesk_500Medium' }}
        >
          {delta}
        </Typography>
      )}
    </View>
  );
}
