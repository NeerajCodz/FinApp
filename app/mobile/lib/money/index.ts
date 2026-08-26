export { formatMinor, parseMinor } from '@convex/shared/money';

export function signedMinor(
  amount: bigint,
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment',
): bigint {
  return type === 'expense' ? -amount : amount;
}
