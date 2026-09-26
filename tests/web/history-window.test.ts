import { describe, expect, it } from 'vitest';
import { transactionHistoryRange } from '../../apps/web/lib/browser/history-window';

describe('browser transaction history windows', () => {
  it('uses exclusive upper bounds and each supported rolling range', () => {
    const now = Date.UTC(2026, 0, 1);
    const endAt = now + 1;
    for (const days of [7, 30, 90, 180, 365] as const) {
      expect(
        transactionHistoryRange(String(days) as '7' | '30' | '90' | '180' | '365', now),
      ).toEqual({
        startAt: endAt - days * 86_400_000,
        endAt,
      });
    }
    expect(transactionHistoryRange('all', now)).toEqual({ startAt: 0, endAt });
  });
});
