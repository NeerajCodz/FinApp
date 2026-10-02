import { describe, expect, it } from 'vitest';
import { buildGoalAnalyticsModel } from '../../packages/ui/src/finance/goalAnalytics';

describe('buildGoalAnalyticsModel', () => {
  it('derives observed months, forecast pace, contribution sources, and milestones', () => {
    const now = new Date(2026, 8, 15, 12).getTime();
    const result = buildGoalAnalyticsModel({
      contributions: [
        {
          id: 'aug',
          occurredAt: new Date(2026, 7, 10, 12).getTime(),
          amount: 200n,
          accountId: 'cash',
        },
        {
          id: 'sep-cash',
          occurredAt: new Date(2026, 8, 3, 12).getTime(),
          amount: 300n,
          accountId: 'cash',
        },
        {
          id: 'sep-bank',
          occurredAt: new Date(2026, 8, 9, 12).getTime(),
          amount: 100n,
          accountId: 'bank',
        },
      ],
      accounts: [
        { id: 'cash', name: 'Cash', color: '#111111' },
        { id: 'bank', name: 'Bank', color: '#222222' },
      ],
      target: 1_000n,
      targetDate: new Date(2026, 11, 1, 12).getTime(),
      createdAt: new Date(2026, 6, 1, 12).getTime(),
      now,
    });

    expect(result.saved).toBe(600n);
    expect(result.remaining).toBe(400n);
    expect(result.months).toHaveLength(6);
    expect(result.averageMonthly).toBe(200n);
    expect(result.bestMonth?.amount).toBe(400n);
    expect(result.forecastDate).toBe(new Date(2026, 10, 15, 12).getTime());
    expect(result.requiredMonthly).toBe(134n);
    expect(result.onTrackScore).toBe(100);
    expect(result.sources.map(({ id, amount }) => [id, amount])).toEqual([
      ['cash', 500n],
      ['bank', 100n],
    ]);
    expect(result.milestones.map(({ percent, amount }) => [percent, amount])).toEqual([
      [25, 250n],
      [50, 500n],
      [75, 750n],
      [100, 1_000n],
    ]);
    expect(result.milestones[0]?.achievedAt).toBe(new Date(2026, 8, 3, 12).getTime());
    expect(result.milestones[2]?.projectedAt).toBe(new Date(2026, 9, 15, 12).getTime());
  });

  it('uses the recorded completion date and rounds milestone thresholds up to minor units', () => {
    const achievedAt = new Date(2026, 8, 9, 12).getTime();
    const result = buildGoalAnalyticsModel({
      contributions: [{ id: 'complete', occurredAt: achievedAt, amount: 101n }],
      accounts: [],
      target: 101n,
      createdAt: new Date(2026, 7, 1, 12).getTime(),
      now: new Date(2026, 9, 15, 12).getTime(),
    });

    expect(result.forecastDate).toBe(achievedAt);
    expect(result.remaining).toBe(0n);
    expect(result.milestones.map((milestone) => milestone.amount)).toEqual([26n, 51n, 76n, 101n]);
    expect(result.milestones.map((milestone) => milestone.achievedAt)).toEqual([
      achievedAt,
      achievedAt,
      achievedAt,
      achievedAt,
    ]);
  });

  it('does not invent a forecast when there is no contribution history', () => {
    const result = buildGoalAnalyticsModel({
      contributions: [],
      accounts: [],
      target: 500n,
      targetDate: new Date(2026, 11, 1, 12).getTime(),
      now: new Date(2026, 8, 15, 12).getTime(),
    });

    expect(result.saved).toBe(0n);
    expect(result.averageMonthly).toBeNull();
    expect(result.bestMonth).toBeNull();
    expect(result.forecastDate).toBeNull();
    expect(result.onTrackScore).toBeNull();
    expect(result.sources).toEqual([]);
  });
});
