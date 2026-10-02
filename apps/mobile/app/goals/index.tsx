import { router } from 'expo-router';
import {
  GoalsOverviewScreen,
  resolveDefaultCurrency,
  type GoalOverviewItem,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';

type Goal = LocalRecord & {
  id?: string;
  name?: string;
  targetAmountMinor?: bigint | number | string;
  currency?: string;
  archivedAt?: number;
  completedAt?: number;
  targetDate?: number;
  icon?: string;
  color?: string;
  goalType?: string;
  monthlyContributionMinor?: bigint | number | string;
  accountId?: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  reminderFrequency?: 'none' | 'weekly' | 'monthly';
  cloudId?: string;
};
type Contribution = LocalRecord & { goalId?: string; amountMinor?: bigint | number | string };
const toMinor = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
};

export default function GoalsScreen() {
  const { userId, isConnected } = useLocalSync();
  const goals = useLocalRecords<Goal>(userId, 'goal');
  const contributions = useLocalRecords<Contribution>(userId, 'goalContribution');
  const profiles = useLocalRecords<LocalRecord & { defaultCurrency?: string }>(userId, 'profile');
  const settings = useLocalRecords<LocalRecord & { currency?: string; defaultCurrency?: string }>(
    userId,
    'settings',
  );
  const currency = resolveDefaultCurrency(profiles.data, settings.data) ?? '';
  const activeGoals = (goals.data ?? [])
    .filter((goal) => goal.archivedAt === undefined)
    .sort(
      (left, right) =>
        Number(Boolean(left.completedAt)) - Number(Boolean(right.completedAt)) ||
        (left.name ?? '').localeCompare(right.name ?? ''),
    );
  const rows: GoalOverviewItem[] = activeGoals.map((goal) => {
    const aliases = [goal.id, goal._id, goal.cloudId].filter(
      (value): value is string => typeof value === 'string',
    );
    const saved = (contributions.data ?? [])
      .filter((entry) => typeof entry.goalId === 'string' && aliases.includes(entry.goalId))
      .reduce((sum, entry) => sum + toMinor(entry.amountMinor), 0n);
    const target = toMinor(goal.targetAmountMinor);
    return {
      id: String(goal.id ?? goal._id ?? goal.cloudId ?? ''),
      name: goal.name ?? 'Savings goal',
      icon: goal.icon,
      color: goal.color,
      goalType: goal.goalType,
      monthlyContributionMinor:
        goal.monthlyContributionMinor !== undefined
          ? toMinor(goal.monthlyContributionMinor)
          : undefined,
      accountId: goal.accountId,
      priority: goal.priority,
      notes: goal.notes,
      reminderFrequency: goal.reminderFrequency,
      saved,
      target,
      currency: goal.currency ?? currency ?? 'INR',
      percent: target > 0n ? Number((saved * 100n) / target) : 0,
      targetDate: goal.targetDate,
      completed: goal.completedAt !== undefined,
    };
  });
  const currencies = new Set(rows.map((row) => row.currency));
  const totalSaved = currencies.size === 1 ? rows.reduce((sum, row) => sum + row.saved, 0n) : null;
  const loading = goals.loading || contributions.loading || profiles.loading || settings.loading;
  const hasError = Boolean(goals.error || contributions.error || profiles.error || settings.error);

  return (
    <GoalsOverviewScreen
      goals={rows}
      totalSaved={totalSaved}
      currencyCount={currencies.size}
      loading={loading}
      error={hasError}
      connected={isConnected}
      defaultCurrency={currency}
      onAdd={() => router.push('/goals/new' as never)}
      onOpen={(id) => router.push(`/goals/${id}` as never)}
      onAnalytics={() => router.push('/goals/analytics' as never)}
      onRetry={() => {
        goals.retry();
        contributions.retry();
        profiles.retry();
        settings.retry();
      }}
      onSetCurrency={() => router.push('/settings/currency' as never)}
    />
  );
}
