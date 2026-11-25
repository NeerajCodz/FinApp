import type { AnalyticsBucket } from '@convex/analytics/domain';
import { minorDigits } from '@convex/shared/money';

export function formatBucketDate(bucket: AnalyticsBucket, timeZone = 'UTC') {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeZone,
  }).format(new Date(bucket.startAt));
}

export function formatBucketAxisLabel(bucket: AnalyticsBucket, timeZone = 'UTC') {
  if (bucket.endAt - bucket.startAt > 7 * 24 * 60 * 60 * 1000) return bucket.label;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    timeZone,
  }).format(new Date(bucket.startAt));
}

export function scaledMinor(value: bigint, maximum: bigint) {
  if (maximum <= 0n) return 0;
  return Number((value * 1_000_000n) / maximum) / 1_000_000;
}

/** Minor units → a plottable major-unit number (₹12,345.67 → 12345.67). */
export function toMajor(minor: bigint, currency: string): number {
  const digits = minorDigits(currency) ?? 2;
  return Number(minor) / 10 ** digits;
}
