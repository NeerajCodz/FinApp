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
type Profile = LocalRecord & { defaultCurrency?: string };
type Settings = LocalRecord & { currency?: string };
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
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? record.cloudId ?? '');

export default function GoalsPage() {
  const { userId, isConnected } = useBrowserSync();
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
  const { records: accounts, loading: accountsLoading } = useLocalRecords<Account>('account');
  const {
    records: profiles,
    loading: profilesLoading,
    error: profilesError,
  } = useLocalRecords<Profile>('profile');
  const {
    records: settings,
    loading: settingsLoading,
    error: settingsError,
  } = useLocalRecords<Settings>('settings');
  const [name, setName] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [currency, setCurrency] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const preferredCurrency =
    profiles[0]?.defaultCurrency ?? settings[0]?.currency ?? accounts[0]?.currency;
  React.useEffect(() => {
    if (!currency && preferredCurrency) setCurrency(preferredCurrency);
  }, [currency, preferredCurrency]);
  const selectedCurrency = currency || preferredCurrency || 'INR';
  const activeGoals = goals
    .filter((goal) => goal.archivedAt === undefined)
    .sort(
      (left, right) =>
        Number(Boolean(left.completedAt)) - Number(Boolean(right.completedAt)) ||
        (left.name ?? '').localeCompare(right.name ?? ''),
    );
  const goalRows = activeGoals.map((goal) => {
    const goalAliases = [goal.id, goal._id, goal.cloudId].filter(
      (value): value is string => typeof value === 'string',
    );
    const saved = contributions
      .filter((entry) => typeof entry.goalId === 'string' && goalAliases.includes(entry.goalId))
      .reduce((sum, entry) => sum + toMinor(entry.amountMinor), 0n);
    const goalCurrency = goal.currency ?? selectedCurrency;
    const targetMinor = toMinor(goal.targetAmountMinor);
    const percent = targetMinor > 0n ? Number((saved * 100n) / targetMinor) : 0;
    return { goal, saved, targetMinor, currency: goalCurrency, percent };
  });
  const currencies = new Set(goalRows.map((row) => row.currency));
  const totalSaved =
    currencies.size === 1 ? goalRows.reduce((sum, row) => sum + row.saved, 0n) : null;
  const loading =
    goalsLoading || contributionsLoading || accountsLoading || profilesLoading || settingsLoading;
  const loadError = goalsError ?? contributionsError ?? profilesError ?? settingsError;

  async function createGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const targetAmountMinor = parseMinor(target, selectedCurrency);
      if (targetAmountMinor <= 0n) throw new Error('Enter a positive target amount.');
      const date = targetDate ? new Date(`${targetDate}T12:00:00`).getTime() : undefined;
      if (date !== undefined && (!Number.isFinite(date) || date <= Date.now()))
        throw new Error('Choose a target date in the future.');
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: name.trim(),
        targetAmountMinor,
        currency: selectedCurrency,
        ...(date !== undefined ? { targetDate: date } : {}),
        createdAt: now,
        updatedAt: now,
      };
      await commitLocalWrite(userId, 'goal', 'goal.create', record, {
        name: name.trim(),
        targetAmountMinor,
        currency: selectedCurrency,
        ...(date !== undefined ? { targetDate: date } : {}),
      });
      setName('');
      setTarget('');
      setTargetDate('');
      setAdding(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this goal.');
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
            Contributions build progress without changing your account balance.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Badge variant="neutral">{activeGoals.length} active</Badge>
          {!adding ? (
            <Button type="button" variant="outline" onPress={() => setAdding(true)}>
              <Plus size={16} /> Add goal
            </Button>
          ) : (
            <Button type="button" variant="outline" onPress={() => setAdding(false)}>
              Cancel
            </Button>
          )}
        </div>
      </header>
      {(error || loadError) && (
        <p className="finance-form-error" role="alert">
          {error ?? `Saved goals could not be opened: ${loadError}`}
        </p>
      )}
      {!loading && !loadError && goalRows.length > 0 && (
        <Card className="finance-metric-card finance-balance-card">
          <span className="finance-metric-label">
            SAVED TOWARD {goalRows.length} {goalRows.length === 1 ? 'GOAL' : 'GOALS'}
          </span>
          <strong>
            {totalSaved !== null
              ? formatMinor(totalSaved, goalRows[0]?.currency ?? selectedCurrency)
              : `Across ${currencies.size} currencies`}
          </strong>
          <span className="finance-metric-foot">
            Contributions recorded separately from your account balance.
          </span>
        </Card>
      )}
      <div
        className="finance-accounts-layout"
        style={!adding ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}
      >
        <Card className="finance-record-panel">
          <SectionHeader title="Your goals" action={<span>{activeGoals.length} total</span>} />
          {loading ? (
            <p className="finance-muted" role="status">
              Opening your local goals…
            </p>
          ) : loadError ? (
            <p className="finance-form-error" role="alert">
              Saved goals could not be opened: {loadError}
            </p>
          ) : goalRows.length === 0 ? (
            <Empty
              title="No goals yet"
              description="Set a target and track each contribution in one place."
              icon={<Target size={20} />}
              action={
                !adding ? (
                  <Button type="button" size="sm" onPress={() => setAdding(true)}>
                    Create a goal
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="finance-plan-cards">
              {goalRows.map(({ goal, saved, targetMinor, currency: goalCurrency, percent }) => {
                const progress = Math.min(100, Math.max(0, percent));
                const id = idOf(goal);
                return (
                  <li className="finance-plan-card" key={id}>
                    <Link
                      href={`/goals/${encodeURIComponent(id)}`}
                      style={{
                        display: 'grid',
                        width: '100%',
                        gap: 10,
                        color: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      <div className="finance-budget-heading">
                        <span>
                          <strong>{goal.name ?? 'Savings goal'}</strong>
                          <small>
                            {percent >= 100
                              ? 'Target reached'
                              : goal.targetDate
                                ? `Target ${new Date(goal.targetDate).toLocaleDateString()}`
                                : 'No target date'}
                          </small>
                        </span>
                        <strong>{formatMinor(saved, goalCurrency)}</strong>
                      </div>
                      <div
                        className="finance-plan-track"
                        role="progressbar"
                        aria-label={`${goal.name ?? 'Goal'} progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <p className="finance-goal-total">
                        {percent}% of {formatMinor(targetMinor, goalCurrency)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {!isConnected && !loading && (
            <p className="finance-form-note">Offline · showing saved goals</p>
          )}
        </Card>
        {adding && (
          <Card className="finance-form-panel">
            <SectionHeader title="New goal" />
            <form className="finance-form" onSubmit={createGoal}>
              <FinanceInput
                label="Goal name"
                value={name}
                onChangeText={setName}
                placeholder="What are you saving for?"
                required
                maxLength={80}
              />
              <FinanceInput
                label={`Target amount · ${selectedCurrency}`}
                type="number"
                min="0.01"
                step={selectedCurrency === 'JPY' || selectedCurrency === 'KRW' ? '1' : '0.01'}
                value={target}
                onChangeText={setTarget}
                required
              />
              <Select
                label="Currency"
                options={[
                  ...new Set([
                    selectedCurrency,
                    ...accounts.map((account) => account.currency ?? 'INR'),
                    'INR',
                    'USD',
                    'EUR',
                    'GBP',
                  ]),
                ]}
                value={selectedCurrency}
                onChange={setCurrency}
              />
              <FinanceInput
                label="Target date"
                type="date"
                value={targetDate}
                onChangeText={setTargetDate}
              />
              {error && (
                <p className="finance-form-error" role="alert">
                  {error}
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Button type="button" variant="outline" onPress={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || loading || !name.trim() || !target.trim()}
                >
                  {saving ? 'Saving…' : 'Save goal'} <ArrowRight size={15} />
                </Button>
              </div>
              <p className="finance-form-note">
                Targets are saved locally first and sync when a connection is available.
              </p>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
