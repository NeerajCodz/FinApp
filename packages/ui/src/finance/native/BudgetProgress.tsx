import React from 'react';
import { View } from 'react-native';
import { Progress, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '../money';

export function BudgetProgress({
  spentMinor,
  limitMinor,
  currency,
  title = 'Budget',
  primary = false,
}: {
  spentMinor: bigint;
  limitMinor: bigint;
  currency: string;
  title?: string;
  primary?: boolean;
}) {
  const { tokens } = useTheme();
  const percentage = limitMinor > 0n ? Number((spentMinor * 100n) / limitMinor) : 0;
  const over = spentMinor > limitMinor;
  const left = over ? spentMinor - limitMinor : limitMinor - spentMinor;
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View style={{ gap: 2 }}>
          <Typography variant="bodyLarge">{title}</Typography>
          <Typography variant="caption">
            {formatMinor(spentMinor, currency)} of {formatMinor(limitMinor, currency)}
          </Typography>
        </View>
        <Typography
          variant="small"
          style={{ color: over ? tokens.destructive : tokens.foreground }}
        >
          {over ? `${formatMinor(left, currency)} over` : `${formatMinor(left, currency)} left`}
        </Typography>
      </View>
      <Progress
        value={percentage}
        color={over ? tokens.destructive : primary ? tokens.primary : tokens.foreground}
      />
      <Typography variant="caption">{percentage}%</Typography>
    </View>
  );
}
