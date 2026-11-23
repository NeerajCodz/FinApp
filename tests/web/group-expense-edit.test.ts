import { describe, expect, it } from 'vitest';
import { canEditGroupExpense } from '../../apps/web/lib/groupExpense';

const expense = { groupId: 'group', ownerId: 'creator', type: 'expense', status: 'posted' };

describe('group expense editing permissions', () => {
  it('allows only the creator of a posted group expense', () => {
    expect(canEditGroupExpense(expense, 'creator')).toBe(true);
    expect(canEditGroupExpense(expense, 'member')).toBe(false);
    expect(canEditGroupExpense(expense, null)).toBe(false);
  });

  it('rejects deleted, non-posted, non-expense and personal transactions', () => {
    expect(canEditGroupExpense({ ...expense, deletedAt: 1 }, 'creator')).toBe(false);
    expect(canEditGroupExpense({ ...expense, status: 'draft' }, 'creator')).toBe(false);
    expect(canEditGroupExpense({ ...expense, type: 'income' }, 'creator')).toBe(false);
    expect(canEditGroupExpense({ ...expense, groupId: undefined }, 'creator')).toBe(false);
  });
});
