import { describe, expect, it } from 'vitest';
import { projectGroupBalances } from '../../convex/splits/domain';

const group = { id: 'group-local', _id: 'group-cloud', currency: 'USD' };
const expense = {
  id: 'expense-local',
  _id: 'expense-cloud',
  groupId: 'group-cloud',
  type: 'expense',
  status: 'posted',
  currency: 'USD',
  amountMinor: 100n,
};
const payers = [
  { id: 'payer', transactionId: 'expense-cloud', userId: 'alice', amountMinor: 100n },
];
const participants = [
  { id: 'split-alice', transactionId: 'expense-local', userId: 'alice', amountMinor: 40n },
  { id: 'split-bob', transactionId: 'expense-cloud', userId: 'bob', amountMinor: 60n },
];
const settlements = [
  {
    id: 'settlement',
    groupId: 'group-cloud',
    currency: 'USD',
    fromUserId: 'bob',
    toUserId: 'alice',
    amountMinor: 10n,
  },
];

describe('Web group balance projection', () => {
  it('projects aliased split records and repayments to exact member balances', () => {
    const result = projectGroupBalances(group, [expense], payers, participants, settlements);

    expect(result.balances).toEqual({ alice: 50n, bob: -50n });
    expect(result.expenses).toEqual([expense]);
  });

  it('withholds balances when a split is incomplete instead of using embedded guesses', () => {
    const embeddedOnlyExpense = { ...expense, participants: [{ userId: 'bob', amountMinor: 100n }] };

    expect(() =>
      projectGroupBalances(group, [embeddedOnlyExpense], payers, [], settlements),
    ).toThrow('INCOMPLETE_GROUP_SPLITS');
  });
});
