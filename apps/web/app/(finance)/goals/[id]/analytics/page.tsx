'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  buildGoalAnalyticsModel,
  GoalAnalyticsPanel,
  type GoalAnalyticsAccount,
  type GoalAnalyticsContribution,
} from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { type LocalRecord } from '@/lib/offline/repository';

type Goal = LocalRecord & {
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

export default function GoalAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
  const {
    records: goals,
    loading: goalsLoading,
    error: goalsError,
  } = useLocalRecords<Goal>('goal');
  const {
    records: entries,
    loading: entriesLoading,
    error: entriesError,
  } = useLocalRecords<Contribution>('goalContribution');
  const {
    records: accountRecords,
    loading: accountsLoading,
    error: accountsError,
  } = useLocalRecords<Account>('account');
  const goal = goals.find((item) => aliases(item).includes(id));
  const goalAliases = goal ? aliases(goal) : [id];
  const history = entries
    .filter((entry) => typeof entry.goalId === 'string' && goalAliases.includes(entry.goalId))
    .sort((a, b) => Number(b.occurredAt ?? 0) - Number(a.occurredAt ?? 0));
  const target = toMinor(goal?.targetAmountMinor);
  const currency = goal?.currency ?? 'INR';
  const accounts: GoalAnalyticsAccount[] = accountRecords
    .filter((account) => account.archivedAt === undefined)
    .map((account) => ({
      id: String(account.id ?? account._id ?? ''),
      name: account.name ?? 'Account',
      color: account.color,
      icon: account.icon,
    }));
  const accountIds = new Map(
    accountRecords.flatMap((account) =>
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
  if (!userId)
    return (
      <FinanceSignedOut
        section="GOALS"
        title="Your goals stay private."
        description="Sign in to review your savings goal analytics."
      />
    );
  return (
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
      loading={goalsLoading || entriesLoading || accountsLoading}
      error={
        goalsError || entriesError || accountsError
          ? 'Goal analytics could not be loaded.'
          : undefined
      }
      available={Boolean(goal && goal.archivedAt === undefined)}
      onBack={() => router.push(`/goals/${encodeURIComponent(id)}`)}
      onRetry={() => window.location.reload()}
    />
  );
}
