'use client';

import React from 'react';
import { Button, Progress, Typography } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { EntityIcon } from './EntityIconPicker';
import { Money } from './Money';
import type { GoalAnalyticsPanelProps } from '../goalAnalytics';

export type { GoalAnalyticsPanelProps, GoalTrendMonth } from '../goalAnalytics';

export function GoalAnalyticsPanel({
  name,
  icon,
  color,
  currency,
  saved,
  target,
  remaining,
  percent,
  months,
  insights,
  history = [],
  loading = false,
  error,
  available = true,
  onBack,
  onRetry,
}: GoalAnalyticsPanelProps) {
  const maxMonthlyAmount = months.reduce(
    (maximum, month) => (month.amount > maximum ? month.amount : maximum),
    0n,
  );
  const header = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {onBack && (
        <Button variant="outline" onPress={onBack}>
          Back
        </Button>
      )}
      <div>
        <Typography variant="title">Goal analytics</Typography>
        <Typography variant="small">Track your progress and contribution history.</Typography>
      </div>
    </header>
  );
  if (loading || error || !available)
    return (
      <div className="finance-page" style={{ gap: 18 }}>
        {header}
        {loading ? (
          <Typography variant="small" role="status">
            Loading goal analytics…
          </Typography>
        ) : error ? (
          <>
            <Typography variant="small" role="alert">
              {error}
            </Typography>
            {onRetry && (
              <Button variant="outline" onPress={onRetry}>
                Retry
              </Button>
            )}
          </>
        ) : (
          <Typography variant="small">Goal unavailable.</Typography>
        )}
      </div>
    );
  return (
    <div className="finance-page" style={{ gap: 16 }}>
      {header}
      <section style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            display: 'grid',
            width: 48,
            height: 48,
            placeItems: 'center',
            borderRadius: 14,
            background: color ?? 'var(--finapp-primary)',
            color: 'var(--finapp-background)',
          }}
        >
          <EntityIcon value={icon ?? 'lucide:Target'} size={23} />
        </span>
        <Typography variant="heading">{name}</Typography>
      </section>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
          gap: 12,
        }}
      >
        {[
          { label: 'Saved amount', amount: saved },
          { label: 'Target amount', amount: target },
          { label: 'Remaining', amount: remaining },
        ].map(({ label, amount }) => (
          <article
            key={label}
            style={{ padding: 16, borderRadius: 16, background: 'var(--finapp-surface-raised)' }}
          >
            <Typography variant="small">{label}</Typography>
            <Money amountMinor={amount} currency={currency} size="display" />
          </article>
        ))}
      </section>
      <section
        style={{
          display: 'grid',
          gap: 10,
          padding: 18,
          borderRadius: 16,
          background: 'var(--finapp-surface-raised)',
        }}
      >
        <Typography variant="heading">Saved vs target</Typography>
        <Progress
          value={Math.min(100, Math.max(0, percent))}
          color={color ?? 'var(--finapp-primary)'}
        />
        <Typography variant="small">
          {percent}% complete · {formatMinor(remaining, currency)} remaining
        </Typography>
      </section>
      {insights && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
              gap: 12,
            }}
          >
            <article
              style={{ padding: 16, borderRadius: 16, background: 'var(--finapp-surface-raised)' }}
            >
              <Typography variant="small">Average per month</Typography>
              <Typography variant="heading">
                {insights.averageMonthly === null
                  ? 'Not enough history'
                  : formatMinor(insights.averageMonthly, currency)}
              </Typography>
            </article>
            <article
              style={{ padding: 16, borderRadius: 16, background: 'var(--finapp-surface-raised)' }}
            >
              <Typography variant="small">Best month</Typography>
              <Typography variant="heading">
                {insights.bestMonth
                  ? `${insights.bestMonth.label} · ${formatMinor(insights.bestMonth.amount, currency)}`
                  : 'No contributions yet'}
              </Typography>
            </article>
            <article
              style={{ padding: 16, borderRadius: 16, background: 'var(--finapp-surface-raised)' }}
            >
              <Typography variant="small">Projected target</Typography>
              <Typography variant="heading">
                {insights.forecastDate === null
                  ? 'Not enough history'
                  : new Date(insights.forecastDate).toLocaleDateString()}
              </Typography>
            </article>
            <article
              style={{ padding: 16, borderRadius: 16, background: 'var(--finapp-surface-raised)' }}
            >
              <Typography variant="small">Needed to meet target date</Typography>
              <Typography variant="heading">
                {insights.requiredMonthly === null
                  ? 'No future target date'
                  : `${formatMinor(insights.requiredMonthly, currency)} / month`}
              </Typography>
              <Typography variant="caption">
                {insights.onTrackScore === null
                  ? 'On-track estimate unavailable'
                  : `${insights.onTrackScore}% of required pace`}
              </Typography>
            </article>
          </section>
          <section
            style={{
              display: 'grid',
              gap: 10,
              padding: 18,
              borderRadius: 16,
              background: 'var(--finapp-surface-raised)',
            }}
          >
            <Typography variant="heading">Progress milestones</Typography>
            {insights.milestones.map((milestone) => (
              <div
                key={milestone.percent}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBlock: 8,
                  borderBottom: '1px solid var(--finance-line)',
                }}
              >
                <Typography variant="small">
                  {milestone.percent}% · {formatMinor(milestone.amount, currency)}
                </Typography>
                <Typography variant="small">
                  {milestone.achievedAt !== undefined
                    ? `Reached ${new Date(milestone.achievedAt).toLocaleDateString()}`
                    : milestone.projectedAt !== undefined
                      ? `Projected ${new Date(milestone.projectedAt).toLocaleDateString()}`
                      : 'Not yet reached'}
                </Typography>
              </div>
            ))}
          </section>
          <section
            style={{
              display: 'grid',
              gap: 10,
              padding: 18,
              borderRadius: 16,
              background: 'var(--finapp-surface-raised)',
            }}
          >
            <Typography variant="heading">Contribution sources</Typography>
            {insights.sources.length === 0 ? (
              <Typography variant="small">No linked account contributions recorded.</Typography>
            ) : (
              insights.sources.map((source) => (
                <div
                  key={source.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingBlock: 8,
                    borderBottom: '1px solid var(--finance-line)',
                  }}
                >
                  <Typography variant="small">
                    {source.name} · {source.sharePercent}%
                  </Typography>
                  <Money amountMinor={source.amount} currency={currency} />
                </div>
              ))
            )}
          </section>
        </>
      )}
      <section
        style={{
          display: 'grid',
          gap: 14,
          padding: 18,
          borderRadius: 16,
          background: 'var(--finapp-surface-raised)',
        }}
      >
        <Typography variant="heading">Monthly contributions · last 6 months</Typography>
        <div
          aria-label="Monthly contribution totals"
          style={{
            height: 160,
            display: 'grid',
            gridTemplateColumns: 'repeat(6,1fr)',
            alignItems: 'end',
            gap: 12,
          }}
        >
          {months.map((month) => {
            const height =
              maxMonthlyAmount > 0n
                ? Math.max(4, Number((month.amount * 100n) / maxMonthlyAmount))
                : 4;
            return (
              <div
                key={month.label}
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'end',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <div
                  aria-label={`${month.label}: ${formatMinor(month.amount, currency)}`}
                  title={formatMinor(month.amount, currency)}
                  style={{
                    height: `${height}%`,
                    minHeight: 4,
                    width: '70%',
                    borderRadius: '5px 5px 0 0',
                    background: color ?? 'var(--finapp-primary)',
                  }}
                />
                <Typography variant="caption">{month.label}</Typography>
              </div>
            );
          })}
        </div>
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <Typography variant="heading">Recent contributions</Typography>
        {history.length === 0 ? (
          <Typography variant="small">No contributions recorded yet.</Typography>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--finance-line)',
              }}
            >
              <Typography variant="small">
                {new Date(entry.occurredAt).toLocaleDateString()}
              </Typography>
              <Money amountMinor={entry.amount} currency={currency} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
