'use client';

import Link from 'next/link';
import Image from 'next/image';
import appIcon from '../../../../mobile/assets/icon.png';
import React from 'react';
import {
  ArrowRight,
  Car,
  Landmark,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Utensils,
  UsersRound,
} from 'lucide-react';
import { Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Account = LocalRecord & {
  name?: string;
  currency?: string;
  balanceMinor?: bigint | number | string;
  openingBalanceMinor?: bigint | number | string;
};
type Transaction = LocalRecord & {
  title?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  categoryId?: string;
  groupId?: string;
  accountId?: string;
  transferAccountId?: string;
  status?: string;
  deletedAt?: number;
  clientUpdatedAt?: number;
};
type Category = LocalRecord & { name?: string; icon?: string };
type Group = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Profile = LocalRecord & { defaultCurrency?: string };

function asMinor(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function recordId(record: LocalRecord): string {
  return String(record.id ?? record._id ?? '');
}

function CategoryMark({
  label,
  icon,
  size = 17,
}: {
  label?: string;
  icon?: string;
  size?: number;
}) {
  const normalized = (label ?? '').toLowerCase();
  const Icon =
    normalized.includes('food') || normalized.includes('coffee')
      ? Utensils
      : normalized.includes('transport') || normalized.includes('uber')
        ? Car
        : normalized.includes('shop')
          ? ShoppingBag
          : normalized.includes('bank') || normalized.includes('account')
            ? Landmark
            : ReceiptText;
  return icon ? <span aria-hidden="true">{icon}</span> : <Icon size={size} aria-hidden="true" />;
}

export default function DashboardPage() {
  const { userId } = useBrowserSync();
  const { records: accounts, loading: accountsLoading } = useLocalRecords<Account>('account');
  const { records: transactions, loading: transactionsLoading } =
    useLocalRecords<Transaction>('transaction');
  const { records: categories, loading: categoriesLoading } = useLocalRecords<Category>('category');
  const { records: groups, loading: groupsLoading } = useLocalRecords<Group>('group');
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const [now, setNow] = React.useState<number | null>(null);
  const [period, setPeriod] = React.useState('This month');
  const [customDate, setCustomDate] = React.useState('');

  React.useEffect(() => setNow(Date.now()), []);

  const currency = profiles[0]?.defaultCurrency ?? 'INR';
  const currencyAccounts = accounts.filter((account) => account.currency === currency);
  const accountIds = new Set(
    currencyAccounts.flatMap((account) =>
      [account.id, account._id, account.cloudId].filter(
        (value): value is string => typeof value === 'string',
      ),
    ),
  );
  const totalBalance =
    currencyAccounts.reduce(
      (total, account) => total + asMinor(account.balanceMinor ?? account.openingBalanceMinor),
      0n,
    ) +
    transactions.reduce((delta, transaction) => {
      if (
        typeof transaction.clientUpdatedAt !== 'number' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== currency
      )
        return delta;
      const amount = asMinor(transaction.amountMinor);
      const sourceDelta = accountIds.has(transaction.accountId ?? '')
        ? transaction.type === 'expense' || transaction.type === 'transfer'
          ? -amount
          : amount
        : 0n;
      const destinationDelta =
        transaction.type === 'transfer' &&
        transaction.transferAccountId &&
        accountIds.has(transaction.transferAccountId)
          ? amount
          : 0n;
      return delta + sourceDelta + destinationDelta;
    }, 0n);
  const range = React.useMemo(() => {
    if (now === null) return { startAt: 0, endAt: 0 };
    const start = new Date(now);
    if (period === 'Today') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'This week') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      start.setHours(0, 0, 0, 0);
    } else if (period === 'Custom date' && customDate) {
      const [year, month, day] = customDate.split('-').map(Number);
      start.setFullYear(year ?? start.getFullYear(), (month ?? 1) - 1, day ?? 1);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    const end = new Date(start);
    if (period === 'Today' || (period === 'Custom date' && customDate))
      end.setDate(end.getDate() + 1);
    else if (period === 'This week') end.setDate(end.getDate() + 7);
    else end.setMonth(end.getMonth() + 1);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }, [customDate, now, period]);
  const summary = React.useMemo(() => {
    if (now === null) return undefined;
    const chart = Array<number>(8).fill(0);
    let incomeMinor = 0n;
    let spentMinor = 0n;
    for (const transaction of transactions) {
      if (
        (transaction.status !== undefined && transaction.status !== 'posted') ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== currency ||
        typeof transaction.occurredAt !== 'number' ||
        transaction.occurredAt < range.startAt ||
        transaction.occurredAt >= range.endAt
      ) {
        continue;
      }
      const amount = asMinor(transaction.amountMinor);
      if (transaction.type === 'income') incomeMinor += amount;
      if (transaction.type === 'expense') {
        spentMinor += amount;
        const bucket = Math.min(
          7,
          Math.floor(
            ((transaction.occurredAt - range.startAt) / (range.endAt - range.startAt)) * 8,
          ),
        );
        chart[bucket] = (chart[bucket] ?? 0) + Number(amount);
      }
    }
    return { chart, incomeMinor, spentMinor };
  }, [currency, now, range.endAt, range.startAt, transactions]);
  const recent = [...transactions]
    .filter(
      (transaction) =>
        transaction.deletedAt === undefined &&
        (transaction.status === undefined || transaction.status === 'posted'),
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 4);
  const chartMax = Math.max(...(summary?.chart ?? []), 1);
  const chartStart = range.startAt ? new Date(range.startAt) : null;
  const chartEnd = range.endAt ? new Date(range.endAt - 1) : null;
  if (!userId) {
    return (
      <section className="finance-guest-welcome" aria-labelledby="finance-guest-title">
        <p className="finance-kicker">PRIVATE MONEY, CLEARLY</p>
        <div className="finance-guest-welcome-center">
          <div className="finance-guest-welcome-mark">
            <Image
              src={appIcon}
              alt="Finapp app icon"
              width={176}
              height={176}
              style={{ width: '100%', height: '100%', transform: 'scale(2.12)' }}
            />
          </div>
          <h1 id="finance-guest-title">finapp</h1>
          <p>Your money. Your people. One clear place.</p>
        </div>
        <div className="finance-guest-welcome-actions">
          <Link className="finance-guest-create" href="/sign-up">
            Create account
          </Link>
          <Link className="finance-guest-login" href="/sign-in">
            Log in
          </Link>
          <p>Private by default. Built for everyday money.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="finance-page finance-home-page">
      <header className="finance-page-heading finance-home-heading">
        <div>
          <p className="finance-kicker">OVERVIEW</p>
          <h1>Overview</h1>
        </div>
        <Link className="finance-icon-link" href="/settings/sync" aria-label="Local sync settings">
          <ShieldCheck size={20} aria-hidden="true" />
        </Link>
      </header>

      <Card className="finance-home-balance">
        <span className="finance-metric-label">TOTAL BALANCE</span>
        <strong>{accountsLoading ? '—' : formatMinor(totalBalance, currency)}</strong>
        <span className="finance-metric-foot">
          Across {currencyAccounts.length} {currencyAccounts.length === 1 ? 'account' : 'accounts'}
        </span>
      </Card>

      <section className="finance-home-metric-pair" aria-label="Income and spending">
        <Card>
          <span className="finance-metric-label">INCOME</span>
          <strong>{formatMinor(summary?.incomeMinor ?? 0n, currency)}</strong>
        </Card>
        <Card>
          <span className="finance-metric-label">SPENT</span>
          <strong>{formatMinor(summary?.spentMinor ?? 0n, currency)}</strong>
        </Card>
      </section>

      <section className="finance-home-section">
        <SectionHeader
          title="Spending"
          action={
            <div className="finance-home-period">
              <label className="finance-sr-only" htmlFor="finance-home-period">
                Spending period
              </label>
              <select
                id="finance-home-period"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option>Today</option>
                <option>This week</option>
                <option>This month</option>
                <option>Custom date</option>
              </select>
              {period === 'Custom date' && (
                <input
                  className="finance-home-date"
                  type="date"
                  aria-label="Choose spending date"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                />
              )}
            </div>
          }
        />
        <Card className="finance-chart-panel">
          {summary ? (
            <div
              className="finance-chart"
              role="img"
              aria-label={`Spending chart for ${period.toLowerCase()}`}
            >
              {summary.chart.map((value, index) => (
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
                    {index === 0
                      ? chartStart?.toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })
                      : index === 7
                        ? chartEnd?.toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                          })
                        : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="finance-muted" role="status">
              Loading spending…
            </p>
          )}
        </Card>
      </section>

      <section className="finance-home-section">
        <SectionHeader
          title="Categories"
          action={
            <Link className="finance-secondary-action" href="/category">
              See all <ArrowRight size={15} aria-hidden="true" />
            </Link>
          }
        />
        {categoriesLoading ? (
          <p className="finance-muted" role="status">
            Loading categories…
          </p>
        ) : categories.length === 0 ? (
          <Empty
            title="No categories yet"
            description="Create a category to organize transactions."
            action={
              <Link className="finance-secondary-action" href="/category/new">
                Add category <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <ul className="finance-home-list">
            {categories.slice(0, 4).map((category) => {
              const id = recordId(category);
              return (
                <li key={id}>
                  <Link href={`/category/${encodeURIComponent(id)}`}>
                    <span className="finance-account-mark" aria-hidden="true">
                      <CategoryMark label={category.name} />
                    </span>
                    <strong>{category.name ?? 'Category'}</strong>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="finance-home-people" aria-labelledby="finance-home-people-title">
        <div>
          <p className="finance-kicker">PEOPLE TO SPLIT WITH</p>
          <h2 id="finance-home-people-title">Money works better together.</h2>
        </div>
        <Link className="finance-icon-link" href="/group/new" aria-label="Invite people">
          <Plus size={20} aria-hidden="true" />
        </Link>
      </section>

      <section className="finance-home-section">
        <SectionHeader
          title="Groups"
          action={
            <Link className="finance-secondary-action" href="/groups">
              See all <ArrowRight size={15} aria-hidden="true" />
            </Link>
          }
        />
        {groupsLoading ? (
          <p className="finance-muted" role="status">
            Loading groups…
          </p>
        ) : groups.filter((group) => group.archivedAt === undefined).length ? (
          <ul className="finance-home-list">
            {groups
              .filter((group) => group.archivedAt === undefined)
              .slice(0, 2)
              .map((group) => {
                const id = recordId(group);
                return (
                  <li key={id}>
                    <Link href={`/group/${encodeURIComponent(id)}`}>
                      <span className="finance-account-mark" aria-hidden="true">
                        <UsersRound size={17} />
                      </span>
                      <strong>{group.name ?? 'Shared group'}</strong>
                      <span>{group.currency ?? currency}</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
          </ul>
        ) : (
          <Empty
            title="No groups yet"
            description="Create a group to split money with people you know."
            action={
              <Link className="finance-secondary-action" href="/group/new">
                Create group <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />
        )}
      </section>

      <section className="finance-home-section">
        <SectionHeader
          title="Recent"
          action={
            <Link className="finance-secondary-action" href="/activity">
              All <ArrowRight size={15} aria-hidden="true" />
            </Link>
          }
        />
        {transactionsLoading ? (
          <p className="finance-muted" role="status">
            Loading activity…
          </p>
        ) : recent.length === 0 ? (
          <Empty
            title="No transactions yet"
            description="Record an expense or income to start your ledger."
            action={
              <Link className="finance-secondary-action" href="/transaction/new">
                Add transaction <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <ul className="finance-transaction-list">
            {recent.map((transaction) => {
              const id = recordId(transaction);
              const amount = asMinor(transaction.amountMinor);
              const category = categories.find((item) => recordId(item) === transaction.categoryId);
              const isIncome = transaction.type === 'income' || transaction.type === 'refund';
              return (
                <li key={id}>
                  <span className={`finance-transaction-icon${isIncome ? ' income' : ''}`}>
                    <CategoryMark label={category?.name} icon={category?.icon} size={16} />
                  </span>
                  <Link
                    className="finance-transaction-description"
                    href={`/transaction/${encodeURIComponent(id)}`}
                  >
                    <strong>{transaction.title ?? 'Transaction'}</strong>
                    <small>
                      {category?.name ? `${category.name} · ` : ''}
                      {transaction.occurredAt
                        ? new Date(transaction.occurredAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Saved offline'}
                      {transaction.groupId ? ' · Shared' : ''}
                    </small>
                  </Link>
                  <strong className={isIncome ? 'finance-positive' : ''}>
                    {isIncome ? '+' : '−'}
                    {formatMinor(amount, transaction.currency ?? currency)}
                  </strong>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
