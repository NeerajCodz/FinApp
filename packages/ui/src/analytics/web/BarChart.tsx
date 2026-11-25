'use client';

import React from 'react';
import { ColumnChart, RankedBars } from '../../charts/web';

/**
 * Bars for one measure: vertical columns over time, or a ranked horizontal list. Values may be
 * relative, so real `amounts` are shown in tooltips and at row ends.
 */
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
  if (!values.length) return null;
  if (orientation === 'horizontal')
    return (
      <RankedBars
        items={values.map((value, index) => ({
          id: `${labels[index] ?? index}-${index}`,
          label: labels[index] ?? `Item ${index + 1}`,
          value,
          display: amounts?.[index] ?? `${Math.round(value)}%`,
          ...(details?.[index] ? { detail: details[index] } : {}),
        }))}
      />
    );
  return (
    <ColumnChart
      caption="Spending by period"
      labels={values.map((_, index) => labels[index] ?? '')}
      titles={values.map((_, index) => details?.[index] || labels[index] || `Period ${index + 1}`)}
      series={[{ id: 'spending', label: 'Spending', values }]}
      highlightIndex={highlightIndex}
      format={(value, index) =>
        (index !== undefined ? amounts?.[index] : undefined) ??
        new Intl.NumberFormat().format(Math.round(value))
      }
      axisFormat={() => ''}
    />
  );
}
