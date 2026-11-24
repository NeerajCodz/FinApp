import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import {
  minorToInput,
  receiptDraftToForm,
  receiptFileProblem,
  receiptMimeType,
  receiptScanErrorMessage,
  receiptScanStages,
  type ReceiptDraft,
} from '../../packages/ui/src/ai/receiptScan';
import { computeLineItems } from '../../packages/ui/src/finance/lineItems';

const draft: ReceiptDraft = {
  title: 'Corner Cafe',
  merchant: 'Corner Cafe',
  occurredAt: Date.UTC(2026, 10, 20, 12),
  currency: 'INR',
  amountMinor: 50400n,
  items: [
    { id: 'scan-1', title: 'Cold coffee', amountMinor: 30000n, quantity: 2 },
    { id: 'scan-2', title: 'Sandwich', amountMinor: 18000n, lowConfidence: true },
    { id: 'scan-3', title: 'Tax', amountMinor: 2400n },
  ],
  taxMinor: 2400n,
  lowConfidence: ['occurredAt'],
  warnings: [],
};

describe('receipt scan helpers', () => {
  it('turns a draft into composer fields whose items add up', () => {
    const form = receiptDraftToForm(draft, 'INR');
    expect(form).toMatchObject({
      title: 'Corner Cafe',
      merchant: 'Corner Cafe',
      amount: '504.00',
      review: ['occurredAt'],
      reviewItemIds: ['scan-2'],
      warnings: [],
    });
    expect(new Date(form.occurredAt!).getDate()).toBe(20);
    expect(new Date(form.occurredAt!).getHours()).toBe(12);
    expect(form.rows.map((row) => [row.title, row.amount, row.quantity])).toEqual([
      ['Cold coffee', '300.00', '2'],
      ['Sandwich', '180.00', ''],
      ['Tax', '24.00', ''],
    ]);
    const parsed = computeLineItems(form.rows, 'INR');
    expect(parsed.error).toBe('');
    expect(parsed.totalMinor).toBe(50400n);
  });

  it('flags a currency different from the account', () => {
    const form = receiptDraftToForm(
      {
        ...draft,
        currency: 'KWD',
        amountMinor: 1250n,
        items: [{ id: 'a', title: 'Tea', amountMinor: 1250n }],
      },
      'INR',
    );
    expect(form.review).toContain('currency');
    expect(form.warnings[0]).toMatch(/KWD/);
    expect(form.amount).toBe('1.25');
    expect(receiptDraftToForm({ ...draft, occurredAt: null }, 'INR').occurredAt).toBeNull();
  });

  it('checks files before upload', () => {
    expect(receiptMimeType('image/JPG')).toBe('image/jpeg');
    expect(receiptMimeType(null, 'IMG_0001.HEIC')).toBe('image/heic');
    expect(receiptMimeType('application/pdf', 'bill.pdf')).toBeNull();
    expect(receiptFileProblem({ mimeType: 'image/png', size: 1000 })).toBe('');
    expect(receiptFileProblem({ mimeType: null, size: 1000 })).toMatch(/JPEG/);
    expect(receiptFileProblem({ mimeType: 'image/png', size: 9 * 1024 * 1024 })).toMatch(/8 MB/);
  });

  it('maps server errors to friendly copy', () => {
    expect(
      receiptScanErrorMessage(new ConvexError({ code: 'AI_NOT_CONFIGURED', message: 'x' })),
    ).toMatch(/isn’t switched on/);
    expect(
      receiptScanErrorMessage(new Error('[CONVEX A(ai/receipts:parse)] AI_RATE_LIMITED')),
    ).toMatch(/tomorrow/);
    expect(receiptScanErrorMessage(new Error('boom'))).toMatch(/Something went wrong/);
    expect(receiptScanStages.reading.caption).toBe('Reading your bill…');
    expect(receiptScanStages.finding.caption).toBe('Finding items…');
    expect(minorToInput(1078n, 'JPY')).toBe('1078');
  });
});
