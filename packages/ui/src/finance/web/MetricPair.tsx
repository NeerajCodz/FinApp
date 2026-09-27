import React from 'react';
import { Typography } from '@finapp/ui/web';

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <Typography variant="heading" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="caption">{label}</Typography>
    </div>
  );
}

export function MetricPair({
  left,
  right,
}: {
  left: { label: string; value: string };
  right: { label: string; value: string };
}) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: 1 }}>
        <Metric {...left} />
      </div>
      <div style={{ flex: 1 }}>
        <Metric {...right} />
      </div>
    </div>
  );
}
