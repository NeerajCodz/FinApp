'use client';

import React, { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart as RechartsComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Typography, useTheme } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import type { AnalyticsBucket } from '@convex/analytics/domain';
import { formatBucketAxisLabel, formatBucketDate, scaledMinor } from '../chart-utils';

type CashFlowPoint = {
  bucket: AnalyticsBucket;
  axisLabel: string;
  income: number;
  expense: number;
  net: number;
};

export function CashFlowChart({
  buckets,
  currency,
  onSelectBucket,
  timeZone = 'UTC',
}: {
  buckets: readonly AnalyticsBucket[];
  currency: string;
  onSelectBucket?: (bucket: AnalyticsBucket) => void;
  timeZone?: string;
}) {
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const maximum = buckets.reduce((max, bucket) => {
    const amount =
      bucket.amountMinor > bucket.incomeMinor ? bucket.amountMinor : bucket.incomeMinor;
    return amount > max ? amount : max;
  }, 0n);
  const data: CashFlowPoint[] = buckets.map((bucket) => ({
    bucket,
    axisLabel: formatBucketAxisLabel(bucket, timeZone),
    income: scaledMinor(bucket.incomeMinor, maximum),
    expense: -scaledMinor(bucket.amountMinor, maximum),
    net: scaledMinor(bucket.incomeMinor - bucket.amountMinor, maximum),
  }));
  const selectedBucket = selected === null ? undefined : buckets[selected];
  const chartWidth = buckets.length > 7 ? 720 : '100%';
  const tickInterval = buckets.length > 12 ? Math.ceil(buckets.length / 10) - 1 : 0;
  const tooltipStyle: React.CSSProperties = {
    display: 'grid',
    gap: 5,
    padding: '10px 12px',
    border: `1px solid ${tokens.border}`,
    borderRadius: 12,
    color: tokens.foreground,
    background: tokens.popover,
    boxShadow: `0 8px 24px ${tokens.overlay}`,
  };

  if (!buckets.length) return <Typography variant="small">No cash flow in this period.</Typography>;

  const selectBucket = (bucket: AnalyticsBucket | undefined) => {
    if (!bucket) return;
    const index = buckets.indexOf(bucket);
    setSelected(index);
    onSelectBucket?.(bucket);
  };

  return (
    <div
      role="group"
      aria-label="Cash flow chart. Income bars rise above zero, expenses fall below zero, and the line shows net cash flow."
      style={{ display: 'grid', gap: 12 }}
    >
      <div
        aria-label="Cash flow chart legend"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}
      >
        <Typography variant="caption" style={{ color: tokens.income }}>
          ■ Income
        </Typography>
        <Typography variant="caption" style={{ color: tokens.expense }}>
          ■ Expenses (below zero)
        </Typography>
        <Typography variant="caption" style={{ color: tokens.foreground }}>
          ━ Net cash flow
        </Typography>
      </div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ width: chartWidth, minWidth: buckets.length > 7 ? 720 : 300, height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsComposedChart
              data={data}
              accessibilityLayer
              margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
            >
              <CartesianGrid vertical={false} stroke={tokens.borderSubtle} />
              <XAxis
                dataKey="axisLabel"
                interval={tickInterval}
                tickLine={false}
                axisLine={{ stroke: tokens.border }}
                tick={{ fill: tokens.foregroundMuted, fontSize: 11 }}
                height={30}
              />
              <YAxis
                width={76}
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: tokens.foregroundMuted, fontSize: 10 }}
                tickFormatter={(value: number) => {
                  const scaled = BigInt(Math.round(value * 1_000_000));
                  return formatMinor((maximum * scaled) / 1_000_000n, currency);
                }}
              />
              <ReferenceLine y={0} stroke={tokens.foregroundMuted} strokeWidth={1.5} />
              <Tooltip
                cursor={{ fill: tokens.surfaceRaised }}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as CashFlowPoint | undefined;
                  if (!active || !point) return null;
                  const { bucket } = point;
                  return (
                    <div role="tooltip" style={tooltipStyle}>
                      <strong>{formatBucketDate(bucket, timeZone)}</strong>
                      <span>{bucket.label}</span>
                      <span style={{ color: tokens.income }}>
                        Income: {formatMinor(bucket.incomeMinor, currency)}
                      </span>
                      <span style={{ color: tokens.expense }}>
                        Expenses: {formatMinor(-bucket.amountMinor, currency)}
                      </span>
                      <span>
                        Net cash flow:{' '}
                        {formatMinor(bucket.incomeMinor - bucket.amountMinor, currency)}
                      </span>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill={tokens.income}
                radius={[3, 3, 0, 0]}
                maxBarSize={15}
                onClick={(entry) => selectBucket(entry?.payload?.bucket)}
              />
              <Bar
                dataKey="expense"
                name="Expenses"
                fill={tokens.expense}
                radius={[0, 0, 3, 3]}
                maxBarSize={15}
                onClick={(entry) => selectBucket(entry?.payload?.bucket)}
              />
              <Line
                dataKey="net"
                name="Net cash flow"
                type="linear"
                stroke={tokens.foreground}
                strokeWidth={2.5}
                dot={{ r: 3, fill: tokens.foreground, stroke: tokens.background, strokeWidth: 1.5 }}
                activeDot={{
                  r: 5,
                  fill: tokens.foreground,
                  stroke: tokens.background,
                  strokeWidth: 2,
                }}
              />
            </RechartsComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {selectedBucket && (
        <Typography variant="small" aria-live="polite">
          {formatBucketDate(selectedBucket, timeZone)} · Income{' '}
          {formatMinor(selectedBucket.incomeMinor, currency)} · Expenses{' '}
          {formatMinor(-selectedBucket.amountMinor, currency)} · Net{' '}
          {formatMinor(selectedBucket.incomeMinor - selectedBucket.amountMinor, currency)}
        </Typography>
      )}
    </div>
  );
}
