/**
 * Money presentation for FinAI tool results and cards. Amounts stay exact integers in minor
 * units (as strings, so JSON never rounds them), and every `<name>Minor` field gains a
 * `<name>Formatted` sibling from the nearest `currency` in scope, so the model never does float
 * maths on money. Mirrors the MCP plugin's presenter.
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

/** Formats integer minor units exactly, e.g. 12345n INR → "₹123.45". */
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
    }).format(decimal as unknown as number);
  } catch {
    return `${decimal} ${code}`;
  }
}

/** Absolute value formatted, for cards that show direction with tone instead of a sign. */
export function formatAbsMinor(value: bigint, currency: string): string {
  return formatMinor(value < 0n ? -value : value, currency);
}

/** Parses a decimal amount ("125.5") into minor units for a currency, or null. */
export function parseMajorToMinor(value: string | number, currency: string): bigint | null {
  const text = typeof value === 'number' ? String(value) : value.trim();
  const match = /^(\d{1,15})(?:\.(\d{1,6}))?$/.exec(text);
  if (!match) return null;
  const digits = currencyDigits(currency);
  const fraction = match[2] ?? '';
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) return null;
  const padded = fraction.slice(0, digits).padEnd(digits, '0');
  return BigInt(match[1]!) * 10n ** BigInt(digits) + (digits ? BigInt(padded || '0') : 0n);
}

const currencyPattern = /^[A-Za-z]{3}$/;

/** Bigints → strings, and `<name>Minor` fields gain `<name>Formatted` siblings. */
export function presentMoney(value: unknown, inheritedCurrency?: string): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((entry) => presentMoney(entry, inheritedCurrency));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const own =
    typeof record.currency === 'string' && currencyPattern.test(record.currency)
      ? record.currency
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

export function shortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
