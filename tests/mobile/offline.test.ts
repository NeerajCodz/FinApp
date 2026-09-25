import { describe, expect, it } from 'vitest';
import {
  createOutboxEntry,
  nextRetryDelay,
  markConflict,
} from '../../app/mobile/local/outbox/queue';
import { deserializeLocalValue } from '../../app/mobile/local/serialization';
import { exportCsv } from '../../app/mobile/lib/export/csv';

describe('offline financial safety', () => {
  it('round trips arbitrary-precision amounts and numeric-looking text', () => {
    const amountMinor = 900719925474099312345n;
    const entry = createOutboxEntry(
      'transaction.create',
      { amountMinor, title: '100n' },
      'm-1',
    );
    const payload = deserializeLocalValue<{ amountMinor: bigint; title: string }>(entry.payload);
    expect(payload).toEqual({ amountMinor, title: '100n' });
  });
  it('uses the bounded retry schedule after transient cloud failures', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(nextRetryDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 30_000,
    ]);
  });
  it('surfaces financial conflicts for review', () => {
    expect(markConflict('amountMinor')).toEqual({
      status: 'conflict',
      reason: 'amountMinor',
      action: 'Review changes',
    });
  });
  it('exports safe CSV data', () => {
    expect(exportCsv([{ amountMinor: 100n, title: 'Lunch' }])).toContain('100n,Lunch');
  });
});
