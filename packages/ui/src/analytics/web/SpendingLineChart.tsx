'use client';

import React from 'react';
import { LineChart } from '../../charts/web';

/**
 * A spending trend. Values may be relative (scaled), so the value axis stays unlabelled and the
 * tooltip shows the real `amounts` when given.
 */
export function SpendingLineChart({
  values,
  labels = ['Start', 'Today'],
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
  if (!values.length) return null;
  const axis = values.map(
    (_, index) =>
      xLabels?.[index] ?? (index === 0 ? labels[0] : index === values.length - 1 ? labels[1] : ''),
  );
  return (
    <LineChart
      caption={`Spending from ${labels[0]} to ${labels[1]}`}
      labels={axis}
      titles={values.map((_, index) => details?.[index] || axis[index] || `Point ${index + 1}`)}
      series={[{ id: 'spending', label: 'Spending', values }]}
      format={(value, index) =>
        (index !== undefined ? amounts?.[index] : undefined) ??
        new Intl.NumberFormat().format(Math.round(value))
      }
      axisFormat={() => ''}
    />
  );
}
