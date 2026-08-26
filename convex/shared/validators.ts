export const currencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY'] as const;
export type Currency = (typeof currencies)[number];
export const transactionTypes = ['expense', 'income', 'transfer', 'refund', 'adjustment'] as const;
export type TransactionType = (typeof transactionTypes)[number];
export const accountTypes = ['cash', 'bank', 'card', 'wallet', 'loan', 'other'] as const;
export const budgetPeriods = ['monthly', 'category', 'account', 'custom'] as const;
export const splitMethods = ['equal', 'exact', 'percentage', 'shares', 'adjustment'] as const;
export const recurrenceFrequencies = ['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const;
export const roles = ['owner', 'admin', 'member'] as const;

export function isCurrency(value: string): value is Currency {
  return (currencies as readonly string[]).includes(value);
}

export function assertCurrency(value: string): asserts value is Currency {
  if (!isCurrency(value)) throw new Error('INVALID_CURRENCY');
}

export function assertPositiveAmount(amount: bigint): void {
  if (amount <= 0n) throw new Error('INVALID_AMOUNT');
}

export function assertId(value: string): void {
  if (value.trim().length === 0) throw new Error('INVALID_ID');
}
