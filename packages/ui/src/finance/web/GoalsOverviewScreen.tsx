'use client';

import { ChevronRight, Plus, Wallet } from 'lucide-react';
import { Button, IconButton, Progress, Typography } from '@finapp/ui/web';
import { EntityIcon } from './EntityIconPicker';
import { Money } from './Money';

export type GoalOverviewItem = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  saved: bigint;
  target: bigint;
  currency: string;
  percent: number;
  targetDate?: number;
  completed: boolean;
};
export type GoalsOverviewScreenProps = {
  goals: readonly GoalOverviewItem[];
  totalSaved: bigint | null;
  currencyCount: number;
  loading: boolean;
  error?: boolean;
  connected: boolean;
  defaultCurrency?: string;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onRetry: () => void;
  onSetCurrency: () => void;
};

export function GoalsOverviewScreen({
  goals,
  totalSaved,
  currencyCount,
  loading,
  error,
  connected,
  defaultCurrency,
  onAdd,
  onOpen,
  onRetry,
  onSetCurrency,
}: GoalsOverviewScreenProps) {
  return (
    <div className="finance-page" style={{ gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Typography variant="title" style={{ flex: 1 }}>
          Goals
        </Typography>
        {!loading && defaultCurrency && (
          <IconButton label="Add goal" variant="ghost" onPress={onAdd}>
            <Plus size={21} />
          </IconButton>
        )}
      </header>
      {!loading && goals.length > 0 && (
        <section style={{ display: 'grid', gap: 8 }}>
          <Typography variant="label">
            Saved toward {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
          </Typography>
          {totalSaved !== null ? (
            <Money
              amountMinor={totalSaved}
              currency={goals[0]?.currency ?? defaultCurrency ?? 'INR'}
              size="display"
            />
          ) : (
            <Typography variant="heading">Across {currencyCount} currencies</Typography>
          )}
          <Typography variant="small">
            Contributions are recorded separately from account balances.
          </Typography>
        </section>
      )}
      {error && (
        <div role="alert" style={{ display: 'grid', gap: 10 }}>
          <Typography variant="body">Saved goals could not be loaded.</Typography>
          <Button variant="outline" onPress={onRetry}>
            Retry
          </Button>
        </div>
      )}
      {loading && !error && (
        <Typography variant="small" role="status">
          Loading saved goals…
        </Typography>
      )}
      {!loading && !error && goals.length === 0 && (
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
          {defaultCurrency ? (
            <Button onPress={onAdd}>Create a goal</Button>
          ) : (
            <>
              <Typography variant="small">
                Choose a default currency before creating a goal.
              </Typography>
              <Button variant="outline" onPress={onSetCurrency}>
                Set default currency
              </Button>
            </>
          )}
          {!connected && <Typography variant="small">Offline · showing saved goals</Typography>}
        </section>
      )}
      {!loading && !error && goals.length > 0 && (
        <section style={{ display: 'grid', gap: 6 }}>
          <Typography variant="label">Your goals</Typography>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {goals.map((goal) => {
              const dateLabel =
                goal.percent >= 100
                  ? 'Target reached'
                  : goal.targetDate
                    ? goal.targetDate < Date.now()
                      ? `Target date passed · ${new Date(goal.targetDate).toLocaleDateString()}`
                      : `Target · ${new Date(goal.targetDate).toLocaleDateString()}`
                    : 'No target date';
              return (
                <li key={goal.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(goal.id)}
                    aria-label={`${goal.name}, ${goal.percent}% of target saved`}
                    style={{
                      display: 'grid',
                      width: '100%',
                      gap: 12,
                      padding: '18px 0',
                      border: 0,
                      borderBottom: '1px solid var(--finapp-border-subtle)',
                      background: 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          display: 'grid',
                          width: 48,
                          height: 48,
                          flex: '0 0 auto',
                          placeItems: 'center',
                          borderRadius: 16,
                          background: goal.color ?? 'var(--finapp-surface-raised)',
                          color: 'var(--finapp-primary)',
                        }}
                      >
                        <EntityIcon value={goal.icon ?? 'lucide:Target'} size={22} />
                      </span>
                      <span style={{ display: 'grid', flex: 1, minWidth: 0, gap: 4 }}>
                        <Typography variant="bodyLarge">{goal.name}</Typography>
                        <Typography variant="small">{dateLabel}</Typography>
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <Money amountMinor={goal.saved} currency={goal.currency} />
                        <Typography variant="caption"> saved</Typography>
                      </span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </span>
                    <Progress
                      value={Math.min(100, Math.max(0, goal.percent))}
                      color={goal.color ?? 'var(--finapp-primary)'}
                    />
                    <Typography variant="caption">
                      {goal.percent}% of{' '}
                      <Money amountMinor={goal.target} currency={goal.currency} />
                    </Typography>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
