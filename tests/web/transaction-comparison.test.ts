import { describe, expect, it } from 'vitest';
import { compareTransactionAmounts } from '../../packages/ui/src/finance/transactionComparison';

describe('transaction period comparisons', () => {
  it('reports rounded month-over-month change with expense and income polarity', () => {
    expect(compareTransactionAmounts(112n, 100n, true)).toEqual({
      label: '↑ 12% from last month',
      tone: 'negative',
    });
    expect(compareTransactionAmounts(85n, 100n, true)).toEqual({
      label: '↓ 15% from last month',
      tone: 'positive',
    });
    expect(compareTransactionAmounts(108n, 100n, false)).toEqual({
      label: '↑ 8% from last month',
      tone: 'positive',
    });
    expect(compareTransactionAmounts(92n, 100n, false)).toEqual({
      label: '↓ 8% from last month',
      tone: 'negative',
    });
  });

  it('distinguishes a new amount from an unchanged zero baseline', () => {
    expect(compareTransactionAmounts(0n, 0n, true)).toEqual({
      label: 'No change from last month',
      tone: 'neutral',
    });
    expect(compareTransactionAmounts(1n, 0n, true)).toEqual({
      label: 'New this month',
      tone: 'negative',
    });
    expect(compareTransactionAmounts(1n, 0n, false)).toEqual({
      label: 'New this month',
      tone: 'positive',
    });
    expect(compareTransactionAmounts(100n, undefined, true)).toBeNull();
  });
});
