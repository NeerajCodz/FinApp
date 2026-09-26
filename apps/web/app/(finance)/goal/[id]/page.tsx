'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Target } from 'lucide-react';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { FinanceInput } from '@/components/finance/FinanceInput';
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
  const goal = goals.find((entry) => aliases(entry).includes(routeId));
  const goalIds = goal ? aliases(goal) : [routeId];
  const history = contributions
    .filter((entry) => typeof entry.goalId === 'string' && goalIds.includes(entry.goalId))
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const saved = history.reduce((sum, entry) => sum + toMinor(entry.amountMinor), 0n);
  const target = toMinor(goal?.targetAmountMinor);
  const currency = goal?.currency ?? 'INR';
  const percent = target > 0n ? Math.min(100, Number((saved * 100n) / target)) : 0;

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
      <Link className="finance-secondary-action" href="/goals">
        <ArrowLeft size={15} /> Back to goals
      </Link>
      {loading ? (
        <p className="finance-muted" role="status">
          Opening this saved goal…
        </p>
      ) : loadError ? (
        <p className="finance-form-error" role="alert">
          Saved goal details could not be opened: {loadError}
        </p>
      ) : !goal || goal.archivedAt !== undefined ? (
        <Empty
          title="Goal unavailable"
          description="This goal is not saved on this device or has been archived."
          icon={<Target size={20} />}
          action={
            <Link className="finance-inline-link" href="/goals">
              Return to goals
            </Link>
          }
        />
      ) : (
        <>
          <header className="finance-page-heading">
            <div>
              <p className="finance-kicker">SAVINGS GOAL</p>
              <h1>{goal.name ?? 'Savings goal'}</h1>
              <p className="finance-muted">
                {goal.targetDate
                  ? `Target ${new Date(goal.targetDate).toLocaleDateString()}`
                  : 'No target date'}
              </p>
            </div>
            <span className="finance-goal-total">{percent}% reached</span>
          </header>
          <Card className="finance-metric-card">
            <SectionHeader title="Saved so far" action={<Target size={18} aria-hidden="true" />} />
            <strong>{formatMinor(saved, currency)}</strong>
            <span className="finance-metric-foot">of {formatMinor(target, currency)} target</span>
            <div className="finance-plan-track" aria-label={`${percent}% of goal reached`}>
              <span style={{ width: `${percent}%` }} />
            </div>
          </Card>
          <Card className="finance-form-panel">
            <SectionHeader title="Record a contribution" />
            <p className="finance-muted">
              This tracks progress; it does not move money between accounts.
            </p>
            <form className="finance-form" onSubmit={contribute}>
              <FinanceInput
                label={`Contribution amount · ${currency}`}
                value={amount}
                onChangeText={setAmount}
                inputMode="decimal"
                required
              />
              {error && (
                <p className="finance-form-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={saving || !amount.trim()}>
                {saving ? 'Saving locally…' : 'Add contribution'} <ArrowRight size={15} />
              </Button>
            </form>
          </Card>
          <Card className="finance-record-panel">
            <SectionHeader
              title="Contribution history"
              action={<span>{history.length} entries</span>}
            />
            {history.length === 0 ? (
              <p className="finance-muted">No contributions recorded yet.</p>
            ) : (
              <ul className="finance-record-list">
                {history.map((entry) => (
                  <li key={idOf(entry)}>
                    <span className="finance-record-copy">
                      <strong>
                        {new Date(Number(entry.occurredAt ?? 0)).toLocaleDateString()}
                      </strong>
                      <small>Saved locally first</small>
                    </span>
                    <strong>{formatMinor(toMinor(entry.amountMinor), currency)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
