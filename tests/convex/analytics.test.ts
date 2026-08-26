import { describe, expect, it } from 'vitest';
import { aggregateSpending, deterministicInsights } from '../../convex/analytics/domain';

describe('analytics domains', () => {
  it('aggregates bounded category spending', () => {
    expect(
      aggregateSpending([
        { category: 'Food', amountMinor: 100n },
        { category: 'Food', amountMinor: 25n },
        { category: 'Travel', amountMinor: 50n },
      ]),
    ).toEqual({ Food: 125n, Travel: 50n });
  });
  it('returns quiet deterministic insights', () => {
    expect(
      deterministicInsights({
        currentFood: 120n,
        previousFood: 100n,
        budgetUsedPercent: 91,
        recurringDue: 2,
      }),
    ).toEqual([
      'Food spending is up 20% versus the prior period.',
      'Budget is near its limit.',
      '2 recurring payments are due soon.',
    ]);
  });
});
