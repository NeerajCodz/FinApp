import { describe, expect, it } from 'vitest';
import { budgetStatus } from '../../convex/budgets/domain';
import { nextOccurrence } from '../../convex/recurring/domain';
import { applyContribution } from '../../convex/goals/domain';

describe('planning rules', () => {
  it('uses fixed budget threshold boundaries', () => {
    expect(budgetStatus(74n, 100n)).toBe('normal');
    expect(budgetStatus(75n, 100n)).toBe('warning');
    expect(budgetStatus(90n, 100n)).toBe('near-limit');
    expect(budgetStatus(100n, 100n)).toBe('exceeded');
  });

  it('advances recurring occurrences by calendar frequency', () => {
    expect(nextOccurrence(Date.UTC(2026, 0, 31), 'monthly', 1)).toBe(Date.UTC(2026, 1, 28));
  });

  it('derives goal progress from immutable contributions', () => {
    expect(applyContribution(1000n, 250n, 1000n)).toEqual({ contributed: 1250n, complete: true });
  });
});
