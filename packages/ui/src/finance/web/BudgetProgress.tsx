import React from 'react';
import { Progress, Typography, useTheme } from '@finapp/ui/web';
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
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <Typography variant="bodyLarge">{title}</Typography>
          <Typography variant="caption">
            {formatMinor(spentMinor, currency)} of {formatMinor(limitMinor, currency)}
          </Typography>
        </div>
        <Typography
          variant="small"
          style={{ color: over ? tokens.destructive : tokens.foreground }}
        >
          {over ? `${formatMinor(left, currency)} over` : `${formatMinor(left, currency)} left`}
        </Typography>
      </div>
      <Progress
        value={percentage}
        color={over ? tokens.destructive : primary ? tokens.primary : tokens.foreground}
      />
      <Typography variant="caption">{percentage}%</Typography>
    </div>
  );
}
