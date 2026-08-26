import { aggregateSpending } from './domain';

export function spendingByCategory(
  rows: readonly { category: string; amountMinor: bigint }[],
  limit = 20,
) {
  return Object.entries(aggregateSpending(rows))
    .sort((left, right) => Number(right[1] - left[1]))
    .slice(0, Math.min(50, limit));
}
