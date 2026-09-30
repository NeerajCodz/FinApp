'use client';

import type { ReactNode } from 'react';
import { Card, Typography } from '@finapp/ui/web';
import { ChartTypeSelect, type ChartTypeOption } from './ChartTypeSelect';

export function AnalyticsChartPanel({
  title,
  description,
  chartType,
  chartTypes,
  onChartTypeChange,
  children,
}: {
  title: string;
  description: string;
  chartType: string;
  chartTypes: readonly ChartTypeOption[];
  onChartTypeChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Card className="analytics-chart-panel">
      <header className="analytics-chart-heading">
        <div>
          <Typography variant="bodyLarge">{title}</Typography>
          <Typography variant="caption">{description}</Typography>
        </div>
        <ChartTypeSelect
          label={title}
          value={chartType}
          options={chartTypes}
          onChange={onChartTypeChange}
        />
      </header>
      {children}
    </Card>
  );
}
