import { describe, expect, it } from 'vitest';
import {
  allocateProportionally,
  bilateralBalancesByCurrency,
  calculateBilateralBalance,
  simplifyDebts,
} from '../../convex/splits/domain';
import { syncErrorCode } from '../../packages/ui/src/finance/syncErrors';

const sumOf = (values: Iterable<bigint>) => [...values].reduce((total, value) => total + value, 0n);

describe('simplifyDebts', () => {
  it('finds the fewest transfers when zero-sum groups exist', () => {
    const plan = simplifyDebts({ a: 6n, b: 4n, c: -4n, d: -3n, e: -3n });
    expect(plan).toHaveLength(3);
    const net: Record<string, bigint> = {};
    for (const transfer of plan) {
      net[transfer.fromUserId] = (net[transfer.fromUserId] ?? 0n) + transfer.amountMinor;
      net[transfer.toUserId] = (net[transfer.toUserId] ?? 0n) - transfer.amountMinor;
    }
    expect(net).toEqual({ a: -6n, b: -4n, c: 4n, d: 3n, e: 3n });
  });

  it('keeps simple plans and is stable', () => {
    expect(simplifyDebts({ a: 5n, b: -5n })).toEqual([
      { fromUserId: 'b', toUserId: 'a', amountMinor: 5n },
    ]);
    expect(simplifyDebts({ a: 0n })).toEqual([]);
    const balances = { a: 10n, b: -3n, c: -3n, d: -4n };
    expect(simplifyDebts(balances)).toEqual(simplifyDebts({ ...balances }));
  });
});

describe('proportional allocation', () => {
  it('never loses a minor unit', () => {
    const parts = allocateProportionally(1n, [
      ['alice', 2n],
      ['carol', 1n],
    ]);
    expect(sumOf(parts.values())).toBe(1n);
    expect(parts.get('alice')).toBe(1n);
    expect(
      sumOf(
        allocateProportionally(100n, [
          ['x', 1n],
          ['y', 1n],
          ['z', 1n],
        ]).values(),
      ),
    ).toBe(100n);
  });

  it('assigns the full bilateral debt across several payers', () => {
    const groups = [{ _id: 'g', currency: 'INR' }];
    const transactions = [
      {
        _id: 't',
        groupId: 'g',
        type: 'expense',
        status: 'posted',
        currency: 'INR',
        amountMinor: 3n,
      },
    ];
    const payers = [
      { transactionId: 't', userId: 'alice', amountMinor: 2n },
      { transactionId: 't', userId: 'carol', amountMinor: 1n },
    ];
    const participants = [
      { transactionId: 't', userId: 'bob', amountMinor: 1n },
      { transactionId: 't', userId: 'alice', amountMinor: 1n },
      { transactionId: 't', userId: 'carol', amountMinor: 1n },
    ];
    // Bob's 1 unit: alice paid 2/3 of the bill, so the unit goes to alice (not truncated to 0).
    expect(
      calculateBilateralBalance('alice', 'bob', groups, transactions, payers, participants, []),
    ).toBe(1n);
  });
});

describe('balances per currency', () => {
  it('returns one balance per shared currency', () => {
    const groups = [
      { _id: 'inr', currency: 'INR' },
      { _id: 'usd', currency: 'USD' },
    ];
    const transactions = [
      {
        _id: 't1',
        groupId: 'inr',
        type: 'expense',
        status: 'posted',
        currency: 'INR',
        amountMinor: 100n,
      },
      {
        _id: 't2',
        groupId: 'usd',
        type: 'expense',
        status: 'posted',
        currency: 'USD',
        amountMinor: 40n,
      },
    ];
    const payers = [
      { transactionId: 't1', userId: 'me', amountMinor: 100n },
      { transactionId: 't2', userId: 'them', amountMinor: 40n },
    ];
    const participants = [
      { transactionId: 't1', userId: 'me', amountMinor: 50n },
      { transactionId: 't1', userId: 'them', amountMinor: 50n },
      { transactionId: 't2', userId: 'me', amountMinor: 20n },
      { transactionId: 't2', userId: 'them', amountMinor: 20n },
    ];
    expect(
      bilateralBalancesByCurrency('me', 'them', groups, transactions, payers, participants, []),
    ).toEqual([
      { currency: 'INR', balanceMinor: 50n },
      { currency: 'USD', balanceMinor: -20n },
    ]);
  });
});

describe('sync conflicts', () => {
  it('recognises a wrapped version mismatch', () => {
    expect(
      syncErrorCode(
        new Error('[CONVEX M(groups/mutations:updateExpense)] Uncaught Error: TRANSACTION_CHANGED'),
      ),
    ).toBe('TRANSACTION_CHANGED');
  });
});
