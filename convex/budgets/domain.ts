export type BudgetStatus = 'normal' | 'warning' | 'near-limit' | 'exceeded';

export function budgetStatus(spentMinor: bigint, limitMinor: bigint): BudgetStatus {
  if (limitMinor <= 0n || spentMinor >= limitMinor) return 'exceeded';
  const percentage = (spentMinor * 100n) / limitMinor;
  if (percentage >= 90n) return 'near-limit';
  if (percentage >= 75n) return 'warning';
  return 'normal';
}

export function budgetRemaining(spentMinor: bigint, limitMinor: bigint): bigint {
  return limitMinor - spentMinor;
}
