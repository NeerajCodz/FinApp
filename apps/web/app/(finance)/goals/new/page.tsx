'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GoalEditor, resolveDefaultCurrency, type GoalEditorValues } from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

export default function NewGoalPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: profiles } = useLocalRecords<LocalRecord & { defaultCurrency?: string }>(
    'profile',
  );
  const { records: settings } = useLocalRecords<
    LocalRecord & { currency?: string; defaultCurrency?: string }
  >('settings');
  const currency = resolveDefaultCurrency(profiles, settings) ?? '';
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
      router.push('/goals');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this goal.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <FinanceSignedOut
        section="GOALS"
        title="Give future-you a head start."
        description="Sign in to create and sync a savings goal."
      />
    );
  return (
    <GoalEditor
      screenTitle="New goal"
      description="Set a goal, stay motivated, and build a brighter financial future."
      title="Goal details"
      currency={currency}
      saving={saving}
      error={error}
      onSave={(values) => void save(values)}
      onCancel={() => router.push('/goals')}
    />
  );
}
