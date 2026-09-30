'use client';

import React from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Typography, useTheme } from '@finapp/ui/web';

type InsightPoint = { label: string; value: number; amount: string; color?: string };

export function InsightBars({ items }: { items: readonly InsightPoint[] }) {
  const { tokens } = useTheme();
  const maximum = Math.max(...items.map((item) => Math.max(0, item.value)), 1);
  const height = Math.max(120, items.length * 38);
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
  if (!items.length) return <Typography variant="small">No spending to compare.</Typography>;

  return (
    <div
      role="group"
      aria-label="Spending categories chart. Use the arrow keys to inspect amounts."
      style={{ width: '100%', minWidth: 0, height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={items.slice()}
          layout="vertical"
          accessibilityLayer
          margin={{ top: 4, right: 14, bottom: 4, left: 4 }}
        >
          <CartesianGrid horizontal={false} vertical stroke={tokens.borderSubtle} />
          <XAxis
            type="number"
            domain={[0, maximum]}
            tickLine={false}
            axisLine={{ stroke: tokens.border }}
            tick={{ fill: tokens.foregroundMuted, fontSize: 10 }}
          />
          <YAxis
            dataKey="label"
            type="category"
            width={118}
            tickLine={false}
            axisLine={false}
            tick={{ fill: tokens.foregroundMuted, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: tokens.surfaceRaised }}
            content={({ active, payload }) => {
              const item = payload?.[0]?.payload as InsightPoint | undefined;
              if (!active || !item) return null;
              return (
                <div role="tooltip" style={tooltipStyle}>
                  <strong>{item.label}</strong>
                  <span>{item.amount}</span>
                </div>
              );
            }}
          />
          <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]} minPointSize={2}>
            {items.map((item, index) => (
              <Cell key={`${item.label}-${index}`} fill={item.color ?? tokens.foreground} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
