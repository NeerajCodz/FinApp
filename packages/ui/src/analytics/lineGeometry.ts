import type { AnalyticsBucket } from '@convex/analytics/domain';

export type CashFlowLinePoint = {
  x: number;
  spendY: number;
  incomeY: number;
  netY: number;
};

export type CashFlowLineGeometry = {
  width: number;
  height: number;
  zeroY: number;
  gridYs: readonly number[];
  points: readonly CashFlowLinePoint[];
  net: string;
};

export function cashFlowLineGeometry(
  buckets: readonly AnalyticsBucket[],
  width = 1000,
  height = 176,
  padding = 14,
): CashFlowLineGeometry {
  let minimum = 0n;
  let maximum = 0n;
  for (const bucket of buckets) {
    const net = bucket.incomeMinor - bucket.amountMinor;
    if (bucket.amountMinor < minimum) minimum = bucket.amountMinor;
    if (bucket.amountMinor > maximum) maximum = bucket.amountMinor;
    if (bucket.incomeMinor < minimum) minimum = bucket.incomeMinor;
    if (bucket.incomeMinor > maximum) maximum = bucket.incomeMinor;
    if (net < minimum) minimum = net;
    if (net > maximum) maximum = net;
  }
  const span = maximum > minimum ? maximum - minimum : 1n;
  const plotHeight = height - padding * 2;
  const plotWidth = width - padding * 2;
  const scaleY = (value: bigint) => {
    const fraction = Number(((value - minimum) * 1_000_000n) / span) / 1_000_000;
    return Number((height - padding - fraction * plotHeight).toFixed(2));
  };
  const points: CashFlowLinePoint[] = [];
  let net = '';
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index]!;
    const x = Number(
      (padding + (buckets.length <= 1 ? 0.5 : index / (buckets.length - 1)) * plotWidth).toFixed(2),
    );
    const point = {
      x,
      spendY: scaleY(bucket.amountMinor),
      incomeY: scaleY(bucket.incomeMinor),
      netY: scaleY(bucket.incomeMinor - bucket.amountMinor),
    };
    points.push(point);
    net += `${index === 0 ? '' : ' '}${x},${point.netY}`;
  }
  return {
    width,
    height,
    zeroY: scaleY(0n),
    gridYs: [
      Number((padding + plotHeight / 3).toFixed(2)),
      Number((padding + (plotHeight * 2) / 3).toFixed(2)),
    ],
    points,
    net,
  };
}
