'use client';

import { useRouter } from 'next/navigation';
import { GoalAnalyticsPanel, selectGoalAnalytics } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { type LocalRecord } from '@/lib/offline/repository';

/** Analytics for a single goal, or for all active goals when `goalId` is omitted. */
export function GoalAnalyticsView({ goalId }: { goalId?: string }) {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const goals = useLocalRecords<LocalRecord>('goal');
  const contributions = useLocalRecords<LocalRecord>('goalContribution');
  const accounts = useLocalRecords<LocalRecord>('account');
  if (!userId)
    return (
      <FinanceSignedOut
        section="GOALS"
        title="Your goals stay private."
        description="Sign in to review your savings goal analytics."
      />
    );
  const view = selectGoalAnalytics({
    goals: goals.records,
    contributions: contributions.records,
    accounts: accounts.records,
    goalId,
    now: Date.now(),
  });
  return (
    <GoalAnalyticsPanel
      name={view.name}
      icon={view.icon}
      color={view.color}
      currency={view.currency}
      saved={view.insights.saved}
      target={view.insights.target}
      remaining={view.insights.remaining}
      percent={view.insights.percent}
      months={view.insights.months}
      insights={view.insights}
      history={view.history}
      loading={goals.loading || contributions.loading || accounts.loading}
      error={
        goals.error || contributions.error || accounts.error
          ? 'Goal analytics could not be loaded.'
          : undefined
      }
      available={view.available}
      onBack={() => router.push(goalId ? `/goals/${encodeURIComponent(goalId)}` : '/goals')}
      onRetry={() => window.location.reload()}
    />
  );
}
