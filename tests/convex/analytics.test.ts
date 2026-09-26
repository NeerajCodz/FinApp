import { describe, expect, it } from 'vitest';
import {
  aggregateAnalytics,
  deterministicInsights,
  getAnalyticsRange,
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
    expect(result.categoryBreakdown).toEqual([{ id: 'food', label: 'Food', amountMinor: 1200n }]);
    expect(result.accountBreakdown).toEqual([
      { id: '__unassigned_account__', label: 'Unassigned account', amountMinor: 1200n },
    ]);
    expect(result.merchantBreakdown).toEqual([
      { id: 'Unspecified merchant', label: 'Unspecified merchant', amountMinor: 1200n },
    ]);
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
  it('uses local calendar boundaries through spring and fall DST transitions', () => {
    const spring = getAnalyticsRange('week', Date.UTC(2024, 2, 13), 'America/New_York');
    expect(spring).toEqual({
      startAt: Date.UTC(2024, 2, 11, 4),
      endAt: Date.UTC(2024, 2, 18, 4),
      previousStartAt: Date.UTC(2024, 2, 4, 5),
    });
    const fall = getAnalyticsRange('month', Date.UTC(2024, 10, 9), 'America/New_York');
    expect(fall).toEqual({
      startAt: Date.UTC(2024, 10, 1, 4),
      endAt: Date.UTC(2024, 11, 1, 5),
      previousStartAt: Date.UTC(2024, 9, 1, 4),
    });
    expect(getAnalyticsRange('year', Date.UTC(2024, 6, 1), 'Asia/Kolkata')).toEqual({
      startAt: Date.UTC(2023, 11, 31, 18, 30),
      endAt: Date.UTC(2024, 11, 31, 18, 30),
      previousStartAt: Date.UTC(2022, 11, 31, 18, 30),
    });
  });

  it('buckets both series on local dates with half-open bounds and exact bigint rankings', () => {
    const { startAt, endAt } = getAnalyticsRange(
      'month',
      Date.UTC(2024, 2, 15),
      'America/New_York',
    );
    const huge = 90071992547409930n;
    const result = aggregateAnalytics(
      [
        {
          type: 'expense',
          amountMinor: huge,
          currency: 'USD',
          categoryId: 'legacy-food',
          accountId: 'cloud-card',
          merchant: ' Market ',
          occurredAt: startAt,
          status: 'posted',
        },
        {
          type: 'income',
          amountMinor: huge + 1n,
          currency: 'USD',
          occurredAt: Date.UTC(2024, 2, 10, 6),
          status: 'posted',
        },
        {
          type: 'expense',
          amountMinor: 9n,
          currency: 'USD',
          categoryId: 'unknown',
          accountId: 'unknown',
          merchant: ' ',
          occurredAt: Date.UTC(2024, 2, 11, 3, 30),
          status: 'posted',
        },
        {
          type: 'expense',
          amountMinor: 4n,
          currency: 'USD',
          categoryId: 'food',
          accountId: 'card',
          merchant: 'Market',
          occurredAt: endAt - 1,
          status: 'posted',
        },
        { type: 'expense', amountMinor: 88n, currency: 'USD', occurredAt: endAt, status: 'posted' },
        {
          type: 'income',
          amountMinor: 90n,
          currency: 'EUR',
          occurredAt: startAt,
          status: 'posted',
        },
        {
          type: 'transfer',
          amountMinor: 99n,
          currency: 'USD',
          occurredAt: startAt,
          status: 'posted',
        },
        {
          type: 'expense',
          amountMinor: 99n,
          currency: 'USD',
          occurredAt: startAt,
          status: 'pending',
        },
        {
          type: 'expense',
          amountMinor: 99n,
          currency: 'USD',
          occurredAt: startAt,
          status: 'posted',
          deletedAt: endAt,
        },
      ],
      [{ id: 'food', name: 'Food', aliases: ['legacy-food'] }],
      'USD',
      'month',
      startAt,
      endAt,
      'America/New_York',
      [{ id: 'card', name: 'Card', aliases: ['cloud-card'] }],
    );
    expect(result.spentMinor).toBe(huge + 13n);
    expect(result.incomeMinor).toBe(huge + 1n);
    expect(result.buckets).toHaveLength(31);
    expect(result.buckets[0]).toEqual({
      startAt,
      endAt: Date.UTC(2024, 2, 2, 5),
      label: 'Mar 1',
      amountMinor: huge,
      incomeMinor: 0n,
    });
    expect(result.buckets[9]?.incomeMinor).toBe(huge + 1n);
    expect(result.buckets[9]?.endAt - result.buckets[9]!.startAt).toBe(23 * 3600000);
    expect(result.buckets[30]?.amountMinor).toBe(4n);
    expect(result.buckets[30]?.endAt).toBe(endAt);
    expect(result.categoryBreakdown).toEqual([
      { id: 'food', label: 'Food', amountMinor: huge + 4n },
      { id: '__uncategorized__', label: 'Uncategorized', amountMinor: 9n },
    ]);
    expect(result.accountBreakdown).toEqual([
      { id: 'card', label: 'Card', amountMinor: huge + 4n },
      { id: '__unassigned_account__', label: 'Unassigned account', amountMinor: 9n },
    ]);
    expect(result.merchantBreakdown).toEqual([
      { id: 'Market', label: 'Market', amountMinor: huge + 4n },
      { id: 'Unspecified merchant', label: 'Unspecified merchant', amountMinor: 9n },
    ]);
  });

  it('labels every week day and year month with actual local boundaries', () => {
    const week = getAnalyticsRange('week', Date.UTC(2024, 0, 4), 'Asia/Kolkata');
    const days = aggregateAnalytics(
      [],
      [],
      'INR',
      'week',
      week.startAt,
      week.endAt,
      'Asia/Kolkata',
    ).buckets;
    expect(days.map((bucket) => bucket.label)).toEqual([
      'Mon, Jan 1',
      'Tue, Jan 2',
      'Wed, Jan 3',
      'Thu, Jan 4',
      'Fri, Jan 5',
      'Sat, Jan 6',
      'Sun, Jan 7',
    ]);
    expect(
      days.every((bucket, index) => bucket.endAt === (days[index + 1]?.startAt ?? week.endAt)),
    ).toBe(true);
    const year = getAnalyticsRange('year', Date.UTC(2024, 1, 1), 'Asia/Kolkata');
    const months = aggregateAnalytics(
      [],
      [],
      'INR',
      'year',
      year.startAt,
      year.endAt,
      'Asia/Kolkata',
    ).buckets;
    expect(months.map((bucket) => bucket.label)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
    expect(months[1]?.endAt - months[1]!.startAt).toBe(29 * day);
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
