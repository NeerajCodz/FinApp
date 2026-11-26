import { describe, expect, it } from 'vitest';
import { limitStatus } from '../../convex/categories/limits';
import { nextOccurrence } from '../../convex/recurring/domain';
import { applyContribution } from '../../convex/goals/domain';

describe('planning rules', () => {
  it('grades category-limit usage from the alert level, 90% and 100%', () => {
    expect(limitStatus(79n, 100n)).toBe('normal');
    expect(limitStatus(80n, 100n)).toBe('warning');
    expect(limitStatus(60n, 100n, 60)).toBe('warning');
    expect(limitStatus(90n, 100n)).toBe('near-limit');
    expect(limitStatus(100n, 100n)).toBe('exceeded');
  });

  it('advances recurring occurrences by calendar frequency', () => {
    expect(nextOccurrence(Date.UTC(2026, 0, 31), 'monthly', 1)).toBe(Date.UTC(2026, 1, 28));
  });

  it('derives goal progress from immutable contributions', () => {
    expect(applyContribution(1000n, 250n, 1000n)).toEqual({ contributed: 1250n, complete: true });
  });
});
