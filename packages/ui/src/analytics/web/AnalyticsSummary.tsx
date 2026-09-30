'use client';
import { Card, Typography } from '@finapp/ui/web';

export type AnalyticsMetric = {
  label: string;
  value: string;
  color: string;
  detail?: string;
};

type AnalyticsSummaryProps = {
  metrics: AnalyticsMetric[];
};

export function AnalyticsSummary({ metrics }: AnalyticsSummaryProps) {
  return (
    <section className="analytics-summary" aria-label="Analytics summary">
      {metrics.map((item) => (
        <Card key={item.label} variant="subtle" className="analytics-summary-card">
          <Typography variant="caption">{item.label}</Typography>
          <Typography
            variant="heading"
            className="analytics-summary-value"
            style={{ color: item.color }}
          >
            {item.value}
          </Typography>
          {item.detail && <Typography variant="caption">{item.detail}</Typography>}
        </Card>
      ))}
    </section>
  );
}
