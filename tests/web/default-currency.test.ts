import { describe, expect, it } from 'vitest';
import { resolveDefaultCurrency } from '../../packages/ui/src/finance/defaultCurrency';

describe('resolveDefaultCurrency', () => {
  it('uses a saved preference when older records are empty', () => {
    expect(
      resolveDefaultCurrency(
        [{ updatedAt: 10 }, { defaultCurrency: 'usd', updatedAt: 30 }],
        [{ currency: 'INR', updatedAt: 20 }],
      ),
    ).toBe('USD');
  });

  it('uses the newest valid preference and ignores invalid values', () => {
    expect(
      resolveDefaultCurrency(
        [{ defaultCurrency: 'EUR', updatedAt: 20 }],
        [
          { currency: 'INR', updatedAt: 30 },
          { defaultCurrency: '??', updatedAt: 40 },
        ],
      ),
    ).toBe('INR');
  });
});
