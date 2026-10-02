'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GoalEditor, resolveDefaultCurrency, type GoalEditorValues } from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
type GoalAccount = LocalRecord & { name?: string; currency?: string; archivedAt?: number; cloudId?: string };

export default function NewGoalPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: profiles } = useLocalRecords<LocalRecord & { defaultCurrency?: string }>(
    'profile',
  );
  const { records: settings } = useLocalRecords<
    LocalRecord & { currency?: string; defaultCurrency?: string }
  >('settings');
  const { records: accountRecords } = useLocalRecords<GoalAccount>('account');
  const currency = resolveDefaultCurrency(profiles, settings) ?? '';
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  async function save(values: GoalEditorValues) {
    if (!userId || !currency || saving) return;
    setSaving(true);
    setError('');
    try {
      const targetAmountMinor = parseMinor(values.target, currency);
      const monthlyContributionMinor = values.monthlyContribution
        ? parseMinor(values.monthlyContribution, currency)
        : undefined;
      const initialSavedMinor = values.initialSaved
        ? parseMinor(values.initialSaved, currency)
        : 0n;
      if (targetAmountMinor <= 0n) throw new Error('Enter a positive target amount.');
      if (monthlyContributionMinor !== undefined && monthlyContributionMinor < 0n)
        throw new Error('Monthly contribution cannot be negative.');
      if (initialSavedMinor < 0n) throw new Error('Current saved amount cannot be negative.');
      const targetDate = values.targetDate
        ? new Date(`${values.targetDate}T23:59:59`).getTime()
        : undefined;
      if (targetDate !== undefined && (!Number.isFinite(targetDate) || targetDate <= Date.now()))
        throw new Error('Choose a future target date.');
      const selectedAccount = values.accountId
        ? accountRecords.find(
            (account) =>
              String(account.id ?? account._id ?? '') === values.accountId &&
              account.archivedAt === undefined,
          )
        : undefined;
      if (values.accountId && !selectedAccount) throw new Error('Choose an active account.');
      if (selectedAccount?.currency && selectedAccount.currency !== currency)
        throw new Error('The linked account must use the goal currency.');
      const now = Date.now();
      const payload = {
        name: values.name.trim(),
        targetAmountMinor,
        currency,
        ...(targetDate !== undefined ? { targetDate } : {}),
        ...(values.icon ? { icon: values.icon } : {}),
        ...(values.color ? { color: values.color } : {}),
        ...(values.goalType ? { goalType: values.goalType } : {}),
        ...(monthlyContributionMinor !== undefined ? { monthlyContributionMinor } : {}),
        ...(selectedAccount ? { accountId: String(selectedAccount.id ?? selectedAccount._id) } : {}),
        ...(values.priority ? { priority: values.priority } : {}),
        ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
        ...(values.reminderFrequency
          ? { reminderFrequency: values.reminderFrequency }
          : {}),
      };
      const goalId = await commitLocalWrite(
        userId,
        'goal',
        'goal.create',
        { ownerId: userId, ...payload, createdAt: now, updatedAt: now },
        payload,
        {
          dependencies:
            selectedAccount && !selectedAccount.cloudId && !selectedAccount._id
              ? [`account:${String(selectedAccount.id)}`]
              : [],
        },
      );
      if (initialSavedMinor > 0n) {
        const occurredAt = Date.now();
        await commitLocalWrite(
          userId,
          'goalContribution',
          'goal.contribute',
          {
            ownerId: userId,
            goalId,
            amountMinor: initialSavedMinor,
            currency,
            occurredAt,
            createdAt: occurredAt,
          },
          { goalId, amountMinor: initialSavedMinor },
          { dependencies: [`goal:${goalId}`] },
        );
      }
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
      accounts={accountRecords
        .filter((account) => account.archivedAt === undefined && account.currency === currency)
        .map((account) => ({
          id: String(account.id ?? account._id ?? ''),
          name: account.name ?? 'Account',
        }))
        .filter((account) => account.id)}
      saving={saving}
      error={error}
      onSave={(values) => void save(values)}
      onCancel={() => router.push('/goals')}
    />
  );
}
