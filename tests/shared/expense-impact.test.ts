import { describe, expect, it } from 'vitest';
import {
  currentGroupBalances,
  projectExpenseImpact,
  settledMemberIds,
  shareStatus,
  type ExpenseLedger,
} from '../../packages/ui/src/finance/expenseImpact';
import {
  describeSyncError,
  outboxErrorText,
  syncErrorCode,
} from '../../packages/ui/src/finance/syncErrors';

function ledger(overrides: Partial<ExpenseLedger> = {}): ExpenseLedger {
  return {
    group: { id: 'local-group', _id: 'cloud-group', currency: 'INR' },
    transactions: [
      {
        id: 'local-dinner',
        cloudId: 'cloud-dinner',
        groupId: 'cloud-group',
        type: 'expense',
        status: 'posted',
        currency: 'INR',
        amountMinor: 3000n,
      },
      {
        id: 'taxi',
        groupId: 'local-group',
        type: 'expense',
        status: 'posted',
        currency: 'INR',
        amountMinor: 600n,
      },
    ],
    payers: [
      { transactionId: 'cloud-dinner', userId: 'owner', amountMinor: 3000n },
      { transactionId: 'taxi', userId: 'member', amountMinor: 600n },
    ],
    participants: [
      { transactionId: 'cloud-dinner', userId: 'owner', amountMinor: 1500n },
      { transactionId: 'cloud-dinner', userId: 'member', amountMinor: 1500n },
      { transactionId: 'taxi', userId: 'owner', amountMinor: 300n },
      { transactionId: 'taxi', userId: 'member', amountMinor: 300n },
    ],
    settlements: [
      {
        id: 's1',
        groupId: 'cloud-group',
        currency: 'INR',
        fromUserId: 'member',
        toUserId: 'owner',
        amountMinor: 1200n,
      },
    ],
    ...overrides,
  };
}

describe('expense edit impact', () => {
  it('shows per-member changes and flags settled members who are now owed back', () => {
    const before = currentGroupBalances(ledger());
    expect(before).toEqual({ owner: 0n, member: 0n });
    const impact = projectExpenseImpact(ledger(), 'local-dinner', {
      kind: 'update',
      amountMinor: 1000n,
      payers: [{ userId: 'owner', amountMinor: 1000n }],
      participants: [
        { userId: 'owner', amountMinor: 500n },
        { userId: 'member', amountMinor: 500n },
      ],
    });
    expect(impact.status).toBe('ready');
    if (impact.status !== 'ready') return;
    expect(impact.changes).toEqual([
      { userId: 'member', before: 0n, after: 1000n, delta: 1000n },
      { userId: 'owner', before: 0n, after: -1000n, delta: -1000n },
    ]);
    expect(impact.settled).toEqual([
      { userId: 'member', before: 0n, after: 1000n, credit: true },
      { userId: 'owner', before: 0n, after: -1000n, credit: false },
    ]);
  });

  it('accepts any alias of the expense and handles added members', () => {
    const impact = projectExpenseImpact(ledger(), 'cloud-dinner', {
      kind: 'update',
      amountMinor: 3000n,
      payers: [{ userId: 'owner', amountMinor: 3000n }],
      participants: [
        { userId: 'owner', amountMinor: 1000n },
        { userId: 'member', amountMinor: 1000n },
        { userId: 'new', amountMinor: 1000n },
      ],
    });
    expect(impact.status === 'ready' && impact.after).toEqual({
      owner: 500n,
      member: 500n,
      new: -1000n,
    });
  });

  it('previews a delete and ignores undone settlements', () => {
    const withUndone = ledger({
      settlements: [{ ...ledger().settlements[0]!, deletedAt: 1 }],
    });
    expect(settledMemberIds(withUndone).size).toBe(0);
    const impact = projectExpenseImpact(withUndone, 'local-dinner', { kind: 'delete' });
    expect(impact.status === 'ready' && impact.after).toEqual({ owner: -300n, member: 300n });
    expect(impact.status === 'ready' && impact.settled).toEqual([]);
  });

  it('reports an unavailable preview instead of throwing', () => {
    expect(projectExpenseImpact(ledger(), 'missing', { kind: 'delete' })).toEqual({
      status: 'unavailable',
      reason: 'EXPENSE_NOT_FOUND',
    });
    const incomplete = ledger({ participants: ledger().participants.slice(1) });
    expect(projectExpenseImpact(incomplete, 'taxi', { kind: 'delete' })).toMatchObject({
      status: 'unavailable',
      reason: 'INCOMPLETE_GROUP_SPLITS',
    });
    expect(currentGroupBalances(incomplete)).toBeNull();
  });

  it('labels where each person on an expense stands', () => {
    const balances = { owner: 500n, member: -500n, other: 0n };
    expect(shareStatus('owner', ['owner'], balances)).toBe('paid');
    expect(shareStatus('member', ['owner'], balances)).toBe('owes');
    expect(shareStatus('other', ['owner'], balances)).toBe('settled');
    expect(shareStatus('x', ['owner'], { x: 10n })).toBe('owed');
    expect(shareStatus('member', ['owner'], null)).toBeNull();
  });
});

describe('sync error messages', () => {
  const wrapped = new Error(
    '[CONVEX M(groups/mutations:updateExpense)] [Request ID: abc] Server Error\nUncaught Error: TRANSACTION_CHANGED\n    at handler',
  );

  it('finds known codes inside wrapped Convex errors', () => {
    expect(syncErrorCode(wrapped)).toBe('TRANSACTION_CHANGED');
    expect(syncErrorCode('SETTLEMENT_EXCEEDS_BALANCE')).toBe('SETTLEMENT_EXCEEDS_BALANCE');
    expect(syncErrorCode(new Error('network down'))).toBeNull();
  });

  it('describes known failures and keeps unknown ones bounded', () => {
    expect(describeSyncError(wrapped)).toMatch(/Someone else changed this expense/);
    expect(describeSyncError('OUTSTANDING_BALANCE')).toMatch(/outstanding balance/);
    expect(describeSyncError(new Error('weird'), 'fallback')).toBe('fallback');
    expect(outboxErrorText(new Error('INSUFFICIENT_PERMISSION'))).toMatch(/permission/);
    expect(outboxErrorText(new Error(`line1\nline2${'x'.repeat(400)}`))).toHaveLength(240);
  });
});
