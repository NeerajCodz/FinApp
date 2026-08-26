import { describe, expect, it } from 'vitest';
import { filterActivity, paginateActivity } from '../../convex/activity/domain';
import { searchTransactions } from '../../convex/search/domain';

describe('activity and dashboard domains', () => {
  const rows = [
    {
      id: '1',
      ownerId: 'u',
      kind: 'expense' as const,
      occurredAt: 3,
      merchant: 'Swiggy',
      amountMinor: 500n,
    },
    {
      id: '2',
      ownerId: 'u',
      kind: 'income' as const,
      occurredAt: 2,
      merchant: 'Payroll',
      amountMinor: 1000n,
    },
    {
      id: '3',
      ownerId: 'u',
      kind: 'settlement' as const,
      occurredAt: 1,
      merchant: 'Alex',
      amountMinor: 200n,
    },
  ];
  it('filters activity by type and paginates with a cursor', () => {
    expect(filterActivity(rows, 'Expenses').map((row) => row.id)).toEqual(['1']);
    expect(paginateActivity(rows, 1, 1)).toEqual({ page: [rows[1]], nextCursor: 2 });
  });
  it('matches search text across merchant and amount', () => {
    expect(searchTransactions(rows, 'swiggy').map((row) => row.id)).toEqual(['1']);
    expect(searchTransactions(rows, '1000').map((row) => row.id)).toEqual(['2']);
  });
});
