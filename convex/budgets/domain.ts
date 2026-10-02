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

export type BudgetSpendTransaction = {
  type: string;
  status: string;
  deletedAt?: number;
  currency: string;
  occurredAt: number;
  categoryId?: string;
  accountId: string;
  amountMinor: bigint;
};

export type BudgetSpendScope = {
  currency: string;
  startAt: number;
  endAt: number;
  categoryId?: string;
  accountId?: string;
  accountIds?: readonly string[];
};

export function aggregateBudgetSpending(
  transactions: readonly BudgetSpendTransaction[],
  budget: BudgetSpendScope,
  excludedCategoryIds?: ReadonlySet<string>,
): bigint {
  return transactions.reduce((total, transaction) => {
    if (
      transaction.type !== 'expense' ||
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      transaction.currency !== budget.currency ||
      transaction.occurredAt < budget.startAt ||
      transaction.occurredAt >= budget.endAt ||
      (budget.categoryId !== undefined && transaction.categoryId !== budget.categoryId) ||
      (budget.accountId !== undefined && transaction.accountId !== budget.accountId) ||
      (budget.accountIds !== undefined && budget.accountIds.length > 0 &&
        !budget.accountIds.includes(transaction.accountId)) ||
      (transaction.categoryId !== undefined && excludedCategoryIds?.has(transaction.categoryId))
    )
      return total;
    return total + transaction.amountMinor;
  }, 0n);
}

export function budgetAlertThresholdCrossed(
  previousMinor: bigint,
  currentMinor: bigint,
  limitMinor: bigint,
  percentage: number,
): boolean {
  if (percentage === 0) return previousMinor === 0n && currentMinor > 0n;
  const [decimal, exponent = '0'] = String(percentage).split('e');
  const [whole, fraction = ''] = decimal!.split('.');
  const coefficient = BigInt(`${whole}${fraction}`);
  const scale = fraction.length - Number(exponent);
  const numerator = limitMinor * coefficient * (scale < 0 ? 10n ** BigInt(-scale) : 1n);
  const denominator = 100n * (scale > 0 ? 10n ** BigInt(scale) : 1n);
  return previousMinor * denominator < numerator && currentMinor * denominator >= numerator;
}
