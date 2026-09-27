'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronRight, Plus, Wallet } from 'lucide-react';
import { Button, IconButton, Input, Progress, Typography } from '@finapp/ui/web';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { Money } from '@finapp/ui/finance';

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
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const selectedCurrency = profiles[0]?.defaultCurrency ?? settings[0]?.currency ?? '';
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
    const goalCurrency = goal.currency ?? (selectedCurrency || 'INR');
    const targetMinor = toMinor(goal.targetAmountMinor);
    const percent = targetMinor > 0n ? Number((saved * 100n) / targetMinor) : 0;
    return { goal, saved, targetMinor, currency: goalCurrency, percent };
  });
  const currencies = new Set(goalRows.map((row) => row.currency));
  const totalSaved =
    currencies.size === 1 ? goalRows.reduce((sum, row) => sum + row.saved, 0n) : null;
  const loading = goalsLoading || contributionsLoading || profilesLoading || settingsLoading;
  const loadError = goalsError ?? contributionsError ?? profilesError ?? settingsError;

  async function createGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !selectedCurrency || !name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const targetAmountMinor = parseMinor(target, selectedCurrency);
      if (targetAmountMinor <= 0n) throw new Error('Enter a positive target amount.');
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: name.trim(),
        targetAmountMinor,
        currency: selectedCurrency,
        createdAt: now,
        updatedAt: now,
      };
      await commitLocalWrite(userId, 'goal', 'goal.create', record, {
        name: name.trim(),
        targetAmountMinor,
        currency: selectedCurrency,
      });
      setName('');
      setTarget('');
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
    <div className="finance-page" style={{ gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton
          label="Go back"
          variant="ghost"
          onPress={() => window.history.back()}
        >
          <ArrowLeft size={21} />
        </IconButton>
        <Typography variant="title" style={{ flex: 1 }}>
          Goals
        </Typography>
        {!loading && !adding && (
          <IconButton label="Add goal" variant="ghost" onPress={() => setAdding(true)}>
            <Plus size={21} />
          </IconButton>
        )}
      </header>
      {!loading && goalRows.length > 0 && (
        <section style={{ display: 'grid', gap: 8 }}>
          <Typography variant="label">
            Saved toward {goalRows.length} {goalRows.length === 1 ? 'goal' : 'goals'}
          </Typography>
          {totalSaved !== null ? (
            <Money
              amountMinor={totalSaved}
              currency={goalRows[0]?.currency ?? selectedCurrency}
              size="display"
            />
          ) : (
            <Typography variant="heading">Across {currencies.size} currencies</Typography>
          )}
          <Typography variant="small">
            Contributions recorded separately from your account balance.
          </Typography>
        </section>
      )}
      {loadError && (
        <div role="alert" style={{ display: 'grid', gap: 10 }}>
          <Typography variant="body">Saved goals could not be loaded.</Typography>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}
      {loading && !loadError && (
        <Typography variant="small" role="status">
          Loading saved goals…
        </Typography>
      )}
      {!loading && !loadError && goalRows.length === 0 && (
        <section
          style={{
            display: 'grid',
            flex: 1,
            minHeight: 300,
            alignContent: 'center',
            justifyItems: 'center',
            gap: 12,
            paddingInline: 24,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              display: 'grid',
              width: 76,
              height: 76,
              borderRadius: 24,
              background: 'var(--finapp-surface-raised)',
              color: 'var(--finapp-primary)',
              placeItems: 'center',
            }}
          >
            <Wallet size={32} />
          </span>
          <Typography variant="heading">No goals yet</Typography>
          <Typography variant="body" style={{ maxWidth: 280 }}>
            Set a target and track each contribution in one place.
          </Typography>
          {!adding && selectedCurrency && (
            <Button onPress={() => setAdding(true)}>Create a goal</Button>
          )}
          {!selectedCurrency && (
            <Typography variant="small">
              Choose a default currency in settings before creating a goal.
            </Typography>
          )}
          {!selectedCurrency && (
            <Button
              variant="outline"
              onPress={() => {
                window.location.href = '/settings/currency';
              }}
            >
              Set default currency
            </Button>
          )}
          {!isConnected && (
            <Typography variant="small">Offline · showing saved goals</Typography>
          )}
        </section>
      )}
      {!loading && goalRows.length > 0 && (
        <section style={{ display: 'grid', gap: 6 }}>
          <Typography variant="label">Your goals</Typography>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {goalRows.map(({ goal, saved, targetMinor, currency, percent }) => {
              const progress = Math.min(100, Math.max(0, percent));
              const id = idOf(goal);
              return (
                <li key={id}>
                  <Link
                    href={`/goals/${encodeURIComponent(id)}`}
                    aria-label={`${goal.name ?? 'Savings goal'}, ${percent}% of target saved`}
                    style={{
                      display: 'grid',
                      gap: 9,
                      paddingBlock: 16,
                      borderBottom: '1px solid var(--finapp-border-subtle)',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'grid', flex: 1, gap: 4 }}>
                        <Typography variant="bodyLarge">
                          {goal.name ?? 'Savings goal'}
                        </Typography>
                        <Typography variant="small">
                          {percent >= 100
                            ? 'Target reached'
                            : goal.targetDate
                              ? `Target ${new Date(goal.targetDate).toLocaleDateString()}`
                              : 'No target date'}
                        </Typography>
                      </span>
                      <Money amountMinor={saved} currency={currency} />
                      <ChevronRight size={17} />
                    </div>
                    <Progress value={progress} color="var(--finapp-primary)" />
                    <Typography variant="caption">
                      {percent}% of {formatMinor(targetMinor, currency)}
                    </Typography>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {adding && (
        <section
          style={{
            display: 'grid',
            gap: 14,
            paddingTop: 16,
            borderTop: '1px solid var(--finapp-border-subtle)',
          }}
        >
          <Typography variant="heading">New goal</Typography>
          <form onSubmit={createGoal} style={{ display: 'grid', gap: 14 }}>
            <Input
              aria-label="Goal name"
              placeholder="What are you saving for?"
              value={name}
              onChangeText={setName}
              required
            />
            <Input
              aria-label="Target amount"
              placeholder={`Target amount · ${selectedCurrency || 'Loading currency…'}`}
              type="number"
              inputMode="decimal"
              min="0.01"
              step={selectedCurrency === 'JPY' || selectedCurrency === 'KRW' ? '1' : '0.01'}
              value={target}
              onChangeText={setTarget}
              required
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                type="button"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => {
                  setAdding(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ flex: 1 }}
                disabled={
                  saving || loading || !selectedCurrency || !name.trim() || !target.trim()
                }
              >
                {saving ? 'Saving…' : 'Save goal'}
              </Button>
            </div>
          </form>
        </section>
      )}
      {!!error && (
        <div role="alert" style={{ color: 'var(--finapp-destructive)' }}>
          <Typography variant="small">{error}</Typography>
        </div>
      )}
    </div>
  );
}
