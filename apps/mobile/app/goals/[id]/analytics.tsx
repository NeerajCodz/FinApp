import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  buildGoalAnalyticsModel,
  GoalAnalyticsPanel,
  type GoalAnalyticsAccount,
  type GoalAnalyticsContribution,
} from '@finapp/ui/finance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';

type Goal = LocalRecord & {
  id?: string;
  name?: string;
  targetAmountMinor?: bigint | number | string;
  currency?: string;
  icon?: string;
  color?: string;
  archivedAt?: number;
  cloudId?: string;
  targetDate?: number;
  createdAt?: number;
};
type Contribution = LocalRecord & {
  goalId?: string;
  amountMinor?: bigint | number | string;
  occurredAt?: number;
  accountId?: string;
};
type Account = LocalRecord & {
  name?: string;
  color?: string;
  icon?: string;
  archivedAt?: number;
  cloudId?: string;
};
const toMinor = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
};
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );

export default function GoalAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const goals = useLocalRecords<Goal>(userId, 'goal');
  const contributions = useLocalRecords<Contribution>(userId, 'goalContribution');
  const accountRecords = useLocalRecords<Account>(userId, 'account');
  const goal = goals.data?.find((item) => aliases(item).includes(id));
  const goalAliases = goal ? aliases(goal) : [id];
  const history = (contributions.data ?? [])
    .filter((entry) => typeof entry.goalId === 'string' && goalAliases.includes(entry.goalId))
    .sort((a, b) => Number(b.occurredAt ?? 0) - Number(a.occurredAt ?? 0));
  const target = toMinor(goal?.targetAmountMinor);
  const currency = goal?.currency ?? 'INR';
  const accounts: GoalAnalyticsAccount[] = (accountRecords.data ?? [])
    .filter((account) => account.archivedAt === undefined)
    .map((account) => ({
      id: String(account.id ?? account._id ?? ''),
      name: account.name ?? 'Account',
      color: account.color,
      icon: account.icon,
    }));
  const accountIds = new Map(
    (accountRecords.data ?? []).flatMap((account) =>
      aliases(account).map((alias) => [alias, String(account.id ?? account._id ?? '')] as const),
    ),
  );
  const analyticsHistory: GoalAnalyticsContribution[] = history.map((entry) => ({
    id: String(entry.id ?? entry._id ?? ''),
    occurredAt: Number(entry.occurredAt ?? 0),
    amount: toMinor(entry.amountMinor),
    accountId: typeof entry.accountId === 'string' ? accountIds.get(entry.accountId) : undefined,
  }));
  const now = Date.now();
  const insights = buildGoalAnalyticsModel({
    contributions: analyticsHistory,
    accounts,
    target,
    targetDate: goal?.targetDate,
    createdAt: goal?.createdAt,
    now,
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
        name={goal?.name ?? 'Savings goal'}
        icon={goal?.icon}
        color={goal?.color}
        currency={currency}
        saved={insights.saved}
        target={insights.target}
        remaining={insights.remaining}
        percent={insights.percent}
        months={insights.months}
        insights={insights}
        history={analyticsHistory}
        loading={goals.loading || contributions.loading || accountRecords.loading}
        error={
          goals.error || contributions.error || accountRecords.error
            ? 'Goal analytics could not be loaded.'
            : undefined
        }
        available={Boolean(goal && goal.archivedAt === undefined)}
        onBack={() => router.back()}
        onRetry={() => {
          goals.retry();
          contributions.retry();
          accountRecords.retry();
        }}
      />
    </ScrollView>
  );
}
