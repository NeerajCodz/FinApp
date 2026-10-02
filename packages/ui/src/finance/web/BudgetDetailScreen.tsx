'use client';
import Link from 'next/link';
import { Button } from '@finapp/ui/web';
import { CategoryIcon } from './CategoryIcon';
import { formatMinor } from '../money';
import {
  budgetDashboard,
  type BudgetSettings,
  type BudgetDashboardTransaction,
} from '../budgetDashboard';
import { Panel, Metrics, Bar, Bars, Ring, Legend } from './GoalsBudgetsParts';
import { BudgetTable } from './BudgetDashboardParts';
import s from './GoalsBudgets.module.css';
export type BudgetDetailItem = {
  id: string;
  title: string;
  date: string;
  amountMinor: bigint;
  currency: string;
  occurredAt?: number;
  merchant?: string;
  accountId?: string;
  accountName?: string;
  categoryName?: string;
};
export type BudgetDetailScreenProps = {
  name: string;
  category: string;
  icon?: string;
  currency: string;
  limit: bigint;
  spent: bigint;
  transactions: readonly BudgetDetailItem[];
  allTransactions?: readonly BudgetDashboardTransaction[];
  startAt?: number;
  endAt?: number;
  settings?: BudgetSettings;
  accounts?: readonly { id: string; name: string }[];
  loading?: boolean;
  error?: string | null;
  actionError?: string | null;
  pending?: boolean;
  onEdit: () => void;
  onAnalytics: () => void;
  onArchive: () => void;
  onOpenTransaction: (id: string) => void;
  onAddExpense?: () => void;
};
export function BudgetDetailScreen(p: BudgetDetailScreenProps) {
  const start = p.startAt ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const end = p.endAt ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime();
  const model = budgetDashboard(
    p.allTransactions ??
      p.transactions
        .filter((r) => r.occurredAt !== undefined)
        .map((r) => ({ ...r, occurredAt: r.occurredAt! })),
    start,
    end,
    p.limit,
  );
  const ratio = p.limit > 0n ? Number((p.spent * 10000n) / p.limit) / 100 : 0;
  const remaining = p.limit - p.spent;
  return (
    <div className={s.page}>
      <Link className={s.back} href="/budgets">
        ‹ Budgets › {p.name}
      </Link>
      <header className={s.header}>
        <div className={s.actions}>
          <span className={`${s.tile} ${s.heroTile}`}>
            <CategoryIcon label={p.category} icon={p.icon} />
          </span>
          <div>
            <h1 className={s.heading}>{p.name}</h1>
            <p className={s.subtitle}>Manage your {p.category.toLowerCase()} expenses.</p>
          </div>
        </div>
        <div className={s.actions}>
          <Button variant="outline" onPress={p.onEdit}>
            Edit
          </Button>
          {p.onAddExpense && <Button onPress={p.onAddExpense}>＋ Add expense</Button>}
          <Button variant="outline" onPress={p.onAnalytics}>
            Analytics
          </Button>
          <Button variant="outline" disabled={p.pending} onPress={p.onArchive}>
            {p.pending ? 'Archiving…' : 'Archive budget'}
          </Button>
        </div>
      </header>
      <Metrics
        items={[
          {
            label: 'Period limit',
            value: formatMinor(p.limit, p.currency),
            detail: new Date(start).toLocaleDateString(undefined, {
              month: 'short',
              year: 'numeric',
            }),
          },
          {
            label: 'Spent so far',
            value: formatMinor(p.spent, p.currency),
            detail: `${Math.round(ratio)}% of limit`,
            tone: 'var(--finapp-destructive)',
          },
          {
            label: 'Remaining',
            value: formatMinor(remaining, p.currency),
            detail:
              remaining < 0n ? 'Over your limit' : `${Math.max(0, 100 - Math.round(ratio))}% left`,
          },
          {
            label: 'Daily average',
            value: formatMinor(model.average, p.currency),
            detail: 'Per elapsed day',
          },
          {
            label: 'Forecasted spend',
            value: formatMinor(model.forecast, p.currency),
            detail: 'At current daily pace',
          },
          {
            label: 'Status',
            value: ratio >= 100 ? 'Over budget' : model.forecast > p.limit ? 'At risk' : 'On track',
            detail: 'Based on posted expenses',
          },
        ]}
      />
      <div className={s.two}>
        <Panel
          title="Budget progress"
          description={`${new Date(start).toLocaleDateString()} – ${new Date(end - 1).toLocaleDateString()}`}
          action={<span className={s.muted}>{model.daysLeft} days left</span>}
        >
          <Bar value={ratio} large tone={ratio >= 100 ? 'var(--finapp-destructive)' : undefined} />
          <div className={s.between}>
            <strong>{formatMinor(p.spent, p.currency)} spent</strong>
            <span>
              {formatMinor(p.limit, p.currency)} limit · {Math.round(ratio)}%
            </span>
          </div>
          <div className={s.insight}>
            <span>
              <strong className={ratio >= 100 ? s.negative : s.positive}>
                {ratio >= 100
                  ? 'You are over budget'
                  : model.forecast > p.limit
                    ? 'Review your spending pace'
                    : 'You’re on track'}
              </strong>
              <br />
              <span className={s.muted}>
                At your current pace, projected spending is{' '}
                {formatMinor(model.forecast, p.currency)} for this period.
              </span>
            </span>
          </div>
        </Panel>
        <Panel title="Budget details">
          {[
            ['Category', p.category],
            [
              'Applies to',
              p.settings?.accountIds?.length
                ? p.settings.accountIds
                    .map(
                      (id) => p.accounts?.find((a) => a.id === id)?.name ?? 'Unavailable account',
                    )
                    .join(', ')
                : 'All accounts',
            ],
            ['Rollover', 'No rollover; this budget has explicit dates'],
            ['Notes', p.settings?.notes ?? 'No notes'],
            ['Alerts', `${p.settings?.alertThreshold ?? 80}% of limit`],
            ['Include in analytics', p.settings?.includeInAnalytics === false ? 'No' : 'Yes'],
          ].map(([label, value]) => (
            <div className={s.row} key={label}>
              <span className={s.grow}>{label}</span>
              <span className={s.muted}>{value}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Spending over time" description="Daily spending in this budget cycle.">
          <Bars rows={model.buckets} currency={p.currency} />
        </Panel>
        <Panel title="Spending by merchant">
          <div className={s.ringLayout}>
            <Ring
              segments={model.merchants}
              value={formatMinor(p.spent, p.currency)}
              label="Total spent"
            />
            <Legend rows={model.merchants.slice(0, 6)} currency={p.currency} />
          </div>
        </Panel>
      </div>
      <Panel
        title="Recent transactions"
        description="Showing latest transactions from this budget."
      >
        {p.loading ? (
          <p role="status">Loading saved activity…</p>
        ) : p.error ? (
          <p role="alert" className={s.error}>
            {p.error}
          </p>
        ) : (
          <BudgetTable rows={p.transactions} onOpen={p.onOpenTransaction} />
        )}
      </Panel>
      {p.actionError && (
        <p role="alert" className={s.error}>
          {p.actionError}
        </p>
      )}
    </div>
  );
}
