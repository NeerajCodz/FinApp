import { describe, expect, it } from 'vitest';
import { projectGroupBalances } from '../../app/mobile/lib/groupBalances';

const group = { id: 'local-g', cloudId: 'cloud-g', name: 'Trip', currency: 'USD' };
const members = [
  { id: 'm1', groupId: 'local-g', userId: 'alice', displayName: 'Alice' },
  { id: 'm2', groupId: 'cloud-g', userId: 'bob', displayName: 'Bob' },
];
const expense = { id: 'local-t', cloudId: 'cloud-t', groupId: 'cloud-g', amountMinor: 1001n, currency: 'USD', type: 'expense', status: 'posted' };

describe('group balance projection', () => {
  it('joins local and cloud transaction IDs, keeps settlement direction, and excludes ineligible transactions', () => {
    const result = projectGroupBalances(group, members,
      [expense,
        { ...expense, id: 'pending', cloudId: 'pending', status: 'pending', amountMinor: 500n },
        { ...expense, id: 'deleted', cloudId: 'deleted', deletedAt: 3, amountMinor: 500n },
        { ...expense, id: 'other-currency', cloudId: 'other-currency', currency: 'EUR', amountMinor: 500n }],
      [{ transactionId: 'cloud-t', userId: 'alice', amountMinor: 1001n }],
      [{ transactionId: 'local-t', userId: 'alice', amountMinor: 300n }, { transactionId: 'cloud-t', userId: 'bob', amountMinor: 701n }],
      [{ groupId: 'local-g', fromUserId: 'bob', toUserId: 'alice', amountMinor: 200n, currency: 'USD' },
        { groupId: 'local-g', fromUserId: 'alice', toUserId: 'bob', amountMinor: 999n, currency: 'EUR' }],
    );
    expect(result.balances).toEqual({ alice: 501n, bob: -501n });
    expect(result.names.get('bob')).toBe('Bob');
    expect(result.expenses).toEqual([expense]);
  });

  it('refuses to present a ledger if posted expense shares are missing', () => {
    expect(() => projectGroupBalances(group, members, [expense],
      [{ transactionId: 'local-t', userId: 'alice', amountMinor: 1001n }], [], [],
    )).toThrow('INCOMPLETE_GROUP_SPLITS');
  });
});
