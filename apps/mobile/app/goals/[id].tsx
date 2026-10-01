import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  GoalDetailScreen,
  type GoalHistoryItem,
  type GoalDetailScreenProps,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { parseMinor } from '@/lib/money';
import type { LocalRecord } from '@/local/repository';

type Goal = LocalRecord & {
  id?: string;
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
  updatedAt?: number;
  cloudId?: string;
};
type GoalAccount = LocalRecord & { name?: string; cloudId?: string };
type Contribution = LocalRecord & {
  id?: string;
  goalId?: string;
  amountMinor?: bigint | number | string;
  occurredAt?: number;
  accountId?: string;
};
const toMinor = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
};

export default function GoalDetailScreenRoute() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const { userId } = useLocalSync();
  const goals = useLocalRecords<Goal>(userId, 'goal');
  const contributions = useLocalRecords<Contribution>(userId, 'goalContribution');
  const accounts = useLocalRecords<GoalAccount>(userId, 'account');
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState('');
  const goal = goals.data?.find((item) => [item.id, item._id, item.cloudId].includes(routeId));
  const aliases = goal
    ? [goal.id, goal._id, goal.cloudId].filter(
        (value): value is string => typeof value === 'string',
      )
    : [routeId];
  const localId = String(goal?.id ?? goal?._id ?? goal?.cloudId ?? '');
  const historyRecords = (contributions.data ?? [])
    .filter((entry) => typeof entry.goalId === 'string' && aliases.includes(entry.goalId))
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const saved = historyRecords.reduce((sum, entry) => sum + toMinor(entry.amountMinor), 0n);
  const target = toMinor(goal?.targetAmountMinor);
  const currency = goal?.currency ?? 'INR';
  const percent = target > 0n ? Number((saved * 100n) / target) : 0;
  const screenGoal = {
    id: localId || routeId,
    name: goal?.name ?? 'Goal',
    icon: goal?.icon,
    color: goal?.color,
    goalType: goal?.goalType,
    monthlyContributionMinor:
      goal?.monthlyContributionMinor !== undefined
        ? toMinor(goal.monthlyContributionMinor)
        : undefined,
    accountId: goal?.accountId,
    priority: goal?.priority,
    notes: goal?.notes,
    reminderFrequency: goal?.reminderFrequency,
    saved,
    target,
    currency,
    percent,
    targetDate: goal?.targetDate,
    completed: goal?.completedAt !== undefined,
  };
  const history: GoalHistoryItem[] = historyRecords.map((entry) => ({
    id: String(entry.id ?? entry._id ?? ''),
    occurredAt: Number(entry.occurredAt ?? 0),
    amount: toMinor(entry.amountMinor),
    accountId: typeof entry.accountId === 'string' ? entry.accountId : undefined,
  }));
  const available = Boolean(goal && goal.archivedAt === undefined);
  const loading = goals.loading || contributions.loading || accounts.loading;
  const loadError = goals.error || contributions.error || accounts.error;

  async function contribute(amount: string) {
    if (!userId || !goal || !available || saving) return;
    setSaving(true);
    setActionError('');
    try {
      const amountMinor = parseMinor(amount, currency);
      if (amountMinor <= 0n) throw new Error('Enter a positive contribution amount.');
      const now = Date.now();
      await commitLocalWrite(
        userId,
        'goalContribution',
        'goal.contribute',
        {
          goalId: localId,
          ownerId: userId,
          amountMinor,
          currency,
          occurredAt: now,
          createdAt: now,
        },
        { goalId: localId, amountMinor },
        { dependencies: goal._id || goal.cloudId ? [] : [`goal:${localId}`] },
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not record contribution.');
    } finally {
      setSaving(false);
    }
  }

  async function saveIcon(icon?: string) {
    if (!userId || !goal || saving || !localId) return;
    const goalId = String(goal._id ?? goal.cloudId ?? goal.id ?? '');
    setSaving(true);
    setActionError('');
    try {
      await commitLocalWrite(
        userId,
        'goal',
        'goal.setIcon',
        { ...goal, icon },
        { goalId, icon: icon ?? null },
        {
          recordId: localId,
          dependencies: goal._id || goal.cloudId ? [] : [`goal:${goalId}`],
          baseUpdatedAt: goal.updatedAt,
        },
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update goal icon.');
    } finally {
      setSaving(false);
    }
  }

  const props: GoalDetailScreenProps = {
    goal: screenGoal,
    available,
    history,
    accounts: (accounts.data ?? []).flatMap((account) =>
      [account.id, account._id, account.cloudId]
        .filter((value): value is string => typeof value === 'string')
        .map((id) => ({ id, name: account.name ?? 'Account' })),
    ),
    loading,
    error: loadError ? 'Saved goal details could not be loaded.' : undefined,
    actionError: actionError || undefined,
    saving,
    onContribute: (amount) => void contribute(amount),
    onIconChange: (icon) => void saveIcon(icon),
    onBack: () => router.back(),
    onRetry: () => {
      goals.retry();
      contributions.retry();
      accounts.retry();
    },
    onEdit: () => router.push(`/goals/${localId || routeId}/edit` as never),
    onAnalytics: () => router.push(`/goals/${localId || routeId}/analytics` as never),
  };
  return <GoalDetailScreen {...props} />;
}
