import { describe, expect, it } from 'vitest';
import { aiErrorCode } from '../../convex/ai/errors';
import { normalizeReceipt, scaleLinesTo } from '../../convex/ai/receiptDomain';

const now = Date.UTC(2026, 10, 24, 12);
const sure = { merchant: 0.95, occurredAt: 0.9, currency: 0.9, items: 0.9, total: 0.95 };
const sumItems = (items: { amountMinor: bigint }[]) =>
  items.reduce((total, item) => total + item.amountMinor, 0n);

/** A restaurant bill with GST added on top. */
const restaurant = {
  isReceipt: true,
  merchant: '  Spice   Route ',
  occurredAt: '2026-11-20',
  currency: 'inr',
  items: [
    { title: 'Paneer Tikka', quantity: 1, unitPrice: 320, amount: 320, confidence: 0.92 },
    { title: 'Butter Naan', quantity: 4, unitPrice: 60, amount: 240, confidence: 0.9 },
    { title: 'Masala Chai', quantity: 2, unitPrice: 45.5, amount: null, confidence: 0.4 },
  ],
  subtotal: 651,
  tax: 32.55,
  tip: null,
  discount: null,
  total: 683.55,
  confidence: sure,
  warnings: [],
};

describe('normalizeReceipt', () => {
  it('converts to minor units, adds tax as an item and matches the total', () => {
    const draft = normalizeReceipt(restaurant, { now });
    expect(draft).toMatchObject({
      title: 'Spice Route',
      merchant: 'Spice Route',
      currency: 'INR',
      occurredAt: Date.UTC(2026, 10, 20, 12),
      amountMinor: 68355n,
      taxMinor: 3255n,
      lowConfidence: [],
    });
    expect(draft.items).toEqual([
      { id: 'scan-1', title: 'Paneer Tikka', amountMinor: 32000n, quantity: 1 },
      { id: 'scan-2', title: 'Butter Naan', amountMinor: 24000n, quantity: 4 },
      // Amount missing: unit price × quantity, flagged for review.
      { id: 'scan-3', title: 'Masala Chai', amountMinor: 9100n, quantity: 2, lowConfidence: true },
      { id: 'scan-4', title: 'Tax', amountMinor: 3255n },
    ]);
    expect(sumItems(draft.items)).toBe(draft.amountMinor);
  });

  it('keeps VAT-inclusive receipts as they are', () => {
    const draft = normalizeReceipt(
      {
        ...restaurant,
        currency: 'EUR',
        items: [
          { title: 'Coffee', amount: 3.2 },
          { title: 'Croissant', amount: 2.8 },
        ],
        tax: 0.96,
        total: 6,
      },
      { now },
    );
    expect(draft.items.map((item) => [item.title, item.amountMinor])).toEqual([
      ['Coffee', 320n],
      ['Croissant', 280n],
    ]);
    expect(draft.warnings).toEqual([]);
  });

  it('adds a tip and spreads a discount so no item goes negative', () => {
    const draft = normalizeReceipt(
      {
        ...restaurant,
        currency: 'USD',
        items: [
          { title: 'Burger', amount: 12 },
          { title: 'Fries', amount: 4 },
          { title: 'Happy hour', amount: -2 },
        ],
        tax: 1.4,
        tip: 3,
        discount: 2,
        total: 16.4,
      },
      { now },
    );
    // 16 - 2 (discount line) - 2 (discount field) = 12 of food + 1.40 tax + 3 tip = 16.40
    expect(draft.discountMinor).toBe(400n);
    expect(draft.items.map((item) => [item.title, item.amountMinor])).toEqual([
      ['Burger', 900n],
      ['Fries', 300n],
      ['Tax', 140n],
      ['Tip', 300n],
    ]);
    expect(sumItems(draft.items)).toBe(1640n);
  });

  it('adds an Adjustment item when the items fall short of the total', () => {
    const draft = normalizeReceipt(
      {
        ...restaurant,
        items: [{ title: 'Rice', amount: 100 }],
        tax: null,
        total: 112.5,
      },
      { now },
    );
    expect(draft.items.at(-1)).toEqual({
      id: 'scan-2',
      title: 'Adjustment',
      amountMinor: 1250n,
      lowConfidence: true,
    });
    expect(draft.lowConfidence).toContain('items');
    expect(draft.warnings[0]).toMatch(/adjustment of 12.50 INR/);
  });

  it('scales items down when they overshoot the total', () => {
    const draft = normalizeReceipt(
      {
        ...restaurant,
        items: [
          { title: 'A', amount: 60 },
          { title: 'B', amount: 60 },
        ],
        tax: null,
        total: 100,
      },
      { now },
    );
    expect(sumItems(draft.items)).toBe(10000n);
    expect(draft.items.every((item) => item.amountMinor > 0n && item.lowConfidence)).toBe(true);
  });

  it('respects zero-decimal and three-decimal currencies', () => {
    const yen = normalizeReceipt(
      {
        ...restaurant,
        currency: 'JPY',
        items: [{ title: 'Ramen', amount: 980 }],
        tax: 98,
        total: 1078,
      },
      { now },
    );
    expect(yen.amountMinor).toBe(1078n);
    expect(yen.items.map((item) => item.amountMinor)).toEqual([980n, 98n]);
    const dinar = normalizeReceipt(
      {
        ...restaurant,
        currency: 'KWD',
        items: [{ title: 'Tea', amount: 1.25 }],
        tax: null,
        total: 1.25,
      },
      { now },
    );
    expect(dinar.amountMinor).toBe(1250n);
  });

  it('falls back to the account currency and flags weak fields', () => {
    const draft = normalizeReceipt(
      {
        isReceipt: true,
        merchant: null,
        occurredAt: '2031-01-01',
        currency: 'XYZ',
        items: [],
        total: '1,250.00',
        confidence: { ...sure, merchant: 0.2, total: 0.5 },
        warnings: ['Bottom of the bill is folded'],
      },
      { now, fallbackCurrency: 'usd' },
    );
    expect(draft.currency).toBe('USD');
    expect(draft.title).toBe('Receipt');
    expect(draft.occurredAt).toBeNull();
    expect(draft.items).toEqual([{ id: 'scan-1', title: 'Receipt', amountMinor: 125000n }]);
    expect(new Set(draft.lowConfidence)).toEqual(
      new Set(['merchant', 'occurredAt', 'currency', 'amount', 'items']),
    );
    expect(draft.warnings[0]).toBe('Bottom of the bill is folded');
  });

  it('works out a missing total from the items', () => {
    const draft = normalizeReceipt({ ...restaurant, total: null, subtotal: null }, { now });
    expect(draft.amountMinor).toBe(32000n + 24000n + 9100n + 3255n);
    expect(draft.lowConfidence).toContain('amount');
  });

  it('rejects images that are not receipts or have no total', () => {
    const code = (raw: unknown) => {
      try {
        normalizeReceipt(raw, { now });
        return null;
      } catch (error) {
        return aiErrorCode(error);
      }
    };
    expect(code({ ...restaurant, isReceipt: false })).toBe('RECEIPT_UNREADABLE');
    expect(code({ isReceipt: true, items: [], total: null, confidence: sure })).toBe(
      'RECEIPT_UNREADABLE',
    );
    expect(code('not json at all')).toBe('RECEIPT_UNREADABLE');
  });

  it('folds lines past the item limit into one', () => {
    const items = Array.from({ length: 120 }, (_, index) => ({
      title: `Line ${index}`,
      amount: 1,
    }));
    const draft = normalizeReceipt({ ...restaurant, items, tax: null, total: 120 }, { now });
    expect(draft.items).toHaveLength(100);
    expect(draft.items.at(-1)).toMatchObject({ title: 'Other items', amountMinor: 2100n });
    expect(sumItems(draft.items)).toBe(12000n);
  });
});

describe('scaleLinesTo', () => {
  it('allocates by largest remainder and keeps the exact target', () => {
    const lines = [{ amountMinor: 333n }, { amountMinor: 333n }, { amountMinor: 334n }];
    const scaled = scaleLinesTo(lines, 500n);
    expect(sumItems(scaled)).toBe(500n);
    expect(scaled.map((line) => line.amountMinor)).toEqual([167n, 166n, 167n]);
  });
});
