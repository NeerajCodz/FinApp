'use client';

import React from 'react';
import { Typography } from '@finapp/ui/web';
import type { AnalyticsBucket } from '@convex/analytics/domain';
import { ColumnChart, compactMoney, fullMoney } from '../../charts/web';
import { useTheme } from '../../web/ThemeProvider';
import { formatBucketAxisLabel, formatBucketDate, toMajor } from '../chart-utils';

/** Income above zero, expenses below, net cash flow as a line — real amounts on one axis. */
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
  if (!buckets.length) return <Typography variant="small">No cash flow in this period.</Typography>;
  const income = buckets.map((bucket) => toMajor(bucket.incomeMinor, currency));
  const expense = buckets.map((bucket) => -toMajor(bucket.amountMinor, currency));
  const net = buckets.map((bucket) => toMajor(bucket.incomeMinor - bucket.amountMinor, currency));
  return (
    <ColumnChart
      caption={`Cash flow in ${currency}: income above zero, expenses below, net as a line`}
      mode="diverging"
      labels={buckets.map((bucket) => formatBucketAxisLabel(bucket, timeZone))}
      titles={buckets.map((bucket) => formatBucketDate(bucket, timeZone))}
      series={[
        { id: 'income', label: 'Income', values: income, color: tokens.income },
        { id: 'expense', label: 'Expenses', values: expense, color: tokens.expense },
      ]}
      line={{ id: 'net', label: 'Net', values: net, color: tokens.foreground }}
      format={(value) => fullMoney(value, currency)}
      axisFormat={(value) => compactMoney(value, currency)}
      onSelect={onSelectBucket ? (index) => onSelectBucket(buckets[index]!) : undefined}
    />
  );
}
