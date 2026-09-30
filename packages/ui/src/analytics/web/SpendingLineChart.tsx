'use client';

import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Typography, useTheme } from '@finapp/ui/web';

type LinePoint = { value: number; axisLabel: string; detail: string; amount?: string };

export function SpendingLineChart({
  values,
  labels = ['1 Aug', 'Today'],
  xLabels,
  details,
  amounts,
}: {
  values: readonly number[];
  labels?: readonly [string, string];
  xLabels?: readonly string[];
  details?: readonly string[];
  amounts?: readonly string[];
}) {
  const { tokens } = useTheme();
  const maximum = Math.max(...values, 0);
  const minimum = Math.min(...values, 0);
  const padding = Math.max((maximum - minimum) * 0.08, 1);
  const data: LinePoint[] = values.map((value, index) => ({
    value,
    axisLabel:
      xLabels?.[index] ?? (index === 0 ? labels[0] : index === values.length - 1 ? labels[1] : ''),
    detail:
      details?.[index] ??
      (index === 0
        ? labels[0]
        : index === values.length - 1
          ? labels[1]
          : `Period ${index + 1} of ${values.length} · ${labels[0]} to ${labels[1]}`),
    amount: amounts?.[index],
  }));
  const height = 220;
  const interval = values.length > 12 ? Math.ceil(values.length / 10) - 1 : 0;
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
  if (!values.length) return null;

  return (
    <div
      role="group"
      aria-label="Spending line chart. Use the arrow keys to inspect values."
      style={{ width: '100%', overflowX: values.length > 7 ? 'auto' : undefined }}
    >
      <div
        style={{
          width: values.length > 7 ? 680 : '100%',
          minWidth: values.length > 7 ? 680 : 300,
          height,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart
            data={data}
            accessibilityLayer
            margin={{ top: 10, right: 14, bottom: 4, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={tokens.borderSubtle} />
            <XAxis
              dataKey="axisLabel"
              interval={interval}
              tickLine={false}
              axisLine={{ stroke: tokens.border }}
              tick={{ fill: tokens.foregroundMuted, fontSize: 10 }}
              height={34}
            />
            <YAxis
              width={38}
              domain={[Math.min(0, minimum - padding), Math.max(1, maximum + padding)]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: tokens.foregroundMuted, fontSize: 10 }}
              tickFormatter={(value: number) =>
                new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
              }
            />
            <Tooltip
              cursor={{ stroke: tokens.border, strokeDasharray: '4 4' }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as LinePoint | undefined;
                if (!active || !point) return null;
                return (
                  <div role="tooltip" style={tooltipStyle}>
                    <strong>{point.detail}</strong>
                    <span>
                      {point.amount ??
                        new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
                          point.value,
                        )}
                    </span>
                  </div>
                );
              }}
            />
            <Line
              dataKey="value"
              name="Spent"
              type="monotone"
              stroke={tokens.primary}
              strokeWidth={2.5}
              dot={{ r: 3, fill: tokens.primary, stroke: tokens.background, strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: tokens.primary, stroke: tokens.background, strokeWidth: 2 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
