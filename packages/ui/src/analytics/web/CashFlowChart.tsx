import React, { useRef, useState } from 'react';
import { Typography, useTheme } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import type { AnalyticsBucket } from '@convex/analytics/domain';

export function CashFlowChart({
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
  const scrollView = useRef<HTMLDivElement>(null);
  const maximum = buckets.reduce((max, bucket) => {
    const amount = bucket.amountMinor > bucket.incomeMinor ? bucket.amountMinor : bucket.incomeMinor;
    return amount > max ? amount : max;
  }, 0n);
  const height = 116;
  const periodWidth = buckets.length > 12 ? 46 : buckets.length > 7 ? 54 : 48;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <Typography variant="caption" style={{ color: tokens.expense }}>■ Spend</Typography>
        <Typography variant="caption" style={{ color: tokens.income }}>■ Income</Typography>
      </div>
      {buckets.length === 0 ? (
        <Typography variant="small">No cash flow in this period.</Typography>
      ) : (
        <div ref={scrollView} style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', width: 'max-content' }}>
            {buckets.map((bucket, index) => {
              const accessible = `${bucket.label}: spent ${formatMinor(bucket.amountMinor, currency)}, income ${formatMinor(bucket.incomeMinor, currency)}`;
              const barHeight = (amount: bigint) => maximum > 0n ? Number((amount * BigInt(height)) / maximum) : 0;
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
                  style={{ border: 0, background: 'transparent', padding: 0, color: 'inherit', cursor: 'pointer', width: periodWidth, display: 'grid', gap: 7 }}
                >
                  <div style={{
                    width: periodWidth,
                    height,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: 4,
                    borderBottom: `1px solid ${tokens.border}`,
                  }}>
                    <div style={{ width: 11, height: Math.max(barHeight(bucket.amountMinor), bucket.amountMinor > 0n ? 2 : 0), borderRadius: 2, backgroundColor: tokens.expense }} />
                    <div style={{ width: 11, height: Math.max(barHeight(bucket.incomeMinor), bucket.incomeMinor > 0n ? 2 : 0), borderRadius: 2, backgroundColor: tokens.income }} />
                  </div>
                  <Typography variant="caption" style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'center',
                    color: selected === index ? tokens.foreground : tokens.foregroundMuted,
                  }}>
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
