import { parseMinor } from '@convex/shared/money';
export { formatMinor, parseMinor } from '@convex/shared/money';

export function signedMinor(
  amount: bigint,
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment',
): bigint {
  return type === 'expense' ? -amount : amount;
}

export function minorToDecimal(amount: bigint, currency: string): string {
  const scale = parseMinor('1', currency);
  const digits = scale.toString().length - 1;
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  return `${negative ? '-' : ''}${absolute / scale}${digits ? `.${String(absolute % scale).padStart(digits, '0')}` : ''}`;
}
