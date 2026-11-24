/**
 * Pure receipt-parsing logic: the Gemini response schema and prompt, plus plain-TypeScript
 * validation that turns the model's JSON into a transaction draft in minor units whose line items
 * add up exactly to the total (the line-items contract: every item positive, sum == amount).
 */
import { minorDigits } from '../shared/money';
import { MAX_LINE_ITEM_TITLE, MAX_LINE_ITEMS } from '../splits/domain';
import { aiError } from './errors';
import type { GeminiSchema } from './gemini';

export type ReceiptField = 'merchant' | 'occurredAt' | 'currency' | 'amount' | 'items';

export type ReceiptDraftItem = {
  id: string;
  title: string;
  amountMinor: bigint;
  quantity?: number;
  /** The model was unsure about this line, or it was added to reconcile the total. */
  lowConfidence?: boolean;
};

export type ReceiptDraft = {
  title: string;
  merchant: string | null;
  /** Noon UTC on the receipt's date (same calendar day in almost every timezone), or null. */
  occurredAt: number | null;
  currency: string;
  amountMinor: bigint;
  items: ReceiptDraftItem[];
  taxMinor?: bigint;
  tipMinor?: bigint;
  discountMinor?: bigint;
  /** Fields to highlight for review. */
  lowConfidence: ReceiptField[];
  warnings: string[];
};

/** Below this the field is highlighted for review. */
export const LOW_CONFIDENCE = 0.6;

const nullableNumber = (description: string): GeminiSchema => ({
  type: 'NUMBER',
  nullable: true,
  description,
});

/** Gemini `responseSchema` for a receipt (amounts in major units, as printed). */
export const receiptResponseSchema: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    isReceipt: {
      type: 'BOOLEAN',
      description: 'False when the image is not a receipt, bill or invoice.',
    },
    merchant: {
      type: 'STRING',
      nullable: true,
      description: 'Store or restaurant name as printed.',
    },
    occurredAt: {
      type: 'STRING',
      nullable: true,
      description: 'Purchase date as YYYY-MM-DD.',
    },
    currency: {
      type: 'STRING',
      nullable: true,
      description: 'ISO 4217 code, e.g. INR, USD, EUR.',
    },
    items: {
      type: 'ARRAY',
      maxItems: 150,
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Item name, cleaned up and readable.' },
          quantity: nullableNumber('Whole-number quantity when printed.'),
          unitPrice: nullableNumber('Price of one unit when printed.'),
          amount: { type: 'NUMBER', description: 'Line total for this item.' },
          confidence: { type: 'NUMBER', description: '0 to 1: how sure you are of this line.' },
        },
        required: ['title', 'amount'],
        propertyOrdering: ['title', 'quantity', 'unitPrice', 'amount', 'confidence'],
      },
    },
    subtotal: nullableNumber('Subtotal before tax, tip and discount.'),
    tax: nullableNumber('Total tax added on top of the items (sum of GST/VAT/service tax lines).'),
    tip: nullableNumber('Tip or service charge.'),
    discount: nullableNumber('Total discount as a positive number.'),
    total: nullableNumber('Grand total actually paid.'),
    confidence: {
      type: 'OBJECT',
      properties: {
        merchant: { type: 'NUMBER' },
        occurredAt: { type: 'NUMBER' },
        currency: { type: 'NUMBER' },
        items: { type: 'NUMBER' },
        total: { type: 'NUMBER' },
      },
      required: ['merchant', 'occurredAt', 'currency', 'items', 'total'],
    },
    warnings: {
      type: 'ARRAY',
      maxItems: 10,
      items: { type: 'STRING' },
      description: 'Short notes about anything unreadable or ambiguous.',
    },
  },
  required: ['isReceipt', 'items', 'total', 'confidence', 'warnings'],
  propertyOrdering: [
    'isReceipt',
    'merchant',
    'occurredAt',
    'currency',
    'items',
    'subtotal',
    'tax',
    'tip',
    'discount',
    'total',
    'confidence',
    'warnings',
  ],
};

export function receiptSystemInstruction(currencyHint: string): string {
  return [
    'You read photos of shop receipts, restaurant bills and invoices and return their contents as JSON.',
    'Rules:',
    '- items: only purchased products or dishes. Do not list tax, tip, service charge, discount, subtotal, total, rounding or payment lines as items.',
    '- amount is the line total for the item (quantity × unit price) in major units, exactly as printed (e.g. 120.50).',
    '- tax: the sum of tax lines added on top of the items. If prices already include tax (VAT inclusive), use null.',
    '- discount is a positive number. total is the final amount paid.',
    '- occurredAt: the purchase date as YYYY-MM-DD; null if not printed.',
    `- currency: the ISO 4217 code shown or implied by the symbol/country; if unclear use ${currencyHint}.`,
    '- confidence values are 0 to 1. Use low values for anything blurry, cut off or guessed.',
    '- If the image is not a receipt or bill, set isReceipt to false and leave the rest empty.',
    'Never invent items or amounts that are not on the receipt.',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Plain-TypeScript validation of the model's JSON
// ---------------------------------------------------------------------------------------------

type RawItem = { title: string; quantity?: number; amount: number | null; confidence?: number };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    return Number(cleaned);
  }
  return null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed || null;
}

function confidence(value: unknown): number {
  const parsed = num(value);
  return parsed === null ? 1 : Math.min(1, Math.max(0, parsed));
}

function toMinor(value: number | null, digits: number): bigint | null {
  if (value === null || !Number.isFinite(value) || Math.abs(value) > 1e13) return null;
  return BigInt(Math.round(value * 10 ** digits));
}

function readItems(value: unknown): RawItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): RawItem[] => {
    const item = record(entry);
    const title = text(item.title) ?? '';
    const quantityValue = num(item.quantity);
    const quantity =
      quantityValue !== null && Number.isSafeInteger(quantityValue) && quantityValue > 0
        ? quantityValue
        : undefined;
    const unitPrice = num(item.unitPrice);
    let amount = num(item.amount);
    if ((amount === null || amount === 0) && unitPrice !== null)
      amount = unitPrice * (quantity ?? 1);
    if (!title && amount === null) return [];
    return [
      {
        title,
        amount,
        ...(quantity === undefined ? {} : { quantity }),
        confidence: confidence(item.confidence),
      },
    ];
  });
}

function parseDate(value: string | null, now: number): number | null {
  const match = value?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day, 12);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 2000 ||
    time > now + 2 * 24 * 60 * 60 * 1000
  )
    return null;
  return time;
}

// ---------------------------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------------------------

type Line = { title: string; amountMinor: bigint; quantity?: number; lowConfidence?: boolean };

const sum = (lines: readonly { amountMinor: bigint }[]) =>
  lines.reduce((total, line) => total + line.amountMinor, 0n);

/**
 * Scales positive lines down to `target` (0 < target < sum) proportionally, largest remainder
 * first, dropping lines that reach zero. Used to spread a discount (items can't be negative).
 */
export function scaleLinesTo<T extends { amountMinor: bigint }>(
  lines: readonly T[],
  target: bigint,
): T[] {
  const total = sum(lines);
  if (target <= 0n || total <= 0n) return [];
  if (target >= total) return [...lines];
  const shares = lines.map((line) => (line.amountMinor * target) / total);
  const remainders = lines.map((line) => (line.amountMinor * target) % total);
  let left = target - shares.reduce((acc, value) => acc + value, 0n);
  const order = lines
    .map((_, index) => index)
    .sort((a, b) =>
      remainders[b]! > remainders[a]! ? 1 : remainders[b]! < remainders[a]! ? -1 : a - b,
    );
  for (const index of order) {
    if (left <= 0n) break;
    shares[index] = shares[index]! + 1n;
    left -= 1n;
  }
  return lines
    .map((line, index) => ({ ...line, amountMinor: shares[index]! }))
    .filter((line) => line.amountMinor > 0n);
}

function formatMinorPlain(amount: bigint, digits: number): string {
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const scale = 10n ** BigInt(digits);
  const fraction = digits ? `.${(absolute % scale).toString().padStart(digits, '0')}` : '';
  return `${negative ? '-' : ''}${absolute / scale}${fraction}`;
}

export type NormalizeReceiptOptions = {
  /** Used when the receipt's currency is missing or unsupported (the user's account currency). */
  fallbackCurrency?: string;
  now?: number;
};

/**
 * Validates Gemini's receipt JSON and reconciles it into a draft whose items add up to the
 * total: tax and tip become their own items, a discount is spread across the items, and any
 * remaining difference becomes an "Adjustment" item (or is spread away when items overshoot).
 * Throws `RECEIPT_UNREADABLE` when there is no usable total.
 */
export function normalizeReceipt(
  raw: unknown,
  options: NormalizeReceiptOptions = {},
): ReceiptDraft {
  const now = options.now ?? Date.now();
  const data = record(raw);
  if (data.isReceipt === false)
    throw aiError('RECEIPT_UNREADABLE', 'This image doesn’t look like a receipt.');
  const warnings: string[] = [];
  const low = new Set<ReceiptField>();
  const scores = record(data.confidence);
  for (const field of ['merchant', 'occurredAt', 'currency', 'items'] as const)
    if (confidence(scores[field]) < LOW_CONFIDENCE) low.add(field);
  if (confidence(scores.total) < LOW_CONFIDENCE) low.add('amount');
  if (Array.isArray(data.warnings))
    for (const warning of data.warnings.slice(0, 5)) {
      const note = text(warning);
      if (note) warnings.push(note.slice(0, 160));
    }

  // Currency
  const fallback =
    options.fallbackCurrency && minorDigits(options.fallbackCurrency) !== null
      ? options.fallbackCurrency.toUpperCase()
      : 'INR';
  const printed = text(data.currency)?.toUpperCase() ?? null;
  let currency = fallback;
  if (printed && minorDigits(printed) !== null) currency = printed;
  else {
    low.add('currency');
    if (printed) warnings.push(`${printed} isn’t supported yet, so amounts use ${fallback}.`);
  }
  const digits = minorDigits(currency)!;

  // Merchant and date
  const merchant = text(data.merchant)?.slice(0, 120) ?? null;
  if (!merchant) low.add('merchant');
  const occurredAt = parseDate(text(data.occurredAt), now);
  if (occurredAt === null) low.add('occurredAt');

  // Items: negative lines are discounts, zero lines are dropped.
  let discountMinor = toMinor(num(data.discount), digits) ?? 0n;
  if (discountMinor < 0n) discountMinor = -discountMinor;
  const items: Line[] = [];
  for (const [index, item] of readItems(data.items).entries()) {
    const amountMinor = toMinor(item.amount, digits);
    if (amountMinor === null || amountMinor === 0n) {
      if (amountMinor === null && item.title) {
        low.add('items');
        warnings.push(`Couldn’t read the price of “${item.title.slice(0, 40)}”.`);
      }
      continue;
    }
    if (amountMinor < 0n) {
      discountMinor += -amountMinor;
      continue;
    }
    items.push({
      title: (item.title || `Item ${index + 1}`).slice(0, MAX_LINE_ITEM_TITLE),
      amountMinor,
      ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
      ...((item.confidence ?? 1) < LOW_CONFIDENCE ? { lowConfidence: true } : {}),
    });
  }
  const positive = (value: bigint | null) => (value !== null && value > 0n ? value : 0n);
  const taxMinor = positive(toMinor(num(data.tax), digits));
  const tipMinor = positive(toMinor(num(data.tip), digits));
  const itemsSum = sum(items);

  // Total
  let total = toMinor(num(data.total), digits);
  if (total === null || total <= 0n) {
    const subtotal = toMinor(num(data.subtotal), digits);
    const base = subtotal !== null && subtotal > 0n ? subtotal : itemsSum;
    total = base + taxMinor + tipMinor - discountMinor;
    if (total <= 0n) throw aiError('RECEIPT_UNREADABLE');
    low.add('amount');
    warnings.push('The total wasn’t readable, so it was worked out from the items.');
  }

  const extra = (title: string, amountMinor: bigint): Line => ({ title, amountMinor });
  const withDiscount = (lines: Line[], discount: bigint): Line[] | null => {
    if (discount === 0n) return lines;
    const target = sum(lines) - discount;
    return target > 0n ? scaleLinesTo(lines, target) : null;
  };
  // Try readings of the receipt from "everything on top" to "everything already included".
  const readings: [boolean, boolean, boolean][] = [
    [true, true, true],
    [false, true, true],
    [false, false, true],
    [false, false, false],
  ];
  let lines: Line[] | null = null;
  if (items.length) {
    for (const [addTax, addTip, applyDiscount] of readings) {
      const discounted = withDiscount(items, applyDiscount ? discountMinor : 0n);
      if (!discounted) continue;
      const candidate = [
        ...discounted,
        ...(addTax && taxMinor > 0n ? [extra('Tax', taxMinor)] : []),
        ...(addTip && tipMinor > 0n ? [extra('Tip', tipMinor)] : []),
      ];
      if (sum(candidate) === total) {
        lines = candidate;
        break;
      }
    }
    if (!lines) {
      // Nothing matches exactly: take everything at face value and fix the difference.
      const discounted = withDiscount(items, discountMinor) ?? items;
      const base = [
        ...discounted,
        ...(taxMinor > 0n ? [extra('Tax', taxMinor)] : []),
        ...(tipMinor > 0n ? [extra('Tip', tipMinor)] : []),
      ];
      const difference = total - sum(base);
      const digitsText = (value: bigint) => `${formatMinorPlain(value, digits)} ${currency}`;
      if (difference > 0n) {
        lines = [...base, { title: 'Adjustment', amountMinor: difference, lowConfidence: true }];
        warnings.push(
          `The items came to ${digitsText(total - difference)}, so an adjustment of ${digitsText(difference)} was added.`,
        );
      } else {
        lines = scaleLinesTo(base, total).map((line) => ({ ...line, lowConfidence: true }));
        warnings.push(
          `The items came to ${digitsText(sum(base))}, more than the total, so they were scaled down.`,
        );
      }
      low.add('items');
    }
  } else {
    lines = [{ title: (merchant ?? 'Receipt').slice(0, MAX_LINE_ITEM_TITLE), amountMinor: total }];
    low.add('items');
    warnings.push('No individual items were found; the whole bill is one item.');
  }

  // Respect the item limit by folding the tail into one line.
  if (lines.length > MAX_LINE_ITEMS) {
    const kept = lines.slice(0, MAX_LINE_ITEMS - 1);
    lines = [
      ...kept,
      { title: 'Other items', amountMinor: total - sum(kept), lowConfidence: true },
    ];
    warnings.push(`Only the first ${MAX_LINE_ITEMS - 1} lines are listed separately.`);
  }

  return {
    title: merchant ?? 'Receipt',
    merchant,
    occurredAt,
    currency,
    amountMinor: total,
    items: lines.map((line, index) => ({ id: `scan-${index + 1}`, ...line })),
    ...(taxMinor > 0n ? { taxMinor } : {}),
    ...(tipMinor > 0n ? { tipMinor } : {}),
    ...(discountMinor > 0n ? { discountMinor } : {}),
    lowConfidence: [...low],
    warnings,
  };
}
