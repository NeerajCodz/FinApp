import { describe, expect, it } from 'vitest';
import {
  aggregateAnalytics,
  deterministicInsights,
  validateAnalyticsRange,
} from '../../convex/analytics/domain';

const day = 86400000;

describe('analytics domains', () => {
  it('includes only owned-query posted non-deleted current-currency income and expenses in totals', () => {
    const result = aggregateAnalytics(
      [
        {
          type: 'expense',
          amountMinor: 1200n,
          currency: 'USD',
          categoryId: 'food',
          occurredAt: 2 * day,
          status: 'posted',
        },
        {
          type: 'income',
          amountMinor: 5000n,
          currency: 'USD',
          occurredAt: 3 * day,
          status: 'posted',
        },
        {
          type: 'expense',
          amountMinor: 900n,
          currency: 'EUR',
          categoryId: 'food',
          occurredAt: 3 * day,
          status: 'posted',
        },
        {
          type: 'expense',
          amountMinor: 800n,
          currency: 'USD',
          categoryId: 'food',
          occurredAt: 3 * day,
          status: 'pending',
        },
        {
          type: 'expense',
          amountMinor: 700n,
          currency: 'USD',
          categoryId: 'food',
          occurredAt: 3 * day,
          status: 'voided',
        },
        {
          type: 'expense',
          amountMinor: 600n,
          currency: 'USD',
          categoryId: 'food',
          occurredAt: 3 * day,
          status: 'posted',
          deletedAt: 4 * day,
        },
        {
          type: 'transfer',
          amountMinor: 400n,
          currency: 'USD',
          categoryId: 'food',
          occurredAt: 3 * day,
          status: 'posted',
        },
        {
          type: 'refund',
          amountMinor: 300n,
          currency: 'USD',
          categoryId: 'food',
          occurredAt: 3 * day,
          status: 'posted',
        },
      ],
      [{ id: 'food', name: 'Food' }],
      'USD',
      'week',
      0,
      7 * day,
    );
    expect(result.spentMinor).toBe(1200n);
    expect(result.incomeMinor).toBe(5000n);
    expect(result.buckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0n)).toBe(1200n);
    expect(result.categoryBreakdown).toEqual([{ label: 'Food', amountMinor: 1200n }]);
  });

  it('splits calendar year totals into real monthly buckets', () => {
    const startAt = Date.UTC(2024, 0, 1);
    const endAt = Date.UTC(2025, 0, 1);
    const result = aggregateAnalytics(
      [
        {
          type: 'expense',
          amountMinor: 321n,
          currency: 'USD',
          occurredAt: Date.UTC(2024, 8, 12),
          status: 'posted',
        },
      ],
      [],
      'USD',
      'year',
      startAt,
      endAt,
    );
    expect(result.buckets).toHaveLength(12);
    expect(result.buckets[8]?.amountMinor).toBe(321n);
  });

  it('buckets year activity by the owner timezone rather than UTC month edges', () => {
    const startAt = Date.UTC(2023, 11, 31, 18, 30);
    const endAt = Date.UTC(2024, 11, 31, 18, 30);
    const result = aggregateAnalytics(
      [
        {
          type: 'expense',
          amountMinor: 321n,
          currency: 'USD',
          occurredAt: Date.UTC(2024, 0, 15),
          status: 'posted',
        },
      ],
      [],
      'USD',
      'year',
      startAt,
      endAt,
      'Asia/Kolkata',
    );
    expect(result.buckets[0]?.amountMinor).toBe(321n);
  });

  it('rejects ranges that do not match the selected period', () => {
    expect(() => validateAnalyticsRange('week', 0, 2 * day)).toThrow('INVALID_DATE_RANGE');
    expect(() => validateAnalyticsRange('month', 0, 7 * day)).toThrow('INVALID_DATE_RANGE');
    expect(() => validateAnalyticsRange('year', 0, 31 * day)).toThrow('INVALID_DATE_RANGE');
  });
  it('returns deterministic budget and recurring insights from supplied records', () => {
    expect(
      deterministicInsights({
        currentFood: 120n,
        previousFood: 100n,
        budgetUsedPercent: 91,
        recurringDue: 2,
      }),
    ).toEqual([
      'Food spending is up 20% versus the prior period.',
      'Budget is near its limit.',
      '2 recurring payments are due soon.',
    ]);
  });
});
