'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Target } from 'lucide-react';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { EntityIcon, EntityIconPicker, Money } from '@finapp/ui/finance';
import { Button, Empty, Input, Progress, Typography } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Goal = LocalRecord & {
  name?: string;
  targetAmountMinor?: bigint | number | string;
  currency?: string;
  targetDate?: number;
  completedAt?: number;
  archivedAt?: number;
  cloudId?: string;
  icon?: string;
  updatedAt?: number;
};
type Contribution = LocalRecord & {
  goalId?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
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
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function GoalDetailPage() {
  const { id: routeId } = useParams<{ id: string }>();
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
  const [amount, setAmount] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [iconSaving, setIconSaving] = React.useState(false);
  const [iconError, setIconError] = React.useState('');
  const goal = goals.find((entry) => aliases(entry).includes(routeId));
  const goalIds = goal ? aliases(goal) : [routeId];
  const goalLocalId = goal ? idOf(goal) : '';
  const goalId = goal ? String(goal._id ?? goal.cloudId ?? goal.id ?? '') : '';
  const history = contributions
    .filter((entry) => typeof entry.goalId === 'string' && goalIds.includes(entry.goalId))
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const saved = history.reduce((sum, entry) => sum + toMinor(entry.amountMinor), 0n);
  const target = toMinor(goal?.targetAmountMinor);
  const currency = goal?.currency ?? 'INR';
  const percent = target > 0n ? Number((saved * 100n) / target) : 0;
  const progress = Math.min(100, Math.max(0, percent));
  const remaining = target > saved ? target - saved : 0n;
  const targetDate = goal?.targetDate ? new Date(goal.targetDate) : null;
  const targetDateLabel =
    percent >= 100
      ? 'Target reached'
      : targetDate
        ? targetDate.getTime() < Date.now()
          ? `Target date passed · ${targetDate.toLocaleDateString()}`
          : `Target date · ${targetDate.toLocaleDateString()}`
        : 'No target date set';

  async function contribute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !goal || goal.archivedAt !== undefined || saving) return;
    setSaving(true);
    setError('');
    try {
      const amountMinor = parseMinor(amount, currency);
      if (amountMinor <= 0n) throw new Error('Enter a positive contribution amount.');
      const now = Date.now();
      const goalId = idOf(goal);
      const record: LocalRecord = {
        ownerId: userId,
        goalId,
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
        { goalId, amountMinor },
        { dependencies: goal.cloudId || goal._id ? [] : [`goal:${goalId}`] },
      );
      setAmount('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record this contribution.');
    } finally {
      setSaving(false);
    }
  }
  async function saveIcon(icon?: string) {
    if (!userId || !goal || iconSaving || !goalLocalId || !goalId) return;
    setIconSaving(true);
    setIconError('');
    try {
      await commitLocalWrite(
        userId,
        'goal',
        'goal.setIcon',
        { ...goal, icon: icon ?? undefined },
        { goalId, icon: icon ?? null },
        {
          recordId: goalLocalId,
          dependencies: goal._id || goal.cloudId ? [] : [`goal:${goalId}`],
          baseUpdatedAt: goal.updatedAt,
        },
      );
    } catch (cause) {
      setIconError(cause instanceof Error ? cause.message : 'Could not update this goal icon.');
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

  const loadError = goalsError ?? contributionsError;
  const loading = goalsLoading || contributionsLoading;
  return (
    <div className="finance-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link className="finance-secondary-action" href="/goals" aria-label="Go back">
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ margin: 0 }}>Goal</h1>
      </div>
      {loading ? (
        <Typography variant="small" role="status">
          Loading goal…
        </Typography>
      ) : loadError ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <Typography variant="small" role="alert">
            Saved goal details could not be loaded.
          </Typography>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : !goal || goal.archivedAt !== undefined ? (
        <Empty
          title="Goal unavailable"
          description="It may have been archived or is not saved on this device."
          icon={<Target size={20} />}
        />
      ) : (
        <>
          <section style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              aria-hidden="true"
              style={{
                display: 'grid',
                width: 44,
                height: 44,
                placeItems: 'center',
                borderRadius: 14,
                background: 'var(--finapp-surface-raised)',
              }}
            >
              <EntityIcon
                value={goal.icon ?? 'lucide:Target'}
                size={22}
                color="var(--finapp-primary)"
              />
            </span>
            <Typography variant="title" style={{ flex: 1 }}>
              {goal.name}
            </Typography>
            <EntityIconPicker
              mode="lucide"
              value={goal.icon}
              onChange={(icon) => void saveIcon(icon)}
              label="Change goal icon"
            />
          </section>
          {iconError && (
            <Typography variant="small" role="alert" style={{ color: 'var(--finapp-destructive)' }}>
              {iconError}
            </Typography>
          )}
          <section
            aria-label="Goal progress"
            style={{
              display: 'grid',
              gap: 10,
              padding: 20,
              borderRadius: 20,
              background: 'var(--finapp-surface-raised)',
            }}
          >
            <Typography variant="label">Saved so far</Typography>
            <Money amountMinor={saved} currency={currency} size="display" />
            <Typography variant="small">of {formatMinor(target, currency)} target</Typography>
            <Progress value={progress} />
            <div
              style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}
            >
              <Typography variant="caption">{percent}% reached</Typography>
              <Typography variant="caption">{targetDateLabel}</Typography>
            </div>
            {remaining > 0n && (
              <Typography variant="small">
                {formatMinor(remaining, currency)} left to reach your target
              </Typography>
            )}
          </section>
          <section
            style={{
              display: 'grid',
              gap: 12,
              paddingTop: 18,
              borderTop: '1px solid var(--finance-line)',
            }}
          >
            <Typography variant="heading">Record a contribution</Typography>
            <Typography variant="small">
              This tracks progress; it does not move money between accounts.
            </Typography>
            <form onSubmit={contribute} style={{ display: 'grid', gap: 12 }}>
              <Input
                aria-label={`Amount in ${currency}`}
                placeholder={`Amount · ${currency}`}
                inputMode="decimal"
                value={amount}
                onChangeText={setAmount}
                required
              />
              <Button type="submit" disabled={saving || !amount.trim()}>
                {saving ? 'Saving…' : 'Add contribution'}
              </Button>
            </form>
          </section>
          <section style={{ display: 'grid', gap: 10 }}>
            <Typography variant="heading">History</Typography>
            {history.length === 0 ? (
              <Typography variant="small">No contributions recorded yet.</Typography>
            ) : (
              history.map((entry) => (
                <div
                  key={idOf(entry)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBlock: 13,
                    borderBottom: '1px solid var(--finance-line)',
                  }}
                >
                  <Typography variant="small">
                    {new Date(Number(entry.occurredAt ?? 0)).toLocaleDateString()}
                  </Typography>
                  <Money amountMinor={toMinor(entry.amountMinor)} currency={currency} />
                </div>
              ))
            )}
          </section>
        </>
      )}
      {!!error && (
        <div role="alert" style={{ color: 'var(--finapp-destructive)' }}>
          <Typography variant="small">{error}</Typography>
        </div>
      )}
    </div>
  );
}
