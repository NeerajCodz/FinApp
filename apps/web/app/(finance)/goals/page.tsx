'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Target } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader, Select } from '@finapp/ui/web';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';

type Account = LocalRecord & { currency?: string; archivedAt?: number };
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
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function GoalsPage() {
  const { userId } = useBrowserSync();
  const { records: goals, loading } = useLocalRecords<Goal>('goal');
  const { records: contributions } = useLocalRecords<Contribution>('goalContribution');
  const { records: accounts } = useLocalRecords<Account>('account');
  const [name, setName] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [currency, setCurrency] = React.useState('INR');
  const [targetDate, setTargetDate] = React.useState('');
  const [selectedGoalId, setSelectedGoalId] = React.useState('');
  const [contributionAmount, setContributionAmount] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const activeGoals = goals.filter((goal) => goal.archivedAt === undefined);

  React.useEffect(() => {
    if (!currency && accounts[0]?.currency) setCurrency(accounts[0].currency);
  }, [accounts, currency]);
  React.useEffect(() => {
    if (!selectedGoalId && activeGoals[0]) setSelectedGoalId(idOf(activeGoals[0]));
  }, [activeGoals, selectedGoalId]);

  async function createGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError('Sign in while online before creating a goal.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const targetAmountMinor = parseMinor(target, currency);
      const date = targetDate ? new Date(`${targetDate}T12:00:00`).getTime() : undefined;
      if (date !== undefined && date <= Date.now()) throw new Error('INVALID_GOAL_DATE');
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: name.trim(),
        targetAmountMinor,
        currency,
        ...(date !== undefined ? { targetDate: date } : {}),
        createdAt: now,
        updatedAt: now,
      };
      await commitLocalWrite(userId, 'goal', 'goal.create', record, {
        name: name.trim(),
        targetAmountMinor,
        currency,
        ...(date !== undefined ? { targetDate: date } : {}),
      });
      setName('');
      setTarget('');
      setTargetDate('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this goal.');
    } finally {
      setSaving(false);
    }
  }

  async function contribute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError('Sign in while online before adding a contribution.');
      return;
    }
    const goal = activeGoals.find((entry) => idOf(entry) === selectedGoalId);
    if (!goal) {
      setError('Choose an active goal.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amountMinor = parseMinor(contributionAmount, goal.currency ?? currency);
      const now = Date.now();
      const record: LocalRecord = {
        goalId: selectedGoalId,
        ownerId: userId,
        amountMinor,
        currency: goal.currency ?? currency,
        occurredAt: now,
        createdAt: now,
      };
      const dependency = goal.cloudId || goal._id ? [] : [`goal:${selectedGoalId}`];
      await commitLocalWrite(
        userId,
        'goalContribution',
        'goal.contribute',
        record,
        {
          goalId: selectedGoalId,
          amountMinor,
        },
        { dependencies: dependency },
      );
      setContributionAmount('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this contribution.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">GOALS</p>
        <h1>Give future-you a head start.</h1>
        <p>
          Sign in once while connected to keep your goals available in this browser, even offline.
        </p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">A FUTURE YOU CAN SEE</p>
          <h1>Goals</h1>
          <p className="finance-muted">
            Small contributions count. Every update is saved locally first.
          </p>
        </div>
        <Badge variant="neutral">{activeGoals.length} active</Badge>
      </header>
      {error && (
        <p className="finance-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="finance-accounts-layout">
        <Card className="finance-record-panel">
          <SectionHeader title="Your goals" action={<span>{activeGoals.length} total</span>} />
          {loading ? (
            <p className="finance-muted">Opening your local goals…</p>
          ) : activeGoals.length === 0 ? (
            <Empty
              title="Make a little room for something good"
              description="Set a target and contribute whenever it feels right."
              icon={<Target size={20} />}
            />
          ) : (
            <ul className="finance-plan-cards">
              {activeGoals.map((goal) => {
                const contributed = contributions
                  .filter((entry) => entry.goalId === idOf(goal))
                  .reduce((sum, entry) => sum + toMinor(entry.amountMinor), 0n);
                const targetMinor = toMinor(goal.targetAmountMinor);
                const progress =
                  targetMinor > 0n ? Math.min(100, Number((contributed * 100n) / targetMinor)) : 0;
                return (
                  <li className="finance-plan-card" key={idOf(goal)}>
                    <div className="finance-budget-heading">
                      <span>
                        <Link href={`/goal/${encodeURIComponent(idOf(goal))}`}>
                          {goal.name ?? 'Savings goal'}
                        </Link>
                        <small>
                          {goal.targetDate
                            ? `Target ${new Date(goal.targetDate).toLocaleDateString('en', { month: 'short', year: 'numeric' })}`
                            : 'No target date'}
                        </small>
                      </span>
                      <strong>{progress}%</strong>
                    </div>
                    <div className="finance-plan-track">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <p className="finance-goal-total">
                      {formatMinor(contributed, goal.currency ?? 'INR')}{' '}
                      <span>of {formatMinor(targetMinor, goal.currency ?? 'INR')}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          {activeGoals.length > 0 && (
            <form className="finance-form finance-contribution-form" onSubmit={contribute}>
              <SectionHeader title="Add a contribution" />
              <label className="finance-form-field">
                <span>Goal</span>
                <select
                  value={selectedGoalId}
                  onChange={(event) => setSelectedGoalId(event.currentTarget.value)}
                >
                  {activeGoals.map((goal) => (
                    <option key={idOf(goal)} value={idOf(goal)}>
                      {goal.name ?? 'Goal'}
                    </option>
                  ))}
                </select>
              </label>
              <FinanceInput
                label="Contribution amount"
                type="number"
                min="0.01"
                step="0.01"
                value={contributionAmount}
                onChangeText={setContributionAmount}
                required
              />

              <Button type="submit" disabled={saving || !contributionAmount}>
                {saving ? 'Saving locally…' : 'Add contribution'} <ArrowRight size={15} />
              </Button>
            </form>
          )}
        </Card>
        <Card className="finance-form-panel">
          <SectionHeader title="Start a new goal" action={<Plus size={17} />} />
          <form className="finance-form" onSubmit={createGoal}>
            <FinanceInput
              label="Goal name"
              value={name}
              onChangeText={setName}
              placeholder="A weekend away"
              required
              maxLength={80}
            />
            <FinanceInput
              label={`Target amount (${currency})`}
              type="number"
              min="0.01"
              step="0.01"
              value={target}
              onChangeText={setTarget}
              required
            />
            <Select
              label="Currency"
              options={[
                ...new Set([
                  ...accounts.map((account) => account.currency ?? 'INR'),
                  'INR',
                  'USD',
                  'EUR',
                  'GBP',
                ]),
              ]}
              value={currency}
              onChange={setCurrency}
            />
            <FinanceInput
              label="Target date"
              type="date"
              value={targetDate}
              onChangeText={setTargetDate}
            />

            <Button type="submit" disabled={saving || !name.trim() || !target}>
              {saving ? 'Saving locally…' : 'Save goal'} <ArrowRight size={15} />
            </Button>
            <p className="finance-form-note">
              Targets live on this device and sync automatically when you reconnect.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
