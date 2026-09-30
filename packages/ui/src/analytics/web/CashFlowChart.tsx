import React, { useRef, useState } from 'react';
import { Typography, useTheme } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import type { AnalyticsBucket } from '@convex/analytics/domain';
import { cashFlowLineGeometry } from '../lineGeometry';

export function CashFlowChart({
  buckets,
  currency,
  onSelectBucket,
  variant = 'bars',
}: {
  buckets: readonly AnalyticsBucket[];
  currency: string;
  onSelectBucket?: (bucket: AnalyticsBucket) => void;
  variant?: 'bars' | 'lines';
}) {
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const scrollView = useRef<HTMLDivElement>(null);
  if (variant === 'lines')
    return <CashFlowLines buckets={buckets} currency={currency} onSelectBucket={onSelectBucket} />;
  const maximum = buckets.reduce((max, bucket) => {
    const amount =
      bucket.amountMinor > bucket.incomeMinor ? bucket.amountMinor : bucket.incomeMinor;
    return amount > max ? amount : max;
  }, 0n);
  const height = 116;
  const periodWidth = buckets.length > 12 ? 46 : buckets.length > 7 ? 54 : 48;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <Typography variant="caption" style={{ color: tokens.expense }}>
          ■ Spend
        </Typography>
        <Typography variant="caption" style={{ color: tokens.income }}>
          ■ Income
        </Typography>
      </div>
      {buckets.length === 0 ? (
        <Typography variant="small">No cash flow in this period.</Typography>
      ) : (
        <div ref={scrollView} style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', width: 'max-content' }}>
            {buckets.map((bucket, index) => {
              const accessible = `${bucket.label}: spent ${formatMinor(bucket.amountMinor, currency)}, income ${formatMinor(bucket.incomeMinor, currency)}`;
              const barHeight = (amount: bigint) =>
                maximum > 0n ? Number((amount * BigInt(height)) / maximum) : 0;
              return (
                <button
                  key={bucket.startAt}
                  type="button"
                  aria-label={accessible}
                  aria-pressed={selected === index}
                  onClick={() => {
                    setSelected(index);
                    onSelectBucket?.(bucket);
                  }}
                  style={{
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    color: 'inherit',
                    cursor: 'pointer',
                    width: periodWidth,
                    display: 'grid',
                    gap: 7,
                  }}
                >
                  <div
                    style={{
                      width: periodWidth,
                      height,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      gap: 4,
                      borderBottom: `1px solid ${tokens.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: 11,
                        height: Math.max(
                          barHeight(bucket.amountMinor),
                          bucket.amountMinor > 0n ? 2 : 0,
                        ),
                        borderRadius: 2,
                        backgroundColor: tokens.expense,
                      }}
                    />
                    <div
                      style={{
                        width: 11,
                        height: Math.max(
                          barHeight(bucket.incomeMinor),
                          bucket.incomeMinor > 0n ? 2 : 0,
                        ),
                        borderRadius: 2,
                        backgroundColor: tokens.income,
                      }}
                    />
                  </div>
                  <Typography
                    variant="caption"
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'center',
                      color: selected === index ? tokens.foreground : tokens.foregroundMuted,
                    }}
                  >
                    {buckets.length > 12
                      ? index % 5 !== 0 && index !== buckets.length - 1
                        ? ' '
                        : bucket.label.split(' ').at(-1)
                      : bucket.label}
                  </Typography>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {selected !== null && buckets[selected] && (
        <Typography variant="small">
          {buckets[selected].label} · Spent {formatMinor(buckets[selected].amountMinor, currency)} ·
          Income {formatMinor(buckets[selected].incomeMinor, currency)}
        </Typography>
      )}
    </div>
  );
}
function CashFlowLines({
  buckets,
  currency,
  onSelectBucket,
}: {
  buckets: readonly AnalyticsBucket[];
  currency: string;
  onSelectBucket?: (bucket: AnalyticsBucket) => void;
}) {
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const geometry = cashFlowLineGeometry(buckets);
  if (!buckets.length) return <Typography variant="small">No cash flow in this period.</Typography>;
  const current = selected === null ? undefined : buckets[selected];
  const point = selected === null ? undefined : geometry.points[selected];
  const stride = Math.max(1, Math.ceil(buckets.length / 7));
  const barWidth = Math.max(4, Math.min(12, (900 / buckets.length) * 0.28));
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Typography variant="caption" style={{ color: tokens.income }}>
          ■ Income
        </Typography>
        <Typography variant="caption" style={{ color: tokens.expense }}>
          ■ Expenses
        </Typography>
        <Typography variant="caption" style={{ color: tokens.foreground }}>
          ━ Net cash flow
        </Typography>
      </div>
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        role="img"
        aria-label="Income and expense bars with net cash flow line"
        style={{ display: 'block', width: '100%', height: 168, overflow: 'visible' }}
      >
        {geometry.gridYs.map((y) => (
          <line
            key={y}
            x1="0"
            x2={geometry.width}
            y1={y}
            y2={y}
            stroke={tokens.borderSubtle}
            strokeDasharray="5 8"
          />
        ))}
        <line
          x1="0"
          x2={geometry.width}
          y1={geometry.zeroY}
          y2={geometry.zeroY}
          stroke={tokens.border}
        />
        {geometry.points.map((entry, index) => {
          const bucket = buckets[index]!;
          const expenseHeight = Math.abs(geometry.zeroY - entry.spendY);
          const incomeHeight = Math.abs(geometry.zeroY - entry.incomeY);
          return (
            <g key={bucket.startAt}>
              {bucket.amountMinor > 0n && (
                <rect
                  x={entry.x - barWidth - 1}
                  y={Math.min(geometry.zeroY, entry.spendY)}
                  width={barWidth}
                  height={expenseHeight}
                  fill={tokens.expense}
                  rx="2"
                />
              )}
              {bucket.incomeMinor > 0n && (
                <rect
                  x={entry.x + 1}
                  y={Math.min(geometry.zeroY, entry.incomeY)}
                  width={barWidth}
                  height={incomeHeight}
                  fill={tokens.income}
                  rx="2"
                />
              )}
            </g>
          );
        })}
        <polyline
          points={geometry.net}
          fill="none"
          stroke={tokens.foreground}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {point && (
          <circle
            cx={point.x}
            cy={point.netY}
            r="6"
            fill={tokens.foreground}
            stroke={tokens.background}
            strokeWidth="3"
          />
        )}
      </svg>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`,
        }}
      >
        {buckets.map((bucket, index) => (
          <button
            key={bucket.startAt}
            type="button"
            aria-label={`${bucket.label}: expenses ${formatMinor(bucket.amountMinor, currency)}, income ${formatMinor(bucket.incomeMinor, currency)}, net cash flow ${formatMinor(bucket.incomeMinor - bucket.amountMinor, currency)}`}
            aria-pressed={selected === index}
            onClick={() => {
              setSelected(index);
              onSelectBucket?.(bucket);
            }}
            style={{
              minWidth: 0,
              border: 0,
              padding: '2px 0',
              background: 'transparent',
              color: selected === index ? tokens.foreground : tokens.foregroundMuted,
              font: 'inherit',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            {index % stride === 0 || index === buckets.length - 1 ? bucket.label : ''}
          </button>
        ))}
      </div>
      {current && (
        <Typography variant="small">
          {current.label} · Expenses {formatMinor(current.amountMinor, currency)} · Income{' '}
          {formatMinor(current.incomeMinor, currency)} · Net cash flow{' '}
          {formatMinor(current.incomeMinor - current.amountMinor, currency)}
        </Typography>
      )}
    </div>
  );
}
