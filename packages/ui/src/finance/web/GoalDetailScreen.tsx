'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ChartNoAxesCombined, Pencil } from 'lucide-react';
import { Button, Empty, Input, Progress, Typography } from '@finapp/ui/web';
import { EntityIcon, EntityIconPicker } from './EntityIconPicker';
import { Money } from './Money';
import type { GoalOverviewItem } from './GoalsOverviewScreen';

export type GoalHistoryItem = { id: string; occurredAt: number; amount: bigint };
export type GoalDetailScreenProps = {
  goal: GoalOverviewItem;
  available: boolean;
  history: readonly GoalHistoryItem[];
  loading: boolean;
  error?: string;
  actionError?: string;
  saving: boolean;
  onContribute: (amount: string) => void;
  onIconChange: (icon?: string) => void;
  onEdit: () => void;
  onAnalytics: () => void;
  onRetry: () => void;
};

export function GoalDetailScreen({
  goal,
  available,
  history,
  loading,
  error,
  actionError,
  saving,
  onContribute,
  onIconChange,
  onEdit,
  onAnalytics,
  onRetry,
}: GoalDetailScreenProps) {
  const [amount, setAmount] = React.useState('');
  let dateLabel = 'No target date set';
  if (goal.percent >= 100) dateLabel = 'Target reached';
  else if (goal.targetDate)
    dateLabel =
      goal.targetDate < Date.now()
        ? `Target date passed · ${new Date(goal.targetDate).toLocaleDateString()}`
        : `Target date · ${new Date(goal.targetDate).toLocaleDateString()}`;
  return (
    <div className="finance-page" style={{ gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link className="finance-secondary-action" href="/goals" aria-label="Back to goals">
          <ArrowLeft size={20} />
        </Link>
        <Typography variant="title" style={{ flex: 1 }}>
          {goal.name}
        </Typography>
        {available && (
          <>
            <Button variant="outline" onPress={onAnalytics}>
              <ChartNoAxesCombined size={16} /> Analytics
            </Button>
            <Button variant="outline" onPress={onEdit}>
              <Pencil size={16} /> Edit
            </Button>
          </>
        )}
      </header>
      {loading ? (
        <Typography variant="small" role="status">
          Loading goal…
        </Typography>
      ) : error ? (
        <div role="alert" style={{ display: 'grid', gap: 10 }}>
          <Typography variant="small">{error}</Typography>
          <Button variant="outline" onPress={onRetry}>
            Retry
          </Button>
        </div>
      ) : !available ? (
        <Empty
          title="Goal unavailable"
          description="It may have been archived or is not saved on this device."
        />
      ) : (
        <>
          {actionError && (
            <Typography variant="small" role="alert" style={{ color: 'var(--finapp-destructive)' }}>
              {actionError}
            </Typography>
          )}
          <section style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                display: 'grid',
                width: 48,
                height: 48,
                placeItems: 'center',
                borderRadius: 14,
                background: goal.color ?? 'var(--finapp-surface-raised)',
              }}
            >
              <EntityIcon
                value={goal.icon ?? 'lucide:Target'}
                size={22}
                color="var(--finapp-primary)"
              />
            </span>
            <div style={{ flex: 1 }}>
              <Typography variant="heading">{goal.name}</Typography>
              <Typography variant="small">{dateLabel}</Typography>
            </div>
            <EntityIconPicker
              mode="all"
              value={goal.icon}
              onChange={onIconChange}
              label="Change goal icon"
            />
          </section>
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
            <Money amountMinor={goal.saved} currency={goal.currency} size="display" />
            <Typography variant="small">
              of <Money amountMinor={goal.target} currency={goal.currency} /> target
            </Typography>
            <Progress
              value={Math.min(100, Math.max(0, goal.percent))}
              color={goal.color ?? 'var(--finapp-primary)'}
            />
            <div
              style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}
            >
              <Typography variant="caption">{goal.percent}% reached</Typography>
              <Typography variant="caption">{dateLabel}</Typography>
            </div>
            {goal.target > goal.saved && (
              <Typography variant="small">
                <Money amountMinor={goal.target - goal.saved} currency={goal.currency} /> left to
                reach your target
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
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onContribute(amount);
              }}
              style={{ display: 'grid', gap: 12 }}
            >
              <Input
                aria-label={`Amount in ${goal.currency}`}
                placeholder={`Amount · ${goal.currency}`}
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
            <Typography variant="heading">Contribution history</Typography>
            {history.length === 0 ? (
              <Empty
                title="No contributions yet"
                description="Your saved contributions will appear here."
              />
            ) : (
              history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBlock: 13,
                    borderBottom: '1px solid var(--finance-line)',
                  }}
                >
                  <Typography variant="small">
                    {new Date(entry.occurredAt).toLocaleDateString()}
                  </Typography>
                  <Money amountMinor={entry.amount} currency={goal.currency} />
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
