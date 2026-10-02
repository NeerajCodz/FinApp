'use client';

import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Typography, useTheme } from '@finapp/ui/web';
import { CategoryIcon } from '@finapp/ui/finance';
import { formatMinor } from '@convex/shared/money';
import type { AnalyticsBreakdownItem } from '@convex/analytics/domain';
import { FinanceEmptyState } from '../../finance/web/FinanceEmptyState';

const chartColors = ['primary', 'blue', 'violet', 'orange', 'pink', 'cyan', 'yellow'] as const;

type DonutPoint = AnalyticsBreakdownItem & { chartValue: number; percentage: number };

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
  const colors = chartColors.map((name) =>
    name === 'primary' ? tokens.primary : tokens.chart[name],
  );
  const data: DonutPoint[] = items.map((item) => ({
    ...item,
    chartValue:
      totalMinor > 0n ? Math.max(1, Number((item.amountMinor * 1_000_000_000n) / totalMinor)) : 0,
    percentage: totalMinor > 0n ? Number((item.amountMinor * 1000n) / totalMinor) / 10 : 0,
  }));
  const tooltipStyle: React.CSSProperties = {
    display: 'grid',
    gap: 4,
    padding: '10px 12px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 12,
    color: tokens.foreground,
    background: tokens.popover,
    boxShadow: `0 8px 24px ${tokens.overlay}`,
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {totalMinor > 0n && data.length > 0 && (
        <div
          role="group"
          aria-label="Expenses by category"
          style={{ position: 'relative', height: 190 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer>
              <Pie
                data={data}
                dataKey="chartValue"
                nameKey="label"
                innerRadius={53}
                outerRadius={76}
                paddingAngle={1}
                minAngle={1}
                stroke={tokens.background}
                strokeWidth={2}
              >
                {data.map((item, index) => (
                  <Cell key={item.id} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const item = payload?.[0]?.payload as DonutPoint | undefined;
                  if (!active || !item) return null;
                  return (
                    <div role="tooltip" style={tooltipStyle}>
                      <strong>{item.label}</strong>
                      <span>{formatMinor(item.amountMinor, currency)}</span>
                      <span>{item.percentage}% of spending</span>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              alignContent: 'center',
              justifyItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography variant="caption">Total spent</Typography>
            <Typography variant="small">{formatMinor(totalMinor, currency)}</Typography>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <FinanceEmptyState
          kind="analytics"
          compact
          title="No posted expenses in this period"
          description="Category totals will appear here when expenses are recorded."
        />
      ) : (
        items.map((item, index) => {
          const percentage = data[index]?.percentage ?? 0;
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
