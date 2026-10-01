import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { GoalEditor, resolveDefaultCurrency, type GoalEditorValues } from '@finapp/ui/finance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { parseMinor } from '@/lib/money';
import type { LocalRecord } from '@/local/repository';

export default function NewGoalScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const profiles = useLocalRecords<LocalRecord & { defaultCurrency?: string }>(userId, 'profile');
  const settings = useLocalRecords<LocalRecord & { currency?: string; defaultCurrency?: string }>(
    userId,
    'settings',
  );
  const currency = resolveDefaultCurrency(profiles.data, settings.data) ?? '';
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  async function save(values: GoalEditorValues) {
    if (!userId || !currency || saving) return;
    setSaving(true);
    setError('');
    try {
      const targetAmountMinor = parseMinor(values.target, currency);
      if (targetAmountMinor <= 0n) throw new Error('Enter a positive target amount.');
      const targetDate = values.targetDate
        ? new Date(`${values.targetDate}T23:59:59`).getTime()
        : undefined;
      if (targetDate !== undefined && (!Number.isFinite(targetDate) || targetDate <= Date.now()))
        throw new Error('Choose a future target date.');
      const now = Date.now();
      const payload = {
        name: values.name.trim(),
        targetAmountMinor,
        currency,
        targetDate,
        ...(values.icon ? { icon: values.icon } : {}),
        ...(values.color ? { color: values.color } : {}),
      };
      await commitLocalWrite(
        userId,
        'goal',
        'goal.create',
        { ownerId: userId, ...payload, createdAt: now, updatedAt: now },
        payload,
      );
      router.replace('/goals');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this goal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <GoalEditor
        screenTitle="New goal"
        description="Set a goal, stay motivated, and build a brighter financial future."
        title="Goal details"
        currency={currency}
        saving={saving}
        error={error}
        onSave={(values) => void save(values)}
        onCancel={() => router.back()}
      />
    </ScrollView>
  );
}
