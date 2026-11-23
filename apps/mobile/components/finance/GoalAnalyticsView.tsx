import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { GoalAnalyticsPanel, selectGoalAnalytics } from '@finapp/ui/finance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';

/** Analytics for a single goal, or for all active goals when `goalId` is omitted. */
export function GoalAnalyticsView({ goalId }: { goalId?: string }) {
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const goals = useLocalRecords<LocalRecord>(userId, 'goal');
  const contributions = useLocalRecords<LocalRecord>(userId, 'goalContribution');
  const accounts = useLocalRecords<LocalRecord>(userId, 'account');
  const view = selectGoalAnalytics({
    goals: goals.data ?? [],
    contributions: contributions.data ?? [],
    accounts: accounts.data ?? [],
    goalId,
    now: Date.now(),
  });
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 30,
      }}
    >
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
        onBack={() => router.back()}
        onRetry={() => {
          goals.retry();
          contributions.retry();
          accounts.retry();
        }}
      />
    </ScrollView>
  );
}
