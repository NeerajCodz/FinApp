import { describe, expect, it } from 'vitest';
import { calculateNetBalances, createSplit } from '../../convex/splits/domain';
import { createSettlement } from '../../convex/settlements/domain';

describe('group split ledger', () => {
  it('supports multi-payer expenses and preserves payer participant totals', () => {
    const split = createSplit(
      100n,
      [
        { userId: 'a', amountMinor: 60n },
        { userId: 'b', amountMinor: 40n },
      ],
      [
        { userId: 'a', amountMinor: 50n },
        { userId: 'b', amountMinor: 25n },
        { userId: 'c', amountMinor: 25n },
      ],
    );
    expect(split.payers.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(100n);
    expect(calculateNetBalances(split.payers, split.participants, [])).toEqual({
      a: 10n,
      b: 15n,
      c: -25n,
    });
  });

  it('adds settlements without deleting the original expense', () => {
    const settlement = createSettlement('a', 'c', 25n);
    expect(settlement.amountMinor).toBe(25n);
  });
});
