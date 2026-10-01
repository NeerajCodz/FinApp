'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  GoalsOverviewScreen,
  resolveDefaultCurrency,
  type GoalOverviewItem,
} from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { type LocalRecord } from '@/lib/offline/repository';

type Goal = LocalRecord & {
  name?: string;
  targetAmountMinor?: bigint | number | string;
  currency?: string;
  targetDate?: number;
  completedAt?: number;
  archivedAt?: number;
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

export default function GoalsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const {
    records: goals,
    loading: goalsLoading,
    error: goalsError,
  } = useLocalRecords<Goal>('goal');
  const {
    records: contributions,
    loading: contributionsLoading,
    error: contributionsError,
  } = useLocalRecords<Contribution>('goalContribution');
  const {
    records: profiles,
    loading: profilesLoading,
    error: profilesError,
  } = useLocalRecords<LocalRecord & { defaultCurrency?: string }>('profile');
  const {
    records: settings,
    loading: settingsLoading,
    error: settingsError,
  } = useLocalRecords<LocalRecord & { currency?: string; defaultCurrency?: string }>('settings');
  const selectedCurrency = resolveDefaultCurrency(profiles, settings) ?? '';
  const activeGoals = goals
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
    const saved = contributions
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
      currency: goal.currency ?? selectedCurrency ?? 'INR',
      percent: target > 0n ? Number((saved * 100n) / target) : 0,
      targetDate: goal.targetDate,
      completed: goal.completedAt !== undefined,
    };
  });
  const currencies = new Set(rows.map((row) => row.currency));
  const totalSaved = currencies.size === 1 ? rows.reduce((sum, row) => sum + row.saved, 0n) : null;
  const loading = goalsLoading || contributionsLoading || profilesLoading || settingsLoading;
  const loadError = goalsError ?? contributionsError ?? profilesError ?? settingsError;

  if (!userId)
    return (
      <FinanceSignedOut
        section="GOALS"
        title="Give future-you a head start."
        description="Sign in to keep your goals available across your devices, even offline."
      />
    );
  return (
    <GoalsOverviewScreen
      goals={rows}
      totalSaved={totalSaved}
      currencyCount={currencies.size}
      loading={loading}
      error={Boolean(loadError)}
      connected={isConnected}
      defaultCurrency={selectedCurrency}
      onAdd={() => router.push('/goals/new')}
      onOpen={(id) => router.push(`/goals/${encodeURIComponent(id)}`)}
      onAnalytics={() => router.push('/goals/analytics')}
      onRetry={() => window.location.reload()}
      onSetCurrency={() => router.push('/settings/currency')}
    />
  );
}
