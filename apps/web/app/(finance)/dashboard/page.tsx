'use client';

import Link from 'next/link';
import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import { Badge, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Account = LocalRecord & {
  name?: string;
  currency?: string;
  balanceMinor?: bigint | number | string;
  openingBalanceMinor?: bigint | number | string;
  archivedAt?: number;
  isIncludedInTotal?: boolean;
};
type Transaction = LocalRecord & {
  title?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};
type Budget = LocalRecord & {
  name?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
};
type Goal = LocalRecord & {
  name?: string;
  targetAmountMinor?: bigint | number | string;
  currency?: string;
};
type Contribution = LocalRecord & { goalId?: string; amountMinor?: bigint | number | string };

function asMinor(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function recordId(record: LocalRecord): string {
  return String(record.id ?? record._id ?? '');
}

function monthBounds(now: Date): [number, number] {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return [start, end];
}

export default function DashboardPage() {
  const { userId } = useBrowserSync();
  const { records: accounts, loading: accountsLoading } = useLocalRecords<Account>('account');
  const { records: transactions, loading: transactionsLoading } =
    useLocalRecords<Transaction>('transaction');
  const { records: budgets } = useLocalRecords<Budget>('budget');
  const { records: goals } = useLocalRecords<Goal>('goal');
  const { records: contributions } = useLocalRecords<Contribution>('goalContribution');
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => setNow(Date.now()), []);

  if (!userId) {
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">YOUR FINANCIAL HOME</p>
        <h1>Good to see you.</h1>
        <p>
          Sign in while online once to sync your private workspace to this browser. Your saved data
          remains available offline after that.
        </p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in to continue <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  const currency = accounts.find((account) => account.archivedAt === undefined)?.currency ?? 'INR';
  const activeAccounts = accounts.filter((account) => account.archivedAt === undefined);
  const totalBalance = activeAccounts
    .filter((account) => account.isIncludedInTotal !== false && account.currency === currency)
    .reduce(
      (sum, account) => sum + asMinor(account.balanceMinor ?? account.openingBalanceMinor),
      0n,
    );
  const [monthStart, monthEnd] = now === null ? [0, 0] : monthBounds(new Date(now));
  const currentTransactions = transactions.filter(
    (transaction) =>
      (transaction.status === undefined || transaction.status === 'posted') &&
      transaction.deletedAt === undefined &&
      typeof transaction.occurredAt === 'number' &&
      transaction.occurredAt >= monthStart &&
      transaction.occurredAt < monthEnd &&
      transaction.currency === currency,
  );
  const income = currentTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + asMinor(transaction.amountMinor), 0n);
  const spending = currentTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + asMinor(transaction.amountMinor), 0n);
  const recent = [...transactions]
    .filter(
      (transaction) =>
        transaction.deletedAt === undefined &&
        (transaction.status === undefined || transaction.status === 'posted'),
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 5);
  const dailySpend = Array.from({ length: 8 }, (_, index) => {
    const start = now === null ? 0 : now - (7 - index) * 3_600_000 * 24;
    const end = start + 3_600_000 * 24;
    return transactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          (transaction.status === undefined || transaction.status === 'posted') &&
          transaction.currency === currency &&
          Number(transaction.occurredAt ?? 0) >= start &&
          Number(transaction.occurredAt ?? 0) < end &&
          transaction.deletedAt === undefined,
      )
      .reduce((sum, transaction) => sum + Number(asMinor(transaction.amountMinor)), 0);
  });
  const chartMax = Math.max(...dailySpend, 1);
  const monthLabel =
    now === null ? 'This month' : new Intl.DateTimeFormat('en', { month: 'long' }).format(now);

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">YOUR MONEY, IN FOCUS</p>
          <h1>Overview</h1>
          <p className="finance-muted">A clear view of what’s moving, and what’s next.</p>
        </div>
        <Link href="/transactions" className="finance-primary-link">
          <Plus size={17} /> Add transaction
        </Link>
      </header>

      <section className="finance-metric-grid" aria-label="Monthly summary">
        <Card className="finance-metric-card finance-balance-card">
          <span className="finance-metric-label">TOTAL BALANCE</span>
          <strong>{formatMinor(totalBalance, currency)}</strong>
          <span className="finance-metric-foot">
            Across {activeAccounts.length} active{' '}
            {activeAccounts.length === 1 ? 'account' : 'accounts'}
          </span>
        </Card>
        <Card className="finance-metric-card">
          <span className="finance-metric-label">INCOME · {monthLabel.toUpperCase()}</span>
          <strong>{formatMinor(income, currency)}</strong>
          <span className="finance-metric-foot">
            <ArrowDownRight size={14} /> Money in
          </span>
        </Card>
        <Card className="finance-metric-card">
          <span className="finance-metric-label">SPENDING · {monthLabel.toUpperCase()}</span>
          <strong>{formatMinor(spending, currency)}</strong>
          <span className="finance-metric-foot">
            <ArrowUpRight size={14} /> Money out
          </span>
        </Card>
      </section>

      <section className="finance-dashboard-grid">
        <Card className="finance-chart-panel">
          <SectionHeader
            title="Daily spending"
            action={<Badge variant="neutral">Last 8 days</Badge>}
          />
          <div
            className="finance-chart"
            role="img"
            aria-label="Daily spending chart for the last 8 days"
          >
            {dailySpend.map((value, index) => (
              <div className="finance-chart-column" key={index}>
                <span className="finance-chart-value">
                  {value > 0 ? formatMinor(BigInt(Math.round(value)), currency) : ''}
                </span>
                <div className="finance-chart-track">
                  <span
                    style={{
                      height: `${Math.max(value > 0 ? 8 : 0, Math.round((value / chartMax) * 100))}%`,
                    }}
                  />
                </div>
                <span className="finance-chart-label">
                  {now === null
                    ? '—'
                    : new Date(now - (7 - index) * 86_400_000).toLocaleDateString('en', {
                        weekday: 'short',
                      })}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="finance-accounts-panel">
          <SectionHeader
            title="Your accounts"
            action={
              <Link href="/accounts">
                Manage <ArrowRight size={14} />
              </Link>
            }
          />
          {accountsLoading ? (
            <p className="finance-muted">Opening your local accounts…</p>
          ) : activeAccounts.length === 0 ? (
            <Empty
              title="Start with an account"
              description="Add the places your money lives. Your balance stays on this device until it can sync."
              action={
                <Link href="/accounts" className="finance-inline-link">
                  Add an account
                </Link>
              }
            />
          ) : (
            <ul className="finance-account-list">
              {activeAccounts.slice(0, 4).map((account) => (
                <li key={recordId(account)}>
                  <span className="finance-account-mark">
                    {(account.name ?? 'A').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="finance-account-name">
                    <strong>{account.name ?? 'Account'}</strong>
                    <small>{account.currency ?? currency}</small>
                  </span>
                  <strong className="finance-account-balance">
                    {formatMinor(
                      asMinor(account.balanceMinor ?? account.openingBalanceMinor),
                      account.currency ?? currency,
                    )}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="finance-dashboard-grid finance-dashboard-lower">
        <Card className="finance-recent-panel">
          <SectionHeader
            title="Recent activity"
            action={
              <Link href="/transactions">
                All activity <ArrowRight size={14} />
              </Link>
            }
          />
          {transactionsLoading ? (
            <p className="finance-muted">Opening your local activity…</p>
          ) : recent.length === 0 ? (
            <Empty
              title="Nothing to report yet"
              description="Your transactions will appear here after you add them or finish syncing."
              action={
                <Link href="/transactions" className="finance-inline-link">
                  Add a transaction
                </Link>
              }
            />
          ) : (
            <ul className="finance-transaction-list">
              {recent.map((transaction) => {
                const amount = asMinor(transaction.amountMinor);
                const isIncome = transaction.type === 'income' || transaction.type === 'refund';
                return (
                  <li key={recordId(transaction)}>
                    <span className={`finance-transaction-icon${isIncome ? ' income' : ''}`}>
                      {isIncome ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    </span>
                    <span className="finance-transaction-description">
                      <strong>{transaction.title ?? 'Transaction'}</strong>
                      <small>
                        {transaction.occurredAt
                          ? new Date(transaction.occurredAt).toLocaleDateString('en', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Saved offline'}
                      </small>
                    </span>
                    <strong className={isIncome ? 'finance-positive' : ''}>
                      {isIncome ? '+' : '−'}
                      {formatMinor(amount, transaction.currency ?? currency)}
                    </strong>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="finance-plans-panel">
          <SectionHeader
            title="Your plans"
            action={
              <Link href="/goals">
                View goals <ArrowRight size={14} />
              </Link>
            }
          />
          {goals.length === 0 && budgets.length === 0 ? (
            <p className="finance-muted finance-empty-plans">
              Your budgets and goals will find a home here.
            </p>
          ) : (
            <div className="finance-plan-list">
              {goals.slice(0, 2).map((goal) => {
                const target = asMinor(goal.targetAmountMinor);
                const saved = contributions
                  .filter((entry) => entry.goalId === recordId(goal))
                  .reduce((sum, entry) => sum + asMinor(entry.amountMinor), 0n);
                const progress = target > 0n ? Math.min(100, Number((saved * 100n) / target)) : 0;
                return (
                  <div className="finance-plan-row" key={recordId(goal)}>
                    <div>
                      <span>{goal.name ?? 'Savings goal'}</span>
                      <strong>
                        {formatMinor(saved, goal.currency ?? currency)}{' '}
                        <small>of {formatMinor(target, goal.currency ?? currency)}</small>
                      </strong>
                    </div>
                    <div className="finance-plan-track">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
              {budgets.slice(0, 2).map((budget) => (
                <div className="finance-budget-row" key={recordId(budget)}>
                  <span>{budget.name ?? 'Budget'}</span>
                  <strong>
                    {formatMinor(asMinor(budget.amountMinor), budget.currency ?? currency)}{' '}
                    <small>limit</small>
                  </strong>
                </div>
              ))}
            </div>
          )}
          <Link className="finance-secondary-action" href="/budgets">
            Explore budgets <ArrowRight size={15} />
          </Link>
        </Card>
      </section>
      {now !== null && transactions.length === 0 && !transactionsLoading && (
        <p className="finance-data-footnote">
          Your real accounts and activity will populate after your first sync. Sample numbers are
          never mixed into your finances.
        </p>
      )}
    </div>
  );
}
