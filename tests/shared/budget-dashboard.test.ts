import { describe, expect, it } from 'vitest';
import { budgetDashboard } from '../../packages/ui/src/finance/budgetDashboard';

describe('budget dashboard projections', () => {
  it('projects from spend observed by now while retaining future charges in period totals', () => {
    const startAt = Date.UTC(2026, 0, 1);
    const day = 86_400_000;
    const dashboard = budgetDashboard(
      [
        {
          id: 'past',
          amountMinor: 100n,
          currency: 'USD',
          occurredAt: startAt + day,
          title: 'Observed charge',
        },
        {
          id: 'future',
          amountMinor: 900n,
          currency: 'USD',
          occurredAt: startAt + 7 * day,
          title: 'Future charge',
        },
      ],
      startAt,
      startAt + 10 * day,
      2_000n,
      startAt + 2 * day,
    );

    expect(dashboard.spent).toBe(1_000n);
    expect(dashboard.average).toBe(50n);
    expect(dashboard.forecast).toBe(500n);
  });
});
