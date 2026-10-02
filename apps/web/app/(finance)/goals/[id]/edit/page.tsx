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
  goalType?: string;
  monthlyContributionMinor?: bigint | number | string;
  accountId?: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  reminderFrequency?: 'none' | 'weekly' | 'monthly';
  archivedAt?: number;
  updatedAt?: number;
  cloudId?: string;
};
type GoalAccount = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Contribution = LocalRecord & {
  goalId?: string;
  amountMinor?: bigint | number | string;
  occurredAt?: number;
  accountId?: string;
};

function minor(value: unknown): bigint {
  try {
    return BigInt(String(value ?? 0));
  } catch {
    return 0n;
  }
}


export default function EditGoalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: goals, loading, error: loadError } = useLocalRecords<Goal>('goal');
  const goal = goals.find((item) => [item.id, item._id, item.cloudId].includes(id));
  const accountState = useLocalRecords<GoalAccount>('account');
  const accountRecords = accountState.records;
  const { records: contributionRecords, loading: contributionsLoading, error: contributionsError } =
    useLocalRecords<Contribution>('goalContribution');
  const goalAliases = [goal?.id, goal?._id, goal?.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
  const historyRecords = contributionRecords
    .filter((entry) => typeof entry.goalId === 'string' && goalAliases.includes(entry.goalId))
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const history = historyRecords.map((entry) => ({
    id: String(entry.id ?? entry._id ?? ''),
    occurredAt: Number(entry.occurredAt ?? 0),
    amount: minor(entry.amountMinor),
    accountId: typeof entry.accountId === 'string' ? entry.accountId : undefined,
  }));
  const saved = history.reduce((sum, entry) => sum + entry.amount, 0n);
  const editorLoading = loading || contributionsLoading || accountState.loading;
  const editorLoadError = loadError || contributionsError || accountState.error;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  async function save(values: GoalEditorValues) {
    if (!userId || !goal || saving) return;
    setSaving(true);
    setError('');
    try {
      const currency = goal.currency ?? 'INR';
      const targetAmountMinor = parseMinor(values.target, currency);
      const monthlyContributionMinor = values.monthlyContribution
        ? parseMinor(values.monthlyContribution, currency)
        : null;
      if (targetAmountMinor <= 0n) throw new Error('Enter a positive target amount.');
      if (monthlyContributionMinor !== null && monthlyContributionMinor < 0n)
        throw new Error('Monthly contribution cannot be negative.');
      const targetDate = values.targetDate
        ? new Date(`${values.targetDate}T23:59:59`).getTime()
        : null;
      if (targetDate !== null && (!Number.isFinite(targetDate) || targetDate <= Date.now()))
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
      const goalId = String(goal.id ?? goal._id ?? goal.cloudId ?? '');
      const accountId = selectedAccount
        ? String(selectedAccount.id ?? selectedAccount._id ?? '')
        : null;
      const notes = values.notes?.trim() || null;
      const goalType = values.goalType || null;
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
          goalType: goalType ?? undefined,
          monthlyContributionMinor: monthlyContributionMinor ?? undefined,
          accountId: accountId ?? undefined,
          priority: values.priority ?? 'low',
          notes: notes ?? undefined,
          reminderFrequency: values.reminderFrequency ?? 'none',
        },
        {
          goalId,
          name: values.name.trim(),
          targetAmountMinor,
          targetDate,
          icon: values.icon ?? null,
          color: values.color ?? null,
          goalType,
          monthlyContributionMinor,
          accountId,
          priority: values.priority ?? 'low',
          notes,
          reminderFrequency: values.reminderFrequency ?? 'none',
        },
        {
          recordId: goalId,
          dependencies: [
            ...(!goal._id && !goal.cloudId ? [`goal:${goalId}`] : []),
            ...(selectedAccount && !selectedAccount._id && !selectedAccount.cloudId
              ? [`account:${accountId}`]
              : []),
          ],
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
  if (editorLoading)
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
  if (editorLoadError)
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
      accounts={accountRecords
        .filter((account) => account.archivedAt === undefined && account.currency === goal.currency)
        .map((account) => ({
          id: String(account.id ?? account._id ?? ''),
          name: account.name ?? 'Account',
        }))
        .filter((account) => account.id)}
      saved={saved}
      history={history}
      initial={{
        name: goal.name ?? '',
        target: goalTargetInput(
          BigInt(String(goal.targetAmountMinor ?? 0)),
          goal.currency ?? 'INR',
        ),
        targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : '',
        icon: goal.icon,
        color: goal.color,
        goalType: goal.goalType,
        monthlyContribution:
          goal.monthlyContributionMinor !== undefined
            ? goalTargetInput(minor(goal.monthlyContributionMinor), goal.currency ?? 'INR')
            : '',
        accountId: goal.accountId,
        priority: goal.priority ?? 'low',
        notes: goal.notes ?? '',
        reminderFrequency: goal.reminderFrequency ?? 'monthly',
      }}
      saving={saving}
      error={error}
      onSave={(values) => void save(values)}
      onArchive={() => void archiveGoal()}
      onCancel={() => router.back()}
    />
  );
}
