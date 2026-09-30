'use client';

import React, { useState } from 'react';
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

type BarPoint = { label: string; value: number; amount?: string; detail?: string };

export function BarChart({
  values,
  labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  highlightIndex,
  details,
  amounts,
  orientation = 'vertical',
}: {
  values: readonly number[];
  labels?: readonly string[];
  highlightIndex?: number;
  details?: readonly string[];
  amounts?: readonly string[];
  orientation?: 'vertical' | 'horizontal';
}) {
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const horizontal = orientation === 'horizontal';
  const data: BarPoint[] = values.map((value, index) => ({
    label: labels[index] ?? `Period ${index + 1}`,
    value,
    amount: amounts?.[index],
    detail: details?.[index],
  }));
  const maximum = Math.max(...values.map((value) => Math.max(0, value)), 1);
  const height = horizontal ? Math.max(220, values.length * 38) : 220;
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
      aria-label="Spending bar chart. Use the arrow keys to inspect values."
      style={{ width: '100%', overflowX: horizontal ? 'auto' : undefined }}
    >
      <div
        style={{
          width: horizontal ? '100%' : values.length > 7 ? 680 : '100%',
          minWidth: horizontal ? 300 : values.length > 7 ? 680 : 300,
          height,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={data}
            accessibilityLayer
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: 12, bottom: 4, left: horizontal ? 4 : 0 }}
          >
            <CartesianGrid
              horizontal={!horizontal}
              vertical={horizontal}
              stroke={tokens.borderSubtle}
            />
            <XAxis
              dataKey={horizontal ? 'value' : 'label'}
              type={horizontal ? 'number' : 'category'}
              domain={horizontal ? [0, maximum] : undefined}
              interval={horizontal ? undefined : interval}
              tickLine={false}
              axisLine={{ stroke: tokens.border }}
              tick={{ fill: tokens.foregroundMuted, fontSize: 10 }}
              tickFormatter={horizontal ? (value: number) => `${value}%` : undefined}
              height={horizontal ? 30 : 34}
            />
            <YAxis
              dataKey={horizontal ? 'label' : undefined}
              type={horizontal ? 'category' : 'number'}
              width={horizontal ? 118 : 38}
              tickLine={false}
              axisLine={false}
              tick={{ fill: tokens.foregroundMuted, fontSize: horizontal ? 11 : 10 }}
              tickFormatter={horizontal ? undefined : (value: number) => `${Math.round(value)}%`}
            />
            <Tooltip
              cursor={{ fill: tokens.surfaceRaised }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as BarPoint | undefined;
                if (!active || !point) return null;
                return (
                  <div role="tooltip" style={tooltipStyle}>
                    <strong>{point.detail ?? point.label}</strong>
                    {point.detail && <span>{point.label}</span>}
                    <span>{point.amount ?? `${point.value}%`}</span>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              name="Amount"
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              minPointSize={2}
              onClick={(entry) => {
                const index = data.findIndex((point) => point.label === entry?.payload?.label);
                if (index >= 0) setSelected(index);
              }}
            >
              {data.map((point, index) => (
                <Cell
                  key={`${point.label}-${index}`}
                  fill={
                    highlightIndex === index || selected === index
                      ? tokens.primary
                      : tokens.foreground
                  }
                  fillOpacity={highlightIndex === index || selected === index ? 1 : 0.72}
                />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
      {selected !== null && data[selected] && (
        <Typography variant="small" aria-live="polite">
          {data[selected].detail ?? data[selected].label} ·{' '}
          {data[selected].amount ?? `${data[selected].value}%`}
        </Typography>
      )}
    </div>
  );
}
