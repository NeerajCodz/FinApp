/**
 * Money presentation for MCP results. Convex stores amounts as int64 minor units; tool output
 * keeps that exact value as a string (`amountMinor: "12345"`) and adds a display string next to
 * it (`amountFormatted: "₹123.45"`) so models and widgets never do float maths on money.
 */

const digitCache = new Map<string, number>();

export function currencyDigits(currency: string): number {
  const code = currency.toUpperCase();
  const cached = digitCache.get(code);
  if (cached !== undefined) return cached;
  let digits: number;
  try {
    digits =
      new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  digitCache.set(code, digits);
  return digits;
}

function toBigInt(value: bigint | number | string): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return Number.isSafeInteger(value) ? BigInt(value) : null;
  return /^-?\d{1,20}$/.test(value) ? BigInt(value) : null;
}

/** Formats integer minor units exactly (no float rounding), e.g. 12345n INR → "₹123.45". */
export function formatMinor(value: bigint | number | string, currency: string): string {
  const minor = toBigInt(value);
  const code = currency.toUpperCase();
  if (minor === null || !/^[A-Z]{3}$/.test(code)) return `${String(value)} ${currency}`;
  const digits = currencyDigits(code);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const scale = 10n ** BigInt(digits);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(digits, '0');
  const decimal = `${negative ? '-' : ''}${whole}${digits ? `.${fraction}` : ''}`;
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      // Intl accepts decimal strings exactly; the cast covers older lib typings.
    }).format(decimal as unknown as number);
  } catch {
    return `${decimal} ${code}`;
  }
}

const currencyPattern = /^[A-Za-z]{3}$/;

/**
 * Walks a tool result: bigints become strings, and every `<name>Minor` amount gains a sibling
 * `<name>Formatted` using the nearest `currency` (or `limitCurrency`) in scope.
 */
export function presentMoney(value: unknown, inheritedCurrency?: string): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((entry) => presentMoney(entry, inheritedCurrency));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const own =
    typeof record.currency === 'string' && currencyPattern.test(record.currency)
      ? record.currency
      : typeof record.limitCurrency === 'string' && currencyPattern.test(record.limitCurrency)
        ? record.limitCurrency
        : undefined;
  const currency = own ?? inheritedCurrency;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (entry === undefined) continue;
    output[key] = presentMoney(entry, currency);
    if (
      key.endsWith('Minor') &&
      key.length > 'Minor'.length &&
      currency &&
      (typeof entry === 'bigint' || typeof entry === 'number' || typeof entry === 'string')
    ) {
      const formattedKey = `${key.slice(0, -'Minor'.length)}Formatted`;
      if (!(formattedKey in record)) output[formattedKey] = formatMinor(entry, currency);
    }
  }
  return output;
}
