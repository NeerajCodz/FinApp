import { describe, expect, it } from 'vitest';
import { aggregateBudgetSpending, type BudgetSpendTransaction } from '../../convex/budgets/domain';

const budget = {
  currency: 'INR',
  startAt: 100,
  endAt: 200,
  categoryId: 'food',
  accountId: 'cash',
};

function expense(overrides: Partial<BudgetSpendTransaction> = {}): BudgetSpendTransaction {
  return {
    type: 'expense',
    status: 'posted',
    currency: 'INR',
    occurredAt: 150,
    categoryId: 'food',
    accountId: 'cash',
    amountMinor: 100n,
    ...overrides,
  };
}

describe('budget spending aggregation', () => {
  it('counts only matching posted, non-deleted expenses within the scope and date interval', () => {
    const transactions = [
      expense({ amountMinor: 125n, occurredAt: 100 }),
      expense({ amountMinor: 75n, occurredAt: 199 }),
      expense({ amountMinor: 900n, status: 'pending' }),
      expense({ amountMinor: 900n, status: 'voided' }),
      expense({ amountMinor: 900n, deletedAt: 120 }),
      expense({ amountMinor: 900n, currency: 'USD' }),
      expense({ amountMinor: 900n, occurredAt: 99 }),
      expense({ amountMinor: 900n, occurredAt: 200 }),
      expense({ amountMinor: 900n, categoryId: 'transport' }),
      expense({ amountMinor: 900n, accountId: 'bank' }),
      expense({ amountMinor: 900n, type: 'income' }),
    ];

    expect(aggregateBudgetSpending(transactions, budget)).toBe(200n);
  });
});
