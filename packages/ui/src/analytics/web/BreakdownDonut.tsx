'use client';

import React from 'react';
import { formatMinor } from '@convex/shared/money';
import type { AnalyticsBreakdownItem } from '@convex/analytics/domain';
import { DonutChart } from '../../charts/web';
import { toMajor } from '../chart-utils';

/** Spending by category: a donut with the total in the middle and a legend (share, amount). */
export function BreakdownDonut({
  items,
  totalMinor,
  currency,
  onSelectItem,
  iconForCategory,
}: {
  items: readonly AnalyticsBreakdownItem[];
  totalMinor: bigint;
  currency: string;
  onSelectItem?: (item: AnalyticsBreakdownItem) => void;
  iconForCategory?: (id: string) => string | undefined;
}) {
  // Eight colours at most (never cycled): everything past the top seven folds into "Other".
  const sorted = [...items].sort((a, b) => (b.amountMinor > a.amountMinor ? 1 : -1));
  const head = sorted.slice(0, 7);
  const rest = sorted.slice(7);
  const otherMinor = rest.reduce((sum, item) => sum + item.amountMinor, 0n);
  const rows = [
    ...head.map((item) => ({
      item: item as AnalyticsBreakdownItem | null,
      minor: item.amountMinor,
    })),
    ...(otherMinor > 0n ? [{ item: null, minor: otherMinor }] : []),
  ];
  return (
    <DonutChart
      caption="Expenses by category"
      centerValue={formatMinor(totalMinor, currency)}
      centerLabel="Total spent"
      items={rows.map(({ item, minor }) => {
        const icon = item ? iconForCategory?.(item.id) : undefined;
        return {
          id: item?.id ?? '__other__',
          label: item?.label ?? `Other (${rest.length})`,
          value: toMajor(minor, currency),
          display: formatMinor(minor, currency),
          ...(icon ? { icon: <span aria-hidden>{icon}</span> } : {}),
        };
      })}
      onSelect={
        onSelectItem
          ? (picked) => {
              const match = items.find((item) => item.id === picked.id);
              if (match) onSelectItem(match);
            }
          : undefined
      }
    />
  );
}
