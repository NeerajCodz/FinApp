import { describe, expect, it } from 'vitest';
import { selectGoalAnalytics } from '../../packages/ui/src/finance/goalAnalytics';

const now = Date.UTC(2026, 10, 1);
const goals = [
  { id: 'g1', cloudId: 'c1', name: 'Trip', currency: 'INR', targetAmountMinor: '10000' },
  { id: 'g2', name: 'Laptop', currency: 'INR', targetAmountMinor: 20000 },
  { id: 'g3', name: 'Euro fund', currency: 'EUR', targetAmountMinor: 5000 },
  { id: 'g4', name: 'Old', currency: 'INR', targetAmountMinor: 9999, archivedAt: 1 },
];
const contributions = [
  { id: 'k1', goalId: 'c1', amountMinor: 2500, occurredAt: now - 1000 },
  { id: 'k2', goalId: 'g2', amountMinor: '5000', occurredAt: now - 2000 },
  { id: 'k3', goalId: 'g3', amountMinor: 4000, occurredAt: now - 3000 },
  { id: 'k4', goalId: 'g4', amountMinor: 9999, occurredAt: now - 4000 },
];

describe('selectGoalAnalytics', () => {
  it('selects a single goal through any id alias', () => {
    const view = selectGoalAnalytics({ goals, contributions, accounts: [], goalId: 'g1', now });
    expect(view.name).toBe('Trip');
    expect(view.available).toBe(true);
    expect(view.insights.saved).toBe(2500n);
    expect(view.insights.target).toBe(10000n);
  });

  it('aggregates active goals in the dominant currency only', () => {
    const view = selectGoalAnalytics({ goals, contributions, accounts: [], now });
    expect(view.currency).toBe('INR');
    expect(view.goalCount).toBe(2);
    expect(view.name).toBe('All savings goals');
    expect(view.insights.saved).toBe(7500n);
    expect(view.insights.target).toBe(30000n);
    expect(view.history.map((entry) => entry.id)).toEqual(['k1', 'k2']);
  });

  it('reports archived or unknown goals as unavailable', () => {
    expect(
      selectGoalAnalytics({ goals, contributions, accounts: [], goalId: 'g4', now }).available,
    ).toBe(false);
    expect(
      selectGoalAnalytics({ goals, contributions, accounts: [], goalId: 'nope', now }).available,
    ).toBe(false);
  });
});
