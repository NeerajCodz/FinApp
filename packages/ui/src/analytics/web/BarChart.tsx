import React from 'react';
import { Typography, useTheme } from '@finapp/ui/web';

export function BarChart({
  values,
  labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  highlightIndex,
}: {
  values: readonly number[];
  labels?: readonly string[];
  highlightIndex?: number;
}) {
  const maximum = Math.max(...values, 1);
  const { tokens } = useTheme();
  return (
    <div aria-label="Spending bar chart" style={{ display: 'grid', gap: 10 }}>
      <div style={{ height: 150, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {values.map((value, index) => {
          const highlighted = index === highlightIndex;
          return (
            <div key={`${labels[index] ?? index}-${index}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(4, (value / maximum) * 100)}%`,
                  borderRadius: 5,
                  backgroundColor: highlighted ? tokens.primary : tokens.foreground,
                  opacity: highlighted ? 1 : 0.72,
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {values.map((_, index) => (
          <Typography key={`${labels[index] ?? index}-${index}`} variant="caption" style={{ flex: 1, textAlign: 'center' }}>
            {labels[index] ?? ''}
          </Typography>
        ))}
      </div>
    </div>
  );
}
