'use client';

import React from 'react';
import { Typography } from '@finapp/ui/web';
import { RankedBars } from '../../charts/web';

type InsightPoint = { label: string; value: number; amount: string; color?: string };

/** Compare a few categories: ranked bars with the amount at the end of each row. */
export function InsightBars({ items }: { items: readonly InsightPoint[] }) {
  if (!items.length) return <Typography variant="small">No spending to compare.</Typography>;
  return (
    <RankedBars
      caption="Spending by category"
      items={items.map((item, index) => ({
        id: `${item.label}-${index}`,
        label: item.label,
        value: item.value,
        display: item.amount,
        ...(item.color ? { color: item.color } : {}),
      }))}
    />
  );
}
