'use client';

import React from 'react';

export type ChartDataPoint = {
  label: string;
  value: number;
};

export type ChartProps = {
  data: ChartDataPoint[];
  title?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
  style?: React.CSSProperties;
};

export function Chart({
  data,
  title,
  valueFormatter = (value) => String(value),
  className,
  style,
}: ChartProps) {
  const maxValue = data.reduce((max, { value }) => Math.max(max, value), 0);

  return (
    <figure
      className={className}
      aria-label={title ?? 'Bar chart'}
      style={{
        margin: 0,
        padding: '1rem',
        color: 'var(--finapp-foreground, #fff)',
        background: 'var(--finapp-surface-subtle, rgba(255,255,255,.04))',
        border: '1px solid var(--finapp-border-subtle, rgba(255,255,255,.08))',
        borderRadius: '0.75rem',
        ...style,
      }}
    >
      {title ? (
        <figcaption style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 650 }}>
          {title}
        </figcaption>
      ) : null}
      {data.length ? (
        <ul
          aria-label={title ? `${title} data` : 'Chart data'}
          style={{ display: 'grid', gap: '0.8rem', listStyle: 'none', margin: 0, padding: 0 }}
        >
          {data.map(({ label, value }, index) => {
            const width = maxValue === 0 ? 0 : Math.max(0, (value / maxValue) * 100);
            return (
              <li
                key={`${label}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(5rem, 1fr) minmax(4rem, 3fr) auto',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {label}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    height: '0.7rem',
                    overflow: 'hidden',
                    background: 'var(--finapp-surface-raised, rgba(255,255,255,.08))',
                    borderRadius: 999,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: `${width}%`,
                      height: '100%',
                      background: 'var(--finapp-primary)',
                      borderRadius: 'inherit',
                    }}
                  />
                </span>
                <span>{valueFormatter(value)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ margin: 0, color: 'var(--finapp-foreground-muted, #aaa)' }}>
          No data to display.
        </p>
      )}
    </figure>
  );
}
