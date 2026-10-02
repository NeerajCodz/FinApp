'use client';
import React from 'react';
import { Plus, ChevronRight, Calendar, Trophy } from 'lucide-react';
import { Button, CustomSelect } from '@finapp/ui/web';
import { EntityIcon } from './EntityIconPicker';
import { formatMinor } from '../money';
import { formatTransactionDate } from '../datetime';
import { Bar, Ring, Legend, Metrics, Panel } from './GoalsBudgetsParts';
import s from './GoalsBudgets.module.css';
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
  monthlyContributionMinor?: bigint;
  goalType?: string;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  accountId?: string;
  reminderFrequency?: 'none' | 'weekly' | 'monthly';
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
  onAnalytics?: () => void;
};
export function GoalsOverviewScreen(p: GoalsOverviewScreenProps) {
  const [filter, setFilter] = React.useState('active');
  const [sort, setSort] = React.useState('progress');
  const currency = p.goals[0]?.currency ?? p.defaultCurrency ?? 'INR';
  const same = p.currencyCount <= 1;
  const targets = p.goals.reduce((n, g) => n + g.target, 0n);
  const visible = p.goals
    .filter((g) => filter === 'all' || (filter === 'completed' ? g.completed : !g.completed))
    .slice()
    .sort((a, b) =>
      sort === 'date'
        ? (a.targetDate ?? Infinity) - (b.targetDate ?? Infinity)
        : b.percent - a.percent,
    );
  const upcoming = p.goals.filter((g) => !g.completed && (g.monthlyContributionMinor ?? 0n) > 0n);
  return (
    <div className={s.page}>
      <header className={`${s.header} ${s.goalsHeader}`}>
        <div>
          <h1 className={s.heading}>Goals</h1>
          <p className={s.subtitle}>Track savings, targets, and progress for every goal.</p>
        </div>
        <div className={s.actions + ' ' + s.goalsActions}>
          {p.onAnalytics && (
            <Button variant="outline" onPress={p.onAnalytics}>
              Goal analytics
            </Button>
          )}
          <CustomSelect
            aria-label="Goal status"
            className={s.goalStatusSelect}
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
          >
            <option value="active">Active goals</option>
            <option value="all">All goals</option>
            <option value="completed">Achieved goals</option>
          </CustomSelect>
          <Button onPress={p.defaultCurrency ? p.onAdd : p.onSetCurrency}>
            <Plus size={16} /> {p.defaultCurrency ? 'Add goal' : 'Set default currency'}
          </Button>
        </div>
      </header>
      {p.loading ? (
        <Panel title="Your goals">
          <p role="status">Loading saved goals…</p>
        </Panel>
      ) : p.error ? (
        <Panel title="Goals unavailable">
          <p role="alert">Saved goals could not be loaded.</p>
          <Button onPress={p.onRetry}>Retry</Button>
        </Panel>
      ) : !p.goals.length ? (
        <section className={s.emptyGoals} aria-labelledby="goals-empty-title">
          <svg className={s.goalEmptyIllustration} viewBox="0 0 240 180" aria-hidden="true">
            <circle cx="120" cy="77" r="61" fill="var(--finapp-surface-raised)" />
            <circle
              cx="120"
              cy="77"
              r="41"
              fill="none"
              stroke="var(--finapp-border)"
              strokeWidth="2"
            />
            <circle
              cx="120"
              cy="77"
              r="27"
              fill="none"
              stroke="var(--finapp-primary)"
              strokeWidth="3"
            />
            <circle cx="120" cy="77" r="11" fill="var(--finapp-primary)" opacity=".28" />
            <circle cx="120" cy="77" r="4" fill="var(--finapp-primary)" />
            <path
              d="m153 42-30 30m20-36 16 16-7 2-2 7-16-16"
              fill="none"
              stroke="var(--finapp-foreground)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            <path
              d="M52 136h136"
              stroke="var(--finapp-border)"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <rect
              x="63"
              y="119"
              width="45"
              height="17"
              rx="8.5"
              fill="var(--finapp-card)"
              stroke="var(--finapp-border)"
              strokeWidth="2"
            />
            <path
              d="M75 128h21"
              stroke="var(--finapp-primary)"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <rect
              x="132"
              y="111"
              width="45"
              height="25"
              rx="12.5"
              fill="var(--finapp-card)"
              stroke="var(--finapp-border)"
              strokeWidth="2"
            />
            <path
              d="M145 124h19"
              stroke="var(--finapp-primary)"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
          <h2 id="goals-empty-title">No goals</h2>
          <p>
            What are you looking forward to? Set a target and build progress one contribution at a
            time.
          </p>
        </section>
      ) : (
        <>
          <Metrics
            items={[
              {
                label: 'Total saved',
                value:
                  p.totalSaved !== null
                    ? formatMinor(p.totalSaved, currency)
                    : `${p.currencyCount} currencies`,
                detail: 'Recorded contributions',
              },
              {
                label: 'Goal targets',
                value: same ? formatMinor(targets, currency) : 'Multiple currencies',
                detail: 'Across all saved goals',
              },
              {
                label: 'Active goals',
                value: p.goals.filter((g) => !g.completed).length,
                detail: 'Savings in progress',
              },
              {
                label: 'Achieved goals',
                value: p.goals.filter((g) => g.completed).length,
                detail: 'Targets reached',
              },
            ]}
          />
          <div className={s.overview}>
            <Panel
              title={`Your Goals (${visible.length})`}
              action={
                <CustomSelect
                  aria-label="Sort goals"
                  className={s.goalSortSelect}
                  value={sort}
                  onChange={(event) => setSort(event.currentTarget.value)}
                >
                  <option value="progress">Sort by: Progress</option>
                  <option value="date">Sort by: Target date</option>
                </CustomSelect>
              }
            >
              <div className={s.list}>
                {visible.map((g) => (
                  <article key={g.id} className={s.goalCard}>
                    <span
                      className={`${s.tile} ${s.heroTile}`}
                      style={{ '--tile': g.color } as React.CSSProperties}
                    >
                      <EntityIcon value={g.icon ?? 'lucide:Target'} size={30} />
                    </span>
                    <div>
                      <div className={s.between}>
                        <h3>{g.name}</h3>
                        <span
                          className={`${s.badge} ${g.completed ? s.positive : g.targetDate && g.targetDate < Date.now() ? s.warning : s.positive}`}
                        >
                          {g.completed
                            ? 'Achieved'
                            : g.targetDate && g.targetDate < Date.now()
                              ? 'Past target date'
                              : 'Active'}
                        </span>
                      </div>
                      <span className={s.muted}>{g.notes ?? g.goalType ?? 'Savings goal'}</span>
                      <div className={s.goalMeta}>
                        <span>
                          <Calendar size={14} />{' '}
                          {formatMinor(g.target > g.saved ? g.target - g.saved : 0n, g.currency)}
                          <br />
                          <span className={s.muted}>Remaining</span>
                        </span>
                        {g.monthlyContributionMinor !== undefined && (
                          <span>
                            {formatMinor(g.monthlyContributionMinor, g.currency)}
                            <br />
                            <span className={s.muted}>Monthly contribution</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className={`${s.between} ${s.muted}`}>
                        <span>
                          <strong>{formatMinor(g.saved, g.currency)}</strong> /{' '}
                          {formatMinor(g.target, g.currency)}
                        </span>
                        <span>
                          {g.targetDate
                            ? `Due ${formatTransactionDate(g.targetDate, false, 'UTC')}`
                            : 'No target date'}
                        </span>
                      </div>
                      <Bar value={g.percent} />
                      <div className={s.between}>
                        <span className={s.muted}>{g.percent}%</span>
                        <Button variant="outline" onPress={() => p.onOpen(g.id)}>
                          View goal <ChevronRight size={14} />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
                {!visible.length && <p className={s.muted}>No goals in this view.</p>}
              </div>
            </Panel>
            <aside className={s.stack}>
              <Panel title="Goal progress">
                {same ? (
                  <div className={s.ringLayout}>
                    <Ring
                      segments={p.goals.map((g) => ({ amount: g.saved, color: g.color }))}
                      value={formatMinor(p.totalSaved ?? 0n, currency)}
                      label="Total saved"
                      detail={`${targets > 0n ? Number(((p.totalSaved ?? 0n) * 100n) / targets) : 0}% of target`}
                    />
                    <Legend
                      rows={p.goals.map((g) => ({ name: g.name, amount: g.saved, color: g.color }))}
                      currency={currency}
                    />
                  </div>
                ) : (
                  <p className={s.muted}>Totals stay separate across currencies.</p>
                )}
              </Panel>
              <Panel
                title="Planned contributions"
                description="Monthly amounts you have chosen; transfers are not automatic."
              >
                {upcoming.length ? (
                  upcoming.map((g) => (
                    <div key={g.id} className={s.row}>
                      <span className={s.tile}>
                        <EntityIcon value={g.icon ?? 'lucide:Target'} size={20} />
                      </span>
                      <span className={s.grow}>
                        {g.name}
                        <br />
                        <span className={s.muted}>
                          {g.reminderFrequency ?? 'No reminder'} reminder
                        </span>
                      </span>
                      <strong>{formatMinor(g.monthlyContributionMinor!, g.currency)}</strong>
                    </div>
                  ))
                ) : (
                  <p className={s.muted}>Set a monthly contribution when editing a goal.</p>
                )}
              </Panel>
              <Panel title="Recent milestones">
                {p.goals
                  .filter((g) => g.percent >= 25)
                  .map((g) => (
                    <div key={g.id} className={s.row}>
                      <Trophy size={23} className={s.warning} />
                      <span className={s.grow}>
                        Reached {Math.min(100, Math.floor(g.percent / 25) * 25)}% of {g.name}
                      </span>
                      <span className={s.positive}>{formatMinor(g.saved, g.currency)}</span>
                    </div>
                  ))}
                {!p.goals.some((g) => g.percent >= 25) && (
                  <p className={s.muted}>Your first milestone starts at 25%.</p>
                )}
              </Panel>
            </aside>
          </div>
        </>
      )}
      {!p.connected && <p className={s.muted}>Offline · showing saved goals</p>}
    </div>
  );
}
