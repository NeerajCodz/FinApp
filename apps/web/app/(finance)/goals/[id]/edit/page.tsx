'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GoalEditor, goalTargetInput, type GoalEditorValues } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Goal = LocalRecord & {
  name?: string;
  targetAmountMinor?: bigint | number | string;
  currency?: string;
  targetDate?: number;
  icon?: string;
  color?: string;
  archivedAt?: number;
  updatedAt?: number;
  cloudId?: string;
};

export default function EditGoalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: goals, loading, error: loadError } = useLocalRecords<Goal>('goal');
  const goal = goals.find((item) => [item.id, item._id, item.cloudId].includes(id));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  async function save(values: GoalEditorValues) {
    if (!userId || !goal || saving) return;
    setSaving(true);
    setError('');
    try {
      const targetAmountMinor = parseMinor(values.target, goal.currency ?? 'INR');
      if (targetAmountMinor <= 0n) throw new Error('Enter a positive target amount.');
      const targetDate = values.targetDate
        ? new Date(`${values.targetDate}T23:59:59`).getTime()
        : null;
      if (targetDate !== null && (!Number.isFinite(targetDate) || targetDate <= Date.now()))
        throw new Error('Choose a future target date.');
      const goalId = String(goal.id ?? goal._id ?? goal.cloudId ?? '');
      await commitLocalWrite(
        userId,
        'goal',
        'goal.update',
        {
          ...goal,
          name: values.name.trim(),
          targetAmountMinor,
          targetDate: targetDate ?? undefined,
          icon: values.icon,
          color: values.color,
        },
        {
          goalId,
          name: values.name.trim(),
          targetAmountMinor,
          targetDate,
          icon: values.icon ?? null,
          color: values.color ?? null,
        },
        {
          recordId: goalId,
          dependencies: goal._id || goal.cloudId ? [] : [`goal:${goalId}`],
          baseUpdatedAt: goal.updatedAt,
        },
      );
      router.push(`/goals/${encodeURIComponent(goalId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this goal.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveGoal() {
    if (!userId || !goal || saving || !window.confirm(`Archive “${goal.name ?? 'this goal'}”?`))
      return;
    const goalId = String(goal.id ?? goal._id ?? goal.cloudId ?? '');
    const now = Date.now();
    setSaving(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'goal',
        'goal.archive',
        { ...goal, archivedAt: now },
        { goalId },
        {
          recordId: goalId,
          dependencies: goal._id || goal.cloudId ? [] : [`goal:${goalId}`],
          baseUpdatedAt: goal.updatedAt,
        },
      );
      router.push('/goals');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive this goal.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <FinanceSignedOut
        section="GOALS"
        title="Sign in to edit this goal."
        description="Goal changes sync with your account and remain available offline."
      />
    );
  if (loading)
    return (
      <GoalEditor
        screenTitle="Edit goal"
        description="Update your goal details and stay on target."
        title="Goal details"
        currency=""
        saving={false}
        status="loading"
        onCancel={() => router.back()}
      />
    );
  if (loadError)
    return (
      <GoalEditor
        screenTitle="Edit goal"
        description="Update your goal details and stay on target."
        title="Goal details"
        currency=""
        saving={false}
        status="error"
        onRetry={() => window.location.reload()}
        onCancel={() => router.back()}
      />
    );
  if (!goal || goal.archivedAt !== undefined)
    return (
      <GoalEditor
        screenTitle="Edit goal"
        description="Update your goal details and stay on target."
        title="Goal details"
        currency=""
        saving={false}
        status="unavailable"
        onCancel={() => router.back()}
      />
    );
  return (
    <GoalEditor
      key={String(goal.updatedAt ?? goal.id ?? goal._id)}
      screenTitle="Edit goal"
      description="Update your goal details and stay on target."
      title={goal.name ?? 'Goal details'}
      currency={goal.currency ?? 'INR'}
      initial={{
        name: goal.name ?? '',
        target: goalTargetInput(
          BigInt(String(goal.targetAmountMinor ?? 0)),
          goal.currency ?? 'INR',
        ),
        targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : '',
        icon: goal.icon,
        color: goal.color,
      }}
      saving={saving}
      error={error}
      onSave={(values) => void save(values)}
      onArchive={() => void archiveGoal()}
      onCancel={() => router.back()}
    />
  );
}
