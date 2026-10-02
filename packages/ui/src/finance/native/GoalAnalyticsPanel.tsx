import { FinanceEmptyState } from './FinanceEmptyState';
import React from 'react';
import { Text, View } from 'react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Button, IconButton, Progress, Typography, useTheme } from '@finapp/ui/native';
import type { ThemeTokens } from '../../tokens';
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
  const { tokens } = useTheme();
  const maxMonthlyAmount = months.reduce(
    (maximum, month) => (month.amount > maximum ? month.amount : maximum),
    0n,
  );
  const surface = tokens.surfaceRaised;
  const accent = color ?? tokens.primary;
  if (loading || error || !available)
    return (
      <View style={{ gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <IconButton label="Back to goal" variant="ghost" onPress={onBack}>
              <ArrowLeft size={20} color={tokens.foreground} />
            </IconButton>
          )}
          <View>
            <Typography variant="title">Goal analytics</Typography>
            <Typography variant="small">Track your progress and contribution history.</Typography>
          </View>
        </View>
        {loading ? (
          <Typography variant="small">Loading goal analytics…</Typography>
        ) : error ? (
          <View accessibilityRole="alert" style={{ gap: 10 }}>
            <Text style={{ color: tokens.destructive }}>{error}</Text>
            {onRetry && (
              <Button variant="outline" onPress={onRetry}>
                Retry
              </Button>
            )}
            <Button variant="outline" onPress={() => onBack?.()}>
              Back to goal
            </Button>
          </View>
        ) : (
          <Typography variant="small">Goal unavailable.</Typography>
        )}
      </View>
    );
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {onBack && (
          <IconButton label="Back to goal" variant="ghost" onPress={onBack}>
            <ArrowLeft size={20} color={tokens.foreground} />
          </IconButton>
        )}
        <View>
          <Typography variant="title">Goal analytics</Typography>
          <Typography variant="small">Track your progress and contribution history.</Typography>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            backgroundColor: accent,
          }}
        >
          <EntityIcon value={icon ?? 'lucide:Target'} size={23} color={tokens.background} />
        </View>
        <Typography variant="heading">{name}</Typography>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { label: 'Saved amount', amount: saved },
          { label: 'Target amount', amount: target },
          { label: 'Remaining', amount: remaining },
        ].map(({ label, amount }) => (
          <View
            key={label}
            style={{ flex: 1, gap: 5, padding: 12, borderRadius: 14, backgroundColor: surface }}
          >
            <Typography variant="caption">{label}</Typography>
            <Money amountMinor={amount} currency={currency} />
          </View>
        ))}
      </View>
      <View style={{ gap: 10, padding: 16, borderRadius: 16, backgroundColor: surface }}>
        <Typography variant="heading">Saved vs target</Typography>
        <Progress value={Math.min(100, Math.max(0, percent))} color={accent} />
        <Text style={{ color: tokens.foreground }}>
          {percent}% complete · {formatMinor(remaining, currency)} remaining
        </Text>
      </View>
      {insights && (
        <>
          <View style={{ gap: 8 }}>
            <InsightCard
              label="Average per month"
              value={
                insights.averageMonthly === null
                  ? 'Not enough history'
                  : formatMinor(insights.averageMonthly, currency)
              }
              tokens={tokens}
            />
            <InsightCard
              label="Best month"
              value={
                insights.bestMonth
                  ? `${insights.bestMonth.label} · ${formatMinor(insights.bestMonth.amount, currency)}`
                  : 'No contributions yet'
              }
              tokens={tokens}
            />
            <InsightCard
              label="Projected target"
              value={
                insights.forecastDate === null
                  ? 'Not enough history'
                  : new Date(insights.forecastDate).toLocaleDateString()
              }
              tokens={tokens}
            />
            <InsightCard
              label="Needed to meet target date"
              value={
                insights.requiredMonthly === null
                  ? 'No future target date'
                  : `${formatMinor(insights.requiredMonthly, currency)} / month`
              }
              detail={
                insights.onTrackScore === null
                  ? 'On-track estimate unavailable'
                  : `${insights.onTrackScore}% of required pace`
              }
              tokens={tokens}
            />
          </View>
          <View style={{ gap: 10, padding: 16, borderRadius: 16, backgroundColor: surface }}>
            <Typography variant="heading">Progress milestones</Typography>
            {insights.milestones.map((milestone) => (
              <View
                key={milestone.percent}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderColor: tokens.borderSubtle,
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
              </View>
            ))}
          </View>
          <View style={{ gap: 8, padding: 16, borderRadius: 16, backgroundColor: surface }}>
            <Typography variant="heading">Contribution sources</Typography>
            {insights.sources.length === 0 ? (
              <FinanceEmptyState
                kind="contribution"
                title="No linked contributions yet."
                description="Link a savings account to follow contributions toward this goal."
                compact
              />
            ) : (
              insights.sources.map((source) => (
                <View
                  key={source.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderColor: tokens.borderSubtle,
                  }}
                >
                  <Typography variant="small">
                    {source.name} · {source.sharePercent}%
                  </Typography>
                  <Money amountMinor={source.amount} currency={currency} />
                </View>
              ))
            )}
          </View>
        </>
      )}
      <View style={{ gap: 14, padding: 16, borderRadius: 16, backgroundColor: surface }}>
        <Typography variant="heading">Monthly contributions · last 6 months</Typography>
        <View
          accessibilityLabel="Monthly contribution totals"
          style={{
            height: 140,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            gap: 8,
          }}
        >
          {months.map((month) => {
            const height =
              maxMonthlyAmount > 0n
                ? Math.max(4, Number((month.amount * 100n) / maxMonthlyAmount))
                : 4;
            return (
              <View
                key={month.label}
                style={{
                  flex: 1,
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 6,
                }}
              >
                <View
                  accessibilityLabel={`${month.label}: ${formatMinor(month.amount, currency)}`}
                  style={{
                    width: '70%',
                    height: `${height}%`,
                    minHeight: 4,
                    borderTopLeftRadius: 5,
                    borderTopRightRadius: 5,
                    backgroundColor: accent,
                  }}
                />
                <Typography variant="caption">{month.label}</Typography>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="heading">Recent contributions</Typography>
        {history.length === 0 ? (
          <FinanceEmptyState
            kind="contribution"
            title="No contributions recorded yet."
            description="Contributions you make toward this goal will appear here."
            compact
          />
        ) : (
          history.map((entry) => (
            <View
              key={entry.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: tokens.borderSubtle,
              }}
            >
              <Typography variant="small">
                {new Date(entry.occurredAt).toLocaleDateString()}
              </Typography>
              <Money amountMinor={entry.amount} currency={currency} />
            </View>
          ))
        )}
      </View>
    </View>
  );
}
function InsightCard({
  label,
  value,
  detail,
  tokens,
}: {
  label: string;
  value: string;
  detail?: string;
  tokens: ThemeTokens;
}) {
  return (
    <View style={{ gap: 4, padding: 14, borderRadius: 14, backgroundColor: tokens.surfaceRaised }}>
      <Typography variant="caption">{label}</Typography>
      <Typography variant="bodyLarge">{value}</Typography>
      {detail && <Text style={{ color: tokens.foregroundMuted }}>{detail}</Text>}
    </View>
  );
}
