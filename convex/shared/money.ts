export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares' | 'adjustment';
export type SplitOptions = { method: SplitMethod; values?: readonly (bigint | number)[] };

const MINOR_DIGITS: Record<string, number> = {
  BHD: 3,
  JOD: 3,
  KWD: 3,
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AUD: 2,
  CAD: 2,
  JPY: 0,
};

function assertCurrency(currency: string): number {
  const digits = MINOR_DIGITS[currency.toUpperCase()];
  if (digits === undefined) throw new Error('INVALID_CURRENCY');
  return digits;
}

export function parseMinor(input: string, currency: string): bigint {
  const digits = assertCurrency(currency);
  const normalized = input.trim().replace(/[₹$€£,\s]/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) throw new Error('INVALID_AMOUNT');
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart, fraction = ''] = unsigned.split('.');
  const whole = wholePart ?? '0';
  if (fraction.length > digits || (digits === 0 && fraction.length > 0))
    throw new Error('INVALID_AMOUNT');
  const padded = fraction.padEnd(digits, '0');
  const amount = BigInt(whole) * 10n ** BigInt(digits) + (padded ? BigInt(padded) : 0n);
  return negative ? -amount : amount;
}

export function formatMinor(amount: bigint, currency: string, locale = 'en-IN'): string {
  const digits = assertCurrency(currency);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const scale = 10n ** BigInt(digits);
  const whole = absolute / scale;
  const fraction = digits ? `.${(absolute % scale).toString().padStart(digits, '0')}` : '';
  const grouped = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(Number(whole));
  const symbol =
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency;
  return `${negative ? '-' : ''}${symbol}${grouped}${fraction}`;
}

function validateParticipants(ids: readonly string[], values?: readonly unknown[]): void {
  if (ids.length === 0 || new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
    throw new Error('INVALID_SPLIT');
  if (values && values.length !== ids.length) throw new Error('INVALID_SPLIT');
}

export function allocateRemainder(
  total: bigint,
  orderedParticipantIds: readonly string[],
): Record<string, bigint> {
  validateParticipants(orderedParticipantIds);
  if (total < 0n) throw new Error('INVALID_SPLIT');
  const count = BigInt(orderedParticipantIds.length);
  const base = total / count;
  const remainder = total % count;
  return Object.fromEntries(
    orderedParticipantIds.map((id, index) => [id, base + (BigInt(index) < remainder ? 1n : 0n)]),
  );
}

function proportional(
  total: bigint,
  ids: readonly string[],
  weights: readonly bigint[],
  denominator: bigint,
): Record<string, bigint> {
  if (total < 0n || denominator <= 0n || weights.some((weight) => weight < 0n))
    throw new Error('INVALID_SPLIT');
  const allocations = ids.map((_, index) => (total * (weights[index] ?? 0n)) / denominator);
  const fractions = ids.map((_, index) => (total * (weights[index] ?? 0n)) % denominator);
  const remainder = total - allocations.reduce((sum, value) => sum + value, 0n);
  const order = ids
    .map((_, index) => index)
    .sort((left, right) => {
      const difference = (fractions[right] ?? 0n) - (fractions[left] ?? 0n);
      return difference === 0n ? left - right : difference > 0n ? 1 : -1;
    });
  const extras = new Set(order.slice(0, Number(remainder)));
  return Object.fromEntries(
    ids.map((id, index) => [id, (allocations[index] ?? 0n) + (extras.has(index) ? 1n : 0n)]),
  );
}

export function allocateSplit(
  total: bigint,
  orderedParticipantIds: readonly string[],
  options: SplitOptions,
): Record<string, bigint> {
  validateParticipants(orderedParticipantIds, options.values);
  if (total <= 0n) throw new Error('INVALID_SPLIT');
  const values = options.values ?? [];
  if (options.method === 'equal') return allocateRemainder(total, orderedParticipantIds);
  if (options.method === 'exact' || options.method === 'adjustment') {
    const allocations = values.map((value) => (typeof value === 'number' ? BigInt(value) : value));
    if (
      allocations.some((value) => value < 0n) ||
      allocations.reduce((sum, value) => sum + value, 0n) !== total
    )
      throw new Error('INVALID_SPLIT');
    return Object.fromEntries(
      orderedParticipantIds.map((id, index) => [id, allocations[index] ?? 0n]),
    );
  }
  if (options.method === 'percentage') {
    const percentages = values.map((value) => (typeof value === 'number' ? BigInt(value) : value));
    if (
      percentages.some((value) => value < 0n) ||
      percentages.reduce((sum, value) => sum + value, 0n) !== 10000n
    )
      throw new Error('INVALID_SPLIT');
    return proportional(total, orderedParticipantIds, percentages, 10000n);
  }
  const shares = values.map((value) => (typeof value === 'number' ? BigInt(value) : value));
  const denominator = shares.reduce((sum, value) => sum + value, 0n);
  if (denominator <= 0n) throw new Error('INVALID_SPLIT');
  return proportional(total, orderedParticipantIds, shares, denominator);
}
