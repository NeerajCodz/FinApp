import { Card, Typography } from '@finapp/ui/web';

export type ActivityMetric = {
  label: string;
  value: string;
  color: string;
  spark: readonly number[];
};

export function ActivitySummary({ metrics }: { metrics: readonly ActivityMetric[] }) {
  return (
    <section className="activity-metric-grid" aria-label="Activity summary">
      {metrics.map((metric) => <Card key={metric.label} className="activity-metric-card">
        <Typography variant="caption">{metric.label}</Typography>
        <Typography variant="heading" style={{ color: metric.color, fontVariantNumeric: 'tabular-nums' }}>{metric.value}</Typography>
        <div className="activity-sparkline" aria-hidden="true">{metric.spark.map((height, index) => <span key={`${metric.label}-${index}`} style={{ height: `${height}%` }} />)}</div>
      </Card>)}
    </section>
  );
}
