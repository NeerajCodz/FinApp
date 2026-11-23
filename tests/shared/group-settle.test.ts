import { describe, expect, it } from 'vitest';
import {
  applyTransfers,
  balanceBarRatios,
  bilateralLimit,
  buildExpenseTimeline,
  findLateJoiners,
  groupErrorMessage,
  isValidTransferSequence,
  outstandingBalance,
  outstandingBalanceFromError,
  previewInclusion,
  settleAllMine,
  settleFirstCounterpart,
  settleUpPlan,
  transferWith,
} from '../../packages/ui/src/finance/groupSettle';

const day = 86_400_000;

describe('settle-up plan', () => {
  const balances = { me: -900n, ana: 600n, ben: 300n, cy: 0n };

  it('suggests transfers and lists everyone I can pay, suggested first', () => {
    const plan = settleUpPlan(balances, 'me');
    expect(plan.direction).toBe('pay');
    expect(plan.myBalanceMinor).toBe(-900n);
    expect(plan.mine).toEqual([
      { fromUserId: 'me', toUserId: 'ana', amountMinor: 600n },
      { fromUserId: 'me', toUserId: 'ben', amountMinor: 300n },
    ]);
    expect(plan.totalSuggestedMinor).toBe(900n);
    expect(plan.counterparts.map((item) => [item.userId, item.maxAmountMinor])).toEqual([
      ['ana', 600n],
      ['ben', 300n],
    ]);
  });

  it('caps a partial payment at the bilateral limit the server enforces', () => {
    expect(bilateralLimit({ a: -100n, b: 40n }, 'a', 'b')).toBe(40n);
    expect(bilateralLimit({ a: -10n, b: 40n }, 'a', 'b')).toBe(10n);
    expect(bilateralLimit({ a: 10n, b: 40n }, 'a', 'b')).toBe(0n);
    expect(bilateralLimit({ a: -10n }, 'a', 'a')).toBe(0n);
  });

  it('receiving members see the people who owe them', () => {
    const plan = settleUpPlan({ me: 500n, ana: -200n, ben: -300n }, 'me');
    expect(plan.direction).toBe('receive');
    expect(plan.counterparts.map((item) => item.userId)).toEqual(['ben', 'ana']);
    expect(transferWith('me', 'ben', 'receive', 300n)).toEqual({
      fromUserId: 'ben',
      toUserId: 'me',
      amountMinor: 300n,
    });
  });

  it('settle-all-mine clears my balance in a server-valid order', () => {
    const transfers = settleAllMine(balances, 'me');
    expect(isValidTransferSequence(balances, transfers)).toBe(true);
    expect(applyTransfers(balances, transfers).me).toBe(0n);
    expect(settleAllMine({ me: 0n, ana: 10n, ben: -10n }, 'me')).toEqual([]);
  });

  it('rejects sequences that overpay', () => {
    expect(
      isValidTransferSequence(balances, [{ fromUserId: 'me', toUserId: 'ben', amountMinor: 301n }]),
    ).toBe(false);
  });

  it('scales balance bars against the largest open balance', () => {
    expect(balanceBarRatios({ a: -50n, b: 100n, c: 0n })).toEqual({ a: 0.5, b: 1, c: 0 });
    expect(balanceBarRatios({ a: 0n })).toEqual({ a: 0 });
  });
});

describe('membership guard', () => {
  it('flags non-zero balances', () => {
    expect(outstandingBalance({ a: 0n }, 'a', 'INR')).toBeNull();
    expect(outstandingBalance({ a: -5n }, 'a', 'INR')).toEqual({
      balanceMinor: -5n,
      currency: 'INR',
    });
    expect(outstandingBalance(undefined, 'a', 'INR')).toBeNull();
  });

  it('reads the OUTSTANDING_BALANCE ConvexError payload', () => {
    const error = Object.assign(new Error('x'), {
      data: { code: 'OUTSTANDING_BALANCE', balanceMinor: '-1250', currency: 'USD' },
    });
    expect(outstandingBalanceFromError(error)).toEqual({ balanceMinor: -1250n, currency: 'USD' });
    expect(outstandingBalanceFromError(new Error('OUTSTANDING_BALANCE'))).toBeNull();
  });

  it('points "settle first" at the largest suggested counterpart', () => {
    expect(settleFirstCounterpart({ a: -900n, b: 300n, c: 600n }, 'a')).toBe('c');
    expect(settleFirstCounterpart({ a: 0n }, 'a')).toBeUndefined();
  });

  it('turns backend codes into readable copy', () => {
    expect(groupErrorMessage(new Error('Uncaught Error: SETTLEMENT_EXCEEDS_BALANCE'))).toMatch(
      /more than is still open/,
    );
    expect(groupErrorMessage({ data: { code: 'MANUAL_SPLIT_REQUIRED' } })).toMatch(/manually/);
    expect(groupErrorMessage(new Error('SOME_CODE'), 'Fallback')).toBe('Fallback');
  });
});

describe('expense timeline', () => {
  const base = new Date(2026, 10, 20, 12).getTime();
  const expenses = [
    { id: 'e1', occurredAt: base - 3 * day },
    { id: 'e2', occurredAt: base - day },
    { id: 'e3', occurredAt: base - day + 60_000 },
    { id: 'e4', occurredAt: base },
  ];

  it('groups by day newest first and places a joined marker above the first earlier expense', () => {
    const rows = buildExpenseTimeline(expenses, [
      { userId: 'founder', name: 'F', joinedAt: base - 10 * day },
      { userId: 'late', name: 'Late', joinedAt: base - 2 * day },
    ]);
    expect(rows.map((row) => (row.kind === 'expense' ? row.expense.id : row.kind))).toEqual([
      'day',
      'e4',
      'day',
      'e3',
      'e2',
      'joined',
      'day',
      'e1',
    ]);
    const marker = rows.find((row) => row.kind === 'joined');
    expect(marker?.kind === 'joined' && marker.members.map((m) => m.userId)).toEqual(['late']);
  });

  it('puts members who joined after every expense at the top, oldest first', () => {
    const rows = buildExpenseTimeline(expenses, [
      { userId: 'b', name: 'B', joinedAt: base + 2 * day },
      { userId: 'a', name: 'A', joinedAt: base + day },
    ]);
    expect(rows[0]?.kind).toBe('joined');
    expect(rows[0]?.kind === 'joined' && rows[0].members.map((m) => m.userId)).toEqual(['a', 'b']);
  });

  it('shows no marker without expenses', () => {
    expect(buildExpenseTimeline([], [{ userId: 'a', name: 'A', joinedAt: 1 }])).toEqual([]);
  });
});

describe('late joiners', () => {
  it('finds past expenses a member was not part of', () => {
    const result = findLateJoiners(
      [
        { userId: 'old', name: 'Old', joinedAt: 0 },
        { userId: 'new', name: 'New', joinedAt: 100 },
        { userId: 'unknown', name: 'Unknown' },
      ],
      [
        { id: 'x', occurredAt: 50, participantIds: ['old'] },
        { id: 'y', occurredAt: 80, participantIds: ['old', 'new'] },
        { id: 'z', occurredAt: 150, participantIds: ['old'] },
      ],
    );
    expect(result).toEqual([
      { userId: 'new', name: 'New', joinedAt: 100, missedExpenseIds: ['x'] },
    ]);
  });

  it('previews the recomputed equal share', () => {
    expect(
      previewInclusion(
        900n,
        [
          { userId: 'a', amountMinor: 450n, method: 'equal' },
          { userId: 'b', amountMinor: 450n, method: 'equal' },
        ],
        ['c'],
      ),
    ).toEqual({ eligible: true, beforeMinor: 450n, afterMinor: 300n, participantCount: 3 });
  });

  it('marks exact and percentage splits as manual', () => {
    expect(
      previewInclusion(100n, [{ userId: 'a', amountMinor: 100n, method: 'exact' }], ['b']),
    ).toEqual({ eligible: false, reason: 'manual' });
    expect(
      previewInclusion(100n, [{ userId: 'a', amountMinor: 100n, method: 'equal' }], ['a']),
    ).toEqual({ eligible: false, reason: 'included' });
  });
});
