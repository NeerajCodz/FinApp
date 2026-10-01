import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { GoalEditor, goalTargetInput, type GoalEditorValues } from '@finapp/ui/finance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  icon?: string;
  color?: string;
  archivedAt?: number;
  updatedAt?: number;
  cloudId?: string;
};

export default function EditGoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const goals = useLocalRecords<Goal>(userId, 'goal');
  const goal = goals.data?.find((item) => [item.id, item._id, item.cloudId].includes(id));
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
      router.replace(`/goals/${goalId}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this goal.');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!userId || !goal || saving) return;
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
      router.replace('/goals' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive this goal.');
    } finally {
      setSaving(false);
    }
  }

  function confirmArchive() {
    if (!goal || saving) return;
    Alert.alert('Archive goal?', `Archive “${goal.name ?? 'this goal'}”?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => void archive() },
    ]);
  }

  const status = goals.loading
    ? 'loading'
    : goals.error
      ? 'error'
      : !goal || goal.archivedAt !== undefined
        ? 'unavailable'
        : undefined;
  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 30,
      }}
    >
      <GoalEditor
        key={String(goal?.updatedAt ?? goal?.id ?? goal?._id ?? status)}
        screenTitle="Edit goal"
        description="Update your goal details and stay on target."
        title={goal?.name ?? 'Goal details'}
        currency={goal?.currency ?? ''}
        initial={
          goal
            ? {
                name: goal.name ?? '',
                target: goalTargetInput(
                  BigInt(String(goal.targetAmountMinor ?? 0)),
                  goal.currency ?? 'INR',
                ),
                targetDate: goal.targetDate
                  ? new Date(goal.targetDate).toISOString().slice(0, 10)
                  : '',
                icon: goal.icon,
                color: goal.color,
              }
            : undefined
        }
        saving={saving}
        error={error}
        status={status}
        onRetry={() => {
          goals.retry();
        }}
        onSave={(values) => void save(values)}
        onArchive={status ? undefined : confirmArchive}
        onCancel={() => router.back()}
      />
    </ScrollView>
  );
}
