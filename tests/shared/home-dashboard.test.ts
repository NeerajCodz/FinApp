import { describe, expect, it } from 'vitest';
import { buildHomeDashboard } from '../../packages/ui/src/home/model';

const now = Date.UTC(2026, 5, 15, 12);

function dashboard(accountId?: string) {
  return buildHomeDashboard({
    now,
    startAt: now - 30 * 86_400_000,
    endAt: now + 1,
    currency: 'INR',
    ...(accountId ? { accountId } : {}),
    accounts: [{ id: 'wallet', currency: 'INR', balanceMinor: 0n, openingBalanceMinor: 0n }],
    transactions: [
      {
        id: 'shared-expense',
        accountId: 'wallet',
        categoryId: 'food',
        type: 'expense',
        status: 'posted',
        currency: 'INR',
        occurredAt: now,
        amountMinor: 1000n,
        accountAmountMinor: 250n,
      },
    ],
    categories: [{ id: 'food', name: 'Food', monthlyLimitMinor: 2000n, limitCurrency: 'INR' }],
    groups: [],
    groupMembers: [],
    recurringRules: [],
    goals: [],
    goalContributions: [],
  });
}

describe('home dashboard category limits', () => {
  it('uses the selected account share for shared expenses', () => {
    expect(dashboard('wallet').categoryLimits[0]?.spentMinor).toBe(250n);
    expect(dashboard().categoryLimits[0]?.spentMinor).toBe(1000n);
  });
});
