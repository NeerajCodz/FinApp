'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  GoalDetailScreen,
  type GoalDetailScreenProps,
  type GoalHistoryItem,
} from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { parseMinor } from '@convex/shared/money';

// Explicit view-model fields mirror the goal and contribution records from offline storage.
type Goal = LocalRecord & {
  name?: string;
  targetAmountMinor?: bigint | number | string;
  currency?: string;
  targetDate?: number;
  completedAt?: number;
  archivedAt?: number;
  cloudId?: string;
  icon?: string;
  color?: string;
  updatedAt?: number;
};
type Contribution = LocalRecord & {
  goalId?: string;
  amountMinor?: bigint | number | string;
  occurredAt?: number;
};
const toMinor = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
};

export default function GoalDetailPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
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
  const [saving, setSaving] = React.useState(false);
  const [iconSaving, setIconSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState('');
  const goal = goals.find((entry) => [entry.id, entry._id, entry.cloudId].includes(routeId));
  const goalAliases = goal
    ? [goal.id, goal._id, goal.cloudId].filter(
        (value): value is string => typeof value === 'string',
      )
    : [routeId];
  const localId = String(goal?.id ?? goal?._id ?? goal?.cloudId ?? '');
  const history = contributions
    .filter((entry) => typeof entry.goalId === 'string' && goalAliases.includes(entry.goalId))
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const saved = history.reduce((sum, entry) => sum + toMinor(entry.amountMinor), 0n);
  const target = toMinor(goal?.targetAmountMinor);
  const currency = goal?.currency ?? 'INR';
  const percent = target > 0n ? Number((saved * 100n) / target) : 0;
  const screenGoal = {
    id: localId || routeId,
    name: goal?.name ?? 'Goal',
    icon: goal?.icon,
    color: goal?.color,
    saved,
    target,
    currency,
    percent,
    targetDate: goal?.targetDate,
    completed: goal?.completedAt !== undefined,
  };
  const screenHistory: GoalHistoryItem[] = history.map((entry) => ({
    id: String(entry.id ?? entry._id ?? ''),
    occurredAt: Number(entry.occurredAt ?? 0),
    amount: toMinor(entry.amountMinor),
  }));
  const loading = goalsLoading || contributionsLoading;
  const loadError = goalsError ?? contributionsError;
  const available = Boolean(goal && goal.archivedAt === undefined);

  async function contribute(amount: string) {
    if (!userId || !goal || !available || saving) return;
    setSaving(true);
    setActionError('');
    try {
      const amountMinor = parseMinor(amount, currency);
      if (amountMinor <= 0n) throw new Error('Enter a positive contribution amount.');
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        goalId: localId,
        amountMinor,
        currency,
        occurredAt: now,
        createdAt: now,
      };
      await commitLocalWrite(
        userId,
        'goalContribution',
        'goal.contribute',
        record,
        { goalId: localId, amountMinor },
        { dependencies: goal._id || goal.cloudId ? [] : [`goal:${localId}`] },
      );
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Could not record this contribution.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveIcon(icon?: string) {
    if (!userId || !goal || iconSaving || !localId) return;
    const goalId = String(goal._id ?? goal.cloudId ?? goal.id ?? '');
    setIconSaving(true);
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
      setActionError(cause instanceof Error ? cause.message : 'Could not update this goal icon.');
    } finally {
      setIconSaving(false);
    }
  }

  if (!userId)
    return (
      <FinanceSignedOut
        section="SAVINGS GOAL"
        title="Keep your progress close."
        description="Sign in to review this locally saved goal and add contributions."
      />
    );
  const props: GoalDetailScreenProps = {
    goal: screenGoal,
    available,
    history: screenHistory,
    loading,
    error: loadError || undefined,
    actionError: actionError || undefined,
    saving,
    onContribute: (amount) => void contribute(amount),
    onIconChange: (icon) => void saveIcon(icon),
    onEdit: () => router.push(`/goals/${encodeURIComponent(localId || routeId)}/edit`),
    onAnalytics: () => router.push(`/goals/${encodeURIComponent(localId || routeId)}/analytics`),
    onRetry: () => window.location.reload(),
  };
  return <GoalDetailScreen {...props} />;
}
