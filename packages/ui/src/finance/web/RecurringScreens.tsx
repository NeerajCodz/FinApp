'use client';

import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CirclePause,
  CirclePlay,
} from 'lucide-react';
import { Button, Card, Empty, Typography, useTheme } from '@finapp/ui/web';
import { formatMinor } from '../money';
import { nextOccurrence, type Recurrence } from '@convex/recurring/domain';

export type RecurringRuleView = {
  id: string;
  name?: string;
  frequency?: string;
  interval?: number;
  nextOccurrence?: number;
  enabled?: boolean;
  autoCreate?: boolean;
  createdAt?: number;
  archivedAt?: number;
  template?: {
    type?: string;
    amountMinor?: bigint | number | string;
    currency?: string;
    accountId?: string;
  };
};
export type RecurringAccountView = {
  id: string;
  name?: string;
  currency?: string;
  archivedAt?: number;
  cloudId?: string;
};
export type RecurringCreateValues = {
  name: string;
  amount: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
};
type SharedProps = { loading?: boolean; error?: string; pending?: boolean; onRetry?: () => void };
export type RecurringIndexViewProps = SharedProps & {
  rules: readonly RecurringRuleView[];
  accounts: readonly RecurringAccountView[];
  connected?: boolean;
  actionError?: string | null;
  onOpen: (id: string) => void;
  onToggle: (rule: RecurringRuleView) => void;
  onCreate: (values: RecurringCreateValues) => Promise<boolean>;
  onAddAccount?: () => void;
};
export type RecurringDetailViewProps = SharedProps & {
  rule: RecurringRuleView | null;
  accountName?: string;
  actionError?: string | null;
  onBack: () => void;
  onToggle: (rule: RecurringRuleView) => void;
};
const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
const dateText = (at?: number) =>
  at && Number.isFinite(at)
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(at)
    : 'Not scheduled';
function upcoming(rule: RecurringRuleView, now: number, count: number) {
  let at = Number(rule.nextOccurrence ?? 0);
  const frequency = rule.frequency;
  if (!at || !frequency || !['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(frequency))
    return [];
  let guard = 0;
  while (at <= now && guard++ < 1024)
    at = nextOccurrence(at, frequency as Recurrence, Math.max(1, Number(rule.interval ?? 1)));
  const result: number[] = [];
  while (at > 0 && result.length < count) {
    result.push(at);
    at = nextOccurrence(at, frequency as Recurrence, Math.max(1, Number(rule.interval ?? 1)));
  }
  return result;
}
function amountText(rule: RecurringRuleView) {
  const value = rule.template?.amountMinor;
  const currency = rule.template?.currency;
  if (value === undefined || !currency) return null;
  try {
    return formatMinor(typeof value === 'bigint' ? value : BigInt(value), currency);
  } catch {
    return null;
  }
}

export function RecurringIndexView({
  rules,
  accounts,
  loading = false,
  error,
  pending = false,
  connected = true,
  actionError,
  onRetry,
  onOpen,
  onAddAccount,
  onToggle,
  onCreate,
}: RecurringIndexViewProps) {
  const { tokens } = useTheme();
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'expenses' | 'income' | 'active'>('all');
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [frequency, setFrequency] = React.useState<(typeof frequencies)[number]>('monthly');
  const now = Date.now();
  const visible = rules
    .filter((rule) => rule.archivedAt === undefined)
    .slice()
    .sort((a, b) => Number(a.nextOccurrence ?? 0) - Number(b.nextOccurrence ?? 0));
  const active = visible.filter((rule) => rule.enabled);
  const displayed = visible.filter((rule) => {
    const matchesQuery = `${rule.name ?? ''} ${rule.frequency ?? ''}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
    const isIncome = rule.template?.type === 'income';
    return (
      matchesQuery &&
      (filter === 'all' ||
        (filter === 'expenses' && !isIncome) ||
        (filter === 'income' && isIncome) ||
        (filter === 'active' && rule.enabled))
    );
  });
  const primaryCurrency = active.find((rule) => rule.template?.currency)?.template?.currency;
  const monthExpenses = active.filter(
    (rule) => rule.template?.type !== 'income' && rule.template?.currency === primaryCurrency,
  );
  const monthlyTotal = monthExpenses.reduce((sum, rule) => {
    const amount = rule.template?.amountMinor;
    if (amount === undefined) return sum;
    try {
      const base = BigInt(amount);
      const interval = Math.max(1, Number(rule.interval ?? 1));
      switch (rule.frequency) {
        case 'daily':
          return sum + base * BigInt(Math.floor(30 / interval));
        case 'custom':
          return sum + base * BigInt(Math.floor(30 / interval));
        case 'weekly':
          return sum + base * BigInt(Math.floor(4 / interval));
        case 'yearly':
          return sum + base / BigInt(12 * interval);
        default:
          return sum + base / BigInt(interval);
      }
    } catch {
      return sum;
    }
  }, 0n);
  const incomeRules = active.filter(
    (rule) => rule.template?.type === 'income' && rule.template?.currency === primaryCurrency,
  );
  const monthlyIncome = incomeRules.reduce((sum, rule) => {
    const amount = rule.template?.amountMinor;
    if (amount === undefined) return sum;
    try {
      const base = BigInt(amount);
      const interval = Math.max(1, Number(rule.interval ?? 1));
      switch (rule.frequency) {
        case 'daily':
          return sum + base * BigInt(Math.floor(30 / interval));
        case 'custom':
          return sum + base * BigInt(Math.floor(30 / interval));
        case 'weekly':
          return sum + base * BigInt(Math.floor(4 / interval));
        case 'yearly':
          return sum + base / BigInt(12 * interval);
        default:
          return sum + base / BigInt(interval);
      }
    } catch {
      return sum;
    }
  }, 0n);
  const upcomingCount = active
    .flatMap((rule) => upcoming(rule, now, 1))
    .filter((at) => at <= now + 7 * 86_400_000).length;
  const selectedAccount = accounts.find(
    (account) => account.id === accountId && account.archivedAt === undefined,
  );
  const usableAccounts = accounts.filter((account) => account.archivedAt === undefined);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !amount.trim() || !selectedAccount) return;
    const saved = await onCreate({
      name: name.trim(),
      amount: amount.trim(),
      accountId: selectedAccount.id,
      frequency,
    });
    if (!saved) return;
    setName('');
    setAmount('');
    setAdding(false);
  }
  return (
    <main style={{ display: 'grid', gap: 22, maxWidth: 1440, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'end',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ margin: '0 0 6px', color: tokens.foregroundMuted }}>
            Bills, subscriptions and regular income
          </p>
          <Typography variant="title">Recurring</Typography>
          <p style={{ margin: '6px 0 0', color: tokens.foregroundMuted }}>
            Keep upcoming payments visible. Nothing is recorded automatically.
          </p>
        </div>
        {!adding && (
          <Button disabled={loading || !!error || pending} onPress={() => setAdding(true)}>
            Add reminder
          </Button>
        )}
      </header>
      {!loading && !error && (
        <section
          aria-label="Recurring summary"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))',
            gap: 12,
          }}
        >
          {[
            [
              'Schedules',
              String(visible.length),
              `${active.length} active · ${visible.length - active.length} paused`,
            ],
            [
              'Monthly expenses',
              primaryCurrency
                ? (() => {
                    try {
                      return formatMinor(monthlyTotal, primaryCurrency);
                    } catch {
                      return '—';
                    }
                  })()
                : '—',
              'Estimated from active rules',
            ],
            [
              'Monthly income',
              primaryCurrency
                ? (() => {
                    try {
                      return formatMinor(monthlyIncome, primaryCurrency);
                    } catch {
                      return '—';
                    }
                  })()
                : '—',
              'Estimated from active rules',
            ],
            ['Upcoming this week', String(upcomingCount), 'Next 7 days'],
          ].map(([label, value, note]) => (
            <Card key={label} style={{ padding: 18, display: 'grid', gap: 5 }}>
              <Typography variant="small">{label}</Typography>
              <Typography variant="heading">{value}</Typography>
              <Typography variant="small">{note}</Typography>
            </Card>
          ))}
        </section>
      )}
      {loading && (
        <Card style={{ padding: 20 }} role="status">
          Loading your recurring schedules…
        </Card>
      )}
      {error && (
        <Card style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12 }} role="alert">
          <Typography variant="small">Your saved schedules could not be loaded.</Typography>
          <Button variant="outline" onPress={onRetry}>
            Retry
          </Button>
        </Card>
      )}
      {actionError && (
        <Typography variant="small" role="alert" style={{ color: tokens.destructive }}>
          {actionError}
        </Typography>
      )}
      {!loading && !error && visible.length === 0 && !adding && (
        <Empty
          title="Nothing scheduled"
          description="Add a reminder for a repeating expense or income. You choose when to record it."
          icon={<CalendarDays size={22} />}
          action={<Button onPress={() => setAdding(true)}>Add reminder</Button>}
        />
      )}
      {!loading && !error && visible.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              aria-label="Search recurring schedules"
              className="finapp-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search recurring…"
              style={{ minWidth: 220, flex: 1 }}
            />
            {(['all', 'expenses', 'income', 'active'] as const).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={filter === item ? 'secondary' : 'outline'}
                aria-pressed={filter === item}
                onPress={() => setFilter(item)}
              >
                {item === 'all'
                  ? `All (${visible.length})`
                  : item === 'expenses'
                    ? 'Expenses'
                    : item === 'income'
                      ? 'Income'
                      : 'Active'}
              </Button>
            ))}
          </div>
          {displayed.length > 0 ? (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{ padding: '18px 20px', borderBottom: `1px solid ${tokens.borderSubtle}` }}
              >
                <Typography variant="heading">Your schedules</Typography>
                <Typography variant="small">
                  Open a schedule to see its next occurrences and details.
                </Typography>
              </div>
              {displayed.map((rule) => {
                const money = amountText(rule);
                const at = upcoming(rule, now, 1)[0];
                const isIncome = rule.template?.type === 'income';
                const accountName = accounts.find(
                  (account) =>
                    account.id === rule.template?.accountId ||
                    account.cloudId === rule.template?.accountId,
                )?.name;
                return (
                  <div
                    key={rule.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px minmax(0,1fr) auto auto',
                      alignItems: 'center',
                      gap: 14,
                      padding: '15px 20px',
                      borderBottom: `1px solid ${tokens.borderSubtle}`,
                    }}
                  >
                    <span
                      style={{
                        width: 42,
                        height: 42,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 13,
                        background: tokens.surfaceRaised,
                        color: tokens.primary,
                      }}
                    >
                      {isIncome ? <ArrowRight size={19} /> : <CalendarClock size={19} />}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpen(rule.id)}
                      style={{
                        textAlign: 'left',
                        display: 'grid',
                        gap: 4,
                        background: 'transparent',
                        border: 0,
                        color: 'inherit',
                        cursor: 'pointer',
                        minWidth: 0,
                      }}
                    >
                      <Typography variant="bodyLarge">
                        {rule.name || 'Recurring reminder'}
                      </Typography>
                      <Typography variant="small">
                        {rule.frequency || 'Schedule'} · {accountName || 'Account unavailable'} ·{' '}
                        {rule.enabled ? `Next ${dateText(at)}` : 'Paused'} ·{' '}
                        {rule.autoCreate ? 'Automatic' : 'Reminder only'}
                      </Typography>
                    </button>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {money && (
                        <Typography
                          variant="bodyLarge"
                          style={{ color: isIncome ? tokens.positive : tokens.destructive }}
                        >
                          {money}
                        </Typography>
                      )}
                      <Typography variant="small">{isIncome ? 'Income' : 'Expense'}</Typography>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onPress={() => onToggle(rule)}
                    >
                      {rule.enabled ? 'Pause' : 'Resume'}
                    </Button>
                  </div>
                );
              })}
            </Card>
          ) : (
            <Card style={{ padding: 20 }}>
              <Typography variant="small">No schedules match this search or filter.</Typography>
            </Card>
          )}
        </>
      )}
      {!connected && !loading && (
        <Typography variant="small">Offline · showing saved schedules</Typography>
      )}
      {adding && (
        <Card style={{ padding: 20, display: 'grid', gap: 14 }}>
          <Typography variant="heading">New reminder</Typography>
          <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              Expense name
              <input
                className="finapp-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
                placeholder="e.g. Rent"
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              Account
              <select
                className="finapp-input"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                required
              >
                <option value="">Choose account</option>
                {usableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name || 'Account'} · {account.currency || 'INR'}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              Amount · {selectedAccount?.currency || 'currency from account'}
              <input
                className="finapp-input"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                required
              />
            </label>
            <fieldset style={{ border: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <legend>Repeat from tomorrow</legend>
              {frequencies.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={frequency === item ? 'secondary' : 'outline'}
                  aria-pressed={frequency === item}
                  onPress={() => setFrequency(item)}
                >
                  {item}
                </Button>
              ))}
            </fieldset>
            <Typography variant="small">
              First reminder is tomorrow. You decide when to record the expense.
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'end', gap: 8 }}>
              <Button type="button" variant="outline" onPress={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending || !name.trim() || !amount.trim() || usableAccounts.length === 0}
              >
                {pending ? 'Saving…' : 'Save reminder'}
              </Button>
            </div>
            {usableAccounts.length === 0 && (
              <div>
                <Typography variant="small">Create an account before adding a reminder.</Typography>
                <Button variant="outline" size="sm" onPress={onAddAccount}>
                  Add account
                </Button>
              </div>
            )}
          </form>
        </Card>
      )}
    </main>
  );
}

export function RecurringDetailView({
  rule,
  accountName,
  loading = false,
  error,
  actionError,
  pending = false,
  onRetry,
  onBack,
  onToggle,
}: RecurringDetailViewProps) {
  const { tokens } = useTheme();
  const now = Date.now();
  if (loading)
    return (
      <main style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Card style={{ padding: 24 }} role="status">
          Loading recurring schedule…
        </Card>
      </main>
    );
  if (error || !rule)
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 16 }}>
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={17} /> Back to recurring
        </Button>
        <Card role={error ? 'alert' : undefined} style={{ padding: 24, display: 'grid', gap: 12 }}>
          <Typography variant="heading">
            {error ? 'Schedule unavailable' : 'Schedule not found'}
          </Typography>
          <Typography variant="small">
            {error
              ? 'This recurring schedule could not be loaded.'
              : 'This schedule may have been removed or is not available to your account.'}
          </Typography>
          {error && (
            <Button variant="outline" onPress={onRetry}>
              Retry
            </Button>
          )}
        </Card>
      </main>
    );
  const amount = amountText(rule);
  const dates = rule.enabled ? upcoming(rule, now, 5) : [];
  const frequency = rule.frequency || 'Not set';
  const normalized = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const annualMinor = (() => {
    const value = rule.template?.amountMinor;
    if (value === undefined) return null;
    try {
      const raw = BigInt(value);
      const interval = Math.max(1, Number(rule.interval ?? 1));
      return frequency === 'monthly'
        ? raw * BigInt(Math.floor(12 / interval))
        : frequency === 'weekly'
          ? raw * BigInt(Math.floor(52 / interval))
          : frequency === 'daily' || frequency === 'custom'
            ? raw * BigInt(Math.floor(365 / interval))
            : frequency === 'yearly'
              ? raw / BigInt(interval)
              : null;
    } catch {
      return null;
    }
  })();
  const annualText =
    annualMinor !== null && rule.template?.currency
      ? (() => {
          try {
            return formatMinor(annualMinor, rule.template.currency!);
          } catch {
            return null;
          }
        })()
      : null;
  return (
    <main style={{ display: 'grid', gap: 20, maxWidth: 1440, margin: '0 auto' }}>
      <div>
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={17} /> Recurring
        </Button>
      </div>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Typography variant="title">{rule.name || 'Recurring reminder'}</Typography>
          <Typography variant="small">
            {normalized} schedule ·{' '}
            {rule.template?.type === 'income' ? 'Recurring income' : 'Recurring expense'}
          </Typography>
        </div>
        <Button variant="outline" disabled={pending} onPress={() => onToggle(rule)}>
          {rule.enabled ? (
            <>
              <CirclePause size={17} /> Pause schedule
            </>
          ) : (
            <>
              <CirclePlay size={17} /> Resume schedule
            </>
          )}
        </Button>
      </header>
      {actionError && (
        <Typography variant="small" role="alert" style={{ color: tokens.destructive }}>
          {actionError}
        </Typography>
      )}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))',
          gap: 12,
        }}
      >
        {[
          ['Amount', amount || 'Not set'],
          ['Annual estimate', annualText || 'Not available'],
          ['Next occurrence', rule.enabled ? dateText(dates[0] ?? rule.nextOccurrence) : 'Paused'],
          ['Status', rule.enabled ? 'Active' : 'Paused'],
        ].map(([label, value]) => (
          <Card key={label} style={{ padding: 18, display: 'grid', gap: 6 }}>
            <Typography variant="small">{label}</Typography>
            <Typography variant="heading">{value}</Typography>
          </Card>
        ))}
      </section>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))',
          gap: 14,
        }}
      >
        <Card style={{ padding: 20 }}>
          <Typography variant="heading">Recurring details</Typography>
          <Typography variant="small">Information stored with this schedule.</Typography>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px,1fr) minmax(0,2fr)',
              gap: 0,
              margin: '16px 0 0',
            }}
          >
            {[
              ['Name', rule.name || 'Recurring reminder'],
              ['Amount', amount || 'Not set'],
              ['Frequency', normalized],
              ['Interval', `Every ${Math.max(1, Number(rule.interval ?? 1))} ${frequency}`],
              ['Account', accountName || 'Account unavailable'],
              ['Starts', dateText(rule.createdAt)],
              [
                'Next occurrence',
                rule.enabled ? dateText(dates[0] ?? rule.nextOccurrence) : 'Paused',
              ],
              ['Behavior', rule.autoCreate ? 'Automatic transaction' : 'Reminder only'],
            ].map(([key, value]) => (
              <React.Fragment key={key}>
                <dt
                  style={{
                    padding: '11px 0',
                    color: tokens.foregroundMuted,
                    borderBottom: `1px solid ${tokens.borderSubtle}`,
                  }}
                >
                  {key}
                </dt>
                <dd
                  style={{
                    padding: '11px 0',
                    margin: 0,
                    borderBottom: `1px solid ${tokens.borderSubtle}`,
                  }}
                >
                  {value}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </Card>
        <Card style={{ padding: 20 }}>
          <Typography variant="heading">Next occurrences</Typography>
          <Typography variant="small">
            Upcoming dates from this schedule. Past occurrences are not treated as transactions.
          </Typography>
          {dates.length ? (
            <div style={{ marginTop: 12 }}>
              {dates.map((at) => (
                <div
                  key={at}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '13px 0',
                    borderBottom: `1px solid ${tokens.borderSubtle}`,
                  }}
                >
                  <span>
                    <CalendarDays size={17} style={{ verticalAlign: 'middle', marginRight: 10 }} />
                    {dateText(at)}
                  </span>
                  <strong>{amount || '—'}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 18, color: tokens.foregroundMuted }}>
              {rule.enabled
                ? 'No valid upcoming date is available for this schedule.'
                : 'Resume this schedule to see upcoming dates.'}
            </div>
          )}
        </Card>
      </section>
      <Card style={{ padding: 18, display: 'flex', alignItems: 'start', gap: 12 }}>
        <CalendarClock size={19} color={tokens.primary} />
        <div>
          <Typography variant="bodyLarge">Reminder behavior</Typography>
          <Typography variant="small">
            This schedule{' '}
            {rule.autoCreate
              ? 'is configured to create transactions automatically.'
              : 'does not create transactions automatically. You decide when to record each expense.'}
          </Typography>
        </div>
      </Card>
    </main>
  );
}
