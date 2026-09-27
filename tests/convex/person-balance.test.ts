import { describe, expect, it } from 'vitest';
import { calculateBilateralBalance } from '../../convex/splits/domain';

describe('shared Person balance', () => {
  it('joins local/cloud group and transaction IDs and applies settlements by direction', () => {
    const balance = calculateBilateralBalance(
      'alice',
      'bob',
      [{ id: 'local-group', cloudId: 'cloud-group' }],
      [
        {
          id: 'local-first',
          cloudId: 'cloud-first',
          groupId: 'cloud-group',
          type: 'expense',
          status: 'posted',
          amountMinor: 100n,
        },
        {
          id: 'local-second',
          groupId: 'local-group',
          type: 'expense',
          status: 'posted',
          amountMinor: 50n,
        },
        {
          id: 'pending',
          groupId: 'local-group',
          type: 'expense',
          status: 'pending',
          amountMinor: 500n,
        },
      ],
      [
        { transactionId: 'cloud-first', userId: 'alice', amountMinor: 100n },
        { transactionId: 'local-second', userId: 'bob', amountMinor: 50n },
      ],
      [
        { transactionId: 'local-first', userId: 'alice', amountMinor: 40n },
        { transactionId: 'cloud-first', userId: 'bob', amountMinor: 60n },
        { transactionId: 'local-second', userId: 'bob', amountMinor: 20n },
        { transactionId: 'local-second', userId: 'alice', amountMinor: 30n },
      ],
      [
        { groupId: 'cloud-group', fromUserId: 'bob', toUserId: 'alice', amountMinor: 10n },
        { groupId: 'local-group', fromUserId: 'alice', toUserId: 'bob', amountMinor: 5n },
        {
          groupId: 'local-group',
          fromUserId: 'bob',
          toUserId: 'alice',
          amountMinor: 900n,
          deletedAt: 1,
        },
      ],
    );

    expect(balance).toBe(25n);
  });

  it('uses embedded legacy allocations when normalized split rows are absent', () => {
    const balance = calculateBilateralBalance(
      'alice',
      'bob',
      [{ _id: 'group' }],
      [
        {
          id: 'expense',
          groupId: 'group',
          type: 'expense',
          status: 'posted',
          payerUserId: 'bob',
          payerAmountMinor: 90n,
          participants: [
            { userId: 'bob', amountMinor: 30n },
            { userId: 'alice', amountMinor: 60n },
          ],
        },
      ],
      [],
      [],
      [],
    );

    expect(balance).toBe(-60n);
  });
});
