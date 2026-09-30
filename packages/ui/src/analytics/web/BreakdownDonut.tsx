import React from 'react';
import { Typography, useTheme } from '@finapp/ui/web';
import { CategoryIcon } from '@finapp/ui/finance';
import { formatMinor } from '@convex/shared/money';
import type { AnalyticsBreakdownItem } from '@convex/analytics/domain';

const chartColors = ['volt', 'blue', 'violet', 'orange', 'pink', 'cyan', 'yellow'] as const;

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
  const { tokens } = useTheme();
  const colors = chartColors.map((name) => tokens.chart[name]);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {totalMinor > 0n && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 142,
          }}
        >
          <svg
            width={142}
            height={142}
            viewBox="0 0 142 142"
            role="img"
            aria-label="Expense share by category"
          >
            <circle
              cx={71}
              cy={71}
              r={radius}
              stroke={tokens.borderSubtle}
              strokeWidth={19}
              fill="none"
            />
            {items.map((item, index) => {
              const fraction = Number((item.amountMinor * 10000n) / totalMinor) / 10000;
              const length = circumference * fraction;
              const segment = (
                <circle
                  key={item.id}
                  cx={71}
                  cy={71}
                  r={radius}
                  stroke={colors[index % colors.length]}
                  strokeWidth={19}
                  fill="none"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 71 71)"
                />
              );
              offset += length;
              return segment;
            })}
          </svg>
          <div style={{ position: 'absolute', display: 'grid', justifyItems: 'center' }}>
            <Typography variant="caption">Total spent</Typography>
            <Typography variant="small">{formatMinor(totalMinor, currency)}</Typography>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <Typography variant="small">No posted expenses in this period.</Typography>
      ) : (
        items.map((item, index) => {
          const percentage =
            totalMinor > 0n ? Number((item.amountMinor * 1000n) / totalMinor) / 10 : 0;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`${item.label}, ${formatMinor(item.amountMinor, currency)}, ${percentage}% of spending`}
              onClick={() => onSelectItem?.(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 48,
                width: '100%',
                padding: 0,
                border: 0,
                background: 'transparent',
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  flex: '0 0 8px',
                  borderRadius: 4,
                  backgroundColor: colors[index % colors.length],
                }}
              />
              {iconForCategory && (
                <CategoryIcon label={item.label} icon={iconForCategory(item.id)} />
              )}
              <Typography variant="small" style={{ flex: 1 }}>
                {item.label}
              </Typography>
              <span style={{ display: 'grid', justifyItems: 'end', minWidth: 88 }}>
                <Typography variant="small">{formatMinor(item.amountMinor, currency)}</Typography>
                <Typography variant="caption">{percentage}%</Typography>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
