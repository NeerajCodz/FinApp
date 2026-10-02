'use client';
import React from 'react';
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Repeat2,
  Search,
  Plus,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import { Button, CustomSelect } from '@finapp/ui/web';
import { CurrencyInput } from './CurrencyInput';
import { formatMinor } from '../money';
import { nextOccurrence, type Recurrence } from '@convex/recurring/domain';
import { FinanceEmptyState } from './FinanceEmptyState';
import styles from './Transactions.module.css';
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
    categoryId?: string;
    merchant?: string;
    note?: string;
  };
};
export type RecurringAccountView = {
  id: string;
  name?: string;
  currency?: string;
  archivedAt?: number;
  cloudId?: string;
};
export type RecurringCategoryView = {
  id: string;
  name?: string;
  icon?: string;
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
  categories?: readonly RecurringCategoryView[];
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
  categoryName?: string;
  categoryIcon?: string;
  merchant?: string;
  note?: string;
  actionError?: string | null;
  onBack: () => void;
  onToggle: (rule: RecurringRuleView) => void;
};
const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
function upcoming(rule: RecurringRuleView, now: number, count: number) {
  let at = Number(rule.nextOccurrence ?? 0);
  if (!at || !['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(rule.frequency ?? ''))
    return [];
  let guard = 0;
  while (at <= now && guard++ < 1024)
    at = nextOccurrence(at, rule.frequency as Recurrence, Math.max(1, Number(rule.interval ?? 1)));
  const dates: number[] = [];
  while (at > now && dates.length < count) {
    dates.push(at);
    at = nextOccurrence(at, rule.frequency as Recurrence, Math.max(1, Number(rule.interval ?? 1)));
  }
  return dates;
}
function amountText(rule: RecurringRuleView) {
  try {
    return rule.template?.amountMinor !== undefined && rule.template.currency
      ? formatMinor(BigInt(rule.template.amountMinor), rule.template.currency)
      : '—';
  } catch {
    return '—';
  }
}
function estimate(rule: RecurringRuleView, months: number) {
  try {
    const amount = BigInt(rule.template?.amountMinor ?? 0);
    const interval = Math.max(1, Number(rule.interval ?? 1));
    switch (rule.frequency) {
      case 'daily':
      case 'custom':
        return amount * BigInt(Math.floor((months === 12 ? 365 : 30) / interval));
      case 'weekly':
        return amount * BigInt(Math.floor((months === 12 ? 52 : 4) / interval));
      case 'monthly':
        return (amount * BigInt(months)) / BigInt(interval);
      case 'yearly':
        return (amount * BigInt(months)) / BigInt(12 * interval);
      default:
        return 0n;
    }
  } catch {
    return 0n;
  }
}
export function RecurringIndexView(p: RecurringIndexViewProps) {
  const [adding, setAdding] = React.useState(false),
    [query, setQuery] = React.useState(''),
    [filter, setFilter] = React.useState<'all' | 'expenses' | 'income' | 'active'>('all');
  const [name, setName] = React.useState(''),
    [amount, setAmount] = React.useState(''),
    [accountId, setAccountId] = React.useState(''),
    [frequency, setFrequency] = React.useState<RecurringCreateValues['frequency']>('monthly');
  const now = Date.now(),
    visible = p.rules
      .filter((r) => r.archivedAt === undefined)
      .slice()
      .sort((a, b) => Number(a.nextOccurrence ?? 0) - Number(b.nextOccurrence ?? 0)),
    active = visible.filter((r) => r.enabled);
  const currency = active.find((r) => r.template?.currency)?.template?.currency;
  const expenses = active.filter(
      (r) => r.template?.type !== 'income' && r.template?.currency === currency,
    ),
    income = active.filter(
      (r) => r.template?.type === 'income' && r.template?.currency === currency,
    );
  const displayed = visible.filter(
    (r) =>
      `${r.name ?? ''} ${r.frequency ?? ''}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      (filter === 'all' ||
        (filter === 'active' && r.enabled) ||
        (filter === 'income' && r.template?.type === 'income') ||
        (filter === 'expenses' && r.template?.type !== 'income')),
  );
  const accounts = p.accounts.filter((a) => a.archivedAt === undefined),
    account = accounts.find((a) => a.id === accountId);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !amount.trim() || !account) return;
    if (
      await p.onCreate({
        name: name.trim(),
        amount: amount.trim(),
        accountId: account.id,
        frequency,
      })
    ) {
      setAdding(false);
      setName('');
      setAmount('');
    }
  }
  const metrics = [
    {
      label: 'Total recurring',
      value: String(visible.length),
      note: `${visible.filter((r) => r.template?.type !== 'income').length} expenses · ${visible.filter((r) => r.template?.type === 'income').length} income`,
      icon: Repeat2,
    },
    {
      label: 'Monthly expenses',
      value: currency
        ? formatMinor(
            expenses.reduce((sum, r) => sum + estimate(r, 1), 0n),
            currency,
          )
        : '—',
      note: `${currency ?? ''} · estimated from active reminders`,
      icon: ArrowDownRight,
    },
    {
      label: 'Monthly income',
      value: currency
        ? formatMinor(
            income.reduce((sum, r) => sum + estimate(r, 1), 0n),
            currency,
          )
        : '—',
      note: `${currency ?? ''} · estimated from active reminders`,
      icon: ArrowUpRight,
    },
    {
      label: 'Upcoming this week',
      value: String(
        active.flatMap((r) => upcoming(r, now, 1)).filter((at) => at <= now + 7 * 86400000).length,
      ),
      note: 'Active reminder dates',
      icon: CalendarDays,
    },
  ];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Recurring</h1>
          <p className={styles.subtitle}>Manage your subscriptions, bills and recurring income.</p>
        </div>
        <label className={styles.search}>
          <Search size={19} />
          <input
            aria-label="Search recurring"
            className={styles.input}
            placeholder="Search recurring…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>
      <section className={styles.metrics}>
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <div className={styles.metric} key={label}>
            <span className={styles.tile}>
              <Icon size={28} />
            </span>
            <div>
              <p>{label}</p>
              <strong
                className={
                  label === 'Monthly expenses'
                    ? styles.expense
                    : label === 'Monthly income'
                      ? styles.income
                      : undefined
                }
              >
                {value}
              </strong>
              <small>{note}</small>
            </div>
          </div>
        ))}
      </section>
      {p.connected === false && (
        <p className={styles.help}>Offline: showing reminders saved on this device.</p>
      )}
      {p.actionError && (
        <p role="alert" className={styles.error}>
          {p.actionError}
        </p>
      )}
      {adding && (
        <form className={`${styles.panel} ${styles.form}`} onSubmit={submit}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>New recurring reminder</h2>
            <Button type="button" variant="ghost" onPress={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
          <p className={styles.help}>
            First reminder is tomorrow. Reminders do not record transactions automatically.
          </p>
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                className={styles.input}
                aria-label="Recurring name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </label>
            <div className={styles.field}>
              <span>Amount</span>
              <CurrencyInput
                currency={account?.currency ?? 'INR'}
                value={amount}
                onChangeText={setAmount}
              />
            </div>
            <label className={styles.field}>
              <span>Account</span>
              <CustomSelect
                aria-label="Recurring account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Choose account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? 'Account'} · {a.currency ?? 'INR'}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label className={styles.field}>
              <span>Frequency</span>
              <CustomSelect
                aria-label="Recurring frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              >
                {frequencies.map((f) => (
                  <option key={f} value={f}>
                    {f[0]!.toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </CustomSelect>
            </label>
          </div>
          {!accounts.length && (
            <Button type="button" variant="outline" onPress={p.onAddAccount}>
              Add an account
            </Button>
          )}
          <footer className={styles.footer}>
            <Button
              type="submit"
              disabled={p.pending || !name.trim() || !amount.trim() || !account}
            >
              {p.pending ? 'Saving…' : 'Create reminder'}
            </Button>
          </footer>
        </form>
      )}
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Your recurring transactions</h2>
            <p className={styles.subtitle}>
              View and manage all your subscriptions, bills and recurring income.
            </p>
          </div>
          <div className={styles.tabs}>
            {(['all', 'expenses', 'income', 'active'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                className={`${styles.typeButton} ${filter === f ? styles.activeTab : ''}`}
                onClick={() => setFilter(f)}
              >
                {f[0]!.toUpperCase() + f.slice(1)} (
                {f === 'all'
                  ? visible.length
                  : f === 'active'
                    ? active.length
                    : visible.filter((r) =>
                        f === 'income'
                          ? r.template?.type === 'income'
                          : r.template?.type !== 'income',
                      ).length}
                )
              </button>
            ))}
          </div>
        </div>
        {p.loading ? (
          <p className={styles.empty} role="status">
            Loading recurring reminders…
          </p>
        ) : p.error ? (
          <div role="alert">
            <p className={styles.error}>{p.error}</p>
            <Button variant="outline" onPress={p.onRetry}>
              Retry
            </Button>
          </div>
        ) : displayed.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Merchant / Title</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th>Frequency</th>
                  <th>Next due</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, index) => {
                  const at = upcoming(r, now, 1)[0] ?? r.nextOccurrence;
                  return (
                    <tr
                      key={r.id}
                      tabIndex={0}
                      onClick={() => p.onOpen(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') p.onOpen(r.id);
                      }}
                    >
                      <td>{index + 1}</td>
                      <td>
                        <div className={styles.identity}>
                          <span className={styles.tile} style={{ width: 36, height: 36 }}>
                            <Repeat2 size={19} />
                          </span>
                          <span>
                            <strong>{r.name || 'Recurring reminder'}</strong>
                            <small>
                              {r.template?.type === 'income'
                                ? 'Recurring income'
                                : 'Recurring expense'}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>Unassigned</td>
                      <td>
                        {p.accounts.find(
                          (a) =>
                            a.id === r.template?.accountId || a.cloudId === r.template?.accountId,
                        )?.name ?? 'Account unavailable'}
                      </td>
                      <td>
                        {r.interval && r.interval > 1 ? `Every ${r.interval} ` : ''}
                        {r.frequency ?? 'Not set'}
                      </td>
                      <td>
                        {r.enabled
                          ? at
                            ? new Date(at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Not set'
                          : 'Paused'}
                      </td>
                      <td
                        className={`${styles.amount} ${r.template?.type === 'income' ? styles.income : styles.expense}`}
                      >
                        {r.template?.type === 'income' ? '+' : '−'}
                        {amountText(r)}
                      </td>
                      <td>
                        <button
                          type="button"
                          disabled={p.pending}
                          aria-label={`${r.enabled ? 'Pause' : 'Resume'} ${r.name ?? 'reminder'}`}
                          className={`${styles.badge} ${!r.enabled ? styles.paused : ''}`}
                          style={{ border: 0, cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            p.onToggle(r);
                          }}
                        >
                          {r.enabled ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td>
                        <ChevronRight size={17} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : visible.length ? (
          <FinanceEmptyState
            kind="search"
            compact
            title="No recurring reminders match"
            description="Try another search or filter to find a reminder."
          />
        ) : (
          <FinanceEmptyState
            kind="recurring"
            title="No recurring reminders yet"
            description="Add a reminder to keep upcoming payments visible."
          />
        )}
      </section>
      {!adding && (
        <button
          className={styles.fab}
          disabled={p.loading || !!p.error || p.pending}
          onClick={() => setAdding(true)}
          aria-label="Add recurring reminder"
        >
          <Plus size={30} />
        </button>
      )}
    </main>
  );
}
export function RecurringDetailView(p: RecurringDetailViewProps) {
  const now = Date.now();
  if (p.loading)
    return (
      <main className={styles.page}>
        <p role="status">Loading recurring schedule…</p>
      </main>
    );
  if (p.error || !p.rule)
    return (
      <main className={styles.page}>
        <button className={styles.back} onClick={p.onBack}>
          <ArrowLeft size={17} />
          Back to recurring
        </button>
        <section className={styles.panel}>
          <h1 className={styles.sectionTitle}>
            {p.error ? 'Schedule unavailable' : 'Schedule not found'}
          </h1>
          <p role={p.error ? 'alert' : undefined} className={styles.subtitle}>
            {p.error || 'This reminder was removed or is not available to your account.'}
          </p>
          {p.error && (
            <Button variant="outline" onPress={p.onRetry}>
              Retry
            </Button>
          )}
        </section>
      </main>
    );
  const r = p.rule,
    amount = amountText(r),
    dates = r.enabled ? upcoming(r, now, 5) : [],
    frequency = r.frequency ?? 'Not set',
    normalized = frequency[0]!.toUpperCase() + frequency.slice(1),
    next = dates[0] ?? r.nextOccurrence;
  const metrics = [
    { label: `${normalized} amount`, value: amount, note: 'Per occurrence', icon: Wallet },
    {
      label: 'Yearly estimate',
      value: r.template?.currency ? formatMinor(estimate(r, 12), r.template.currency) : '—',
      note: 'Based on reminder frequency',
      icon: CalendarDays,
    },
    {
      label: 'Next reminder',
      value: r.enabled
        ? next
          ? new Date(next).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Not set'
        : 'Paused',
      note: 'Reminder date, not a scheduled payment',
      icon: CalendarDays,
    },
    {
      label: 'Status',
      value: r.enabled ? 'Active' : 'Paused',
      note: r.autoCreate ? 'Automatic transaction' : 'Reminder only',
      icon: Repeat2,
    },
  ];
  return (
    <main className={styles.page}>
      <button className={styles.back} onClick={p.onBack}>
        <ArrowLeft size={17} />
        Recurring
      </button>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.tile} style={{ width: 72, height: 72 }}>
            <Repeat2 size={36} />
          </span>
          <div>
            <h1 className={styles.heading}>{r.name || 'Recurring reminder'}</h1>
            <p className={styles.subtitle}>
              {normalized} schedule ·{' '}
              {r.template?.type === 'income' ? 'Recurring income' : 'Recurring expense'}
            </p>
          </div>
        </div>
        <Button variant="outline" disabled={p.pending} onPress={() => p.onToggle(r)}>
          {r.enabled ? 'Pause reminder' : 'Resume reminder'}
        </Button>
      </header>
      {p.actionError && (
        <p role="alert" className={styles.error}>
          {p.actionError}
        </p>
      )}
      <section className={styles.metrics}>
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <div className={styles.metric} key={label}>
            <span className={styles.tile}>
              <Icon size={27} />
            </span>
            <div>
              <p>{label}</p>
              <strong style={{ fontSize: 24 }}>{value}</strong>
              <small>{note}</small>
            </div>
          </div>
        ))}
      </section>
      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Recurring details</h2>
          <p className={styles.subtitle}>Information about this recurring transaction.</p>
          <dl className={styles.details}>
            {[
              ['Name', r.name || 'Recurring reminder'],
              ['Category', 'Unassigned'],
              ['Amount', amount],
              ['Frequency', normalized],
              ['Interval', `Every ${Math.max(1, Number(r.interval ?? 1))} ${frequency}`],
              [
                'Next reminder',
                r.enabled ? (next ? new Date(next).toLocaleDateString() : 'Not set') : 'Paused',
              ],
              [
                'Created on',
                r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Not available',
              ],
              ['Account', p.accountName || 'Account unavailable'],
              ['Behavior', r.autoCreate ? 'Automatic transaction' : 'Reminder only'],
            ].map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </section>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Next reminders</h2>
          <p className={styles.subtitle}>
            Upcoming dates from this schedule, not confirmed payments.
          </p>
          {dates.length ? (
            dates.map((at) => (
              <div key={at} className={styles.upcomingRow}>
                <CalendarDays size={22} />
                <span>
                  {new Date(at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  <small className={styles.help} style={{ display: 'block', marginTop: 5 }}>
                    In {Math.ceil((at - now) / 86400000)} days
                  </small>
                </span>
                <strong className={r.template?.type === 'income' ? styles.income : styles.expense}>
                  {amount}
                </strong>
              </div>
            ))
          ) : (
            <FinanceEmptyState
              kind="recurring"
              compact
              title={r.enabled ? 'No upcoming reminder date' : 'Reminder paused'}
              description={
                r.enabled
                  ? 'A valid upcoming date is not available for this schedule.'
                  : 'Resume this reminder to see upcoming dates.'
              }
            />
          )}
        </section>
      </div>
      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Transaction history</h2>
        <p className={styles.subtitle}>Recorded transactions associated with this reminder.</p>
        <div className={styles.empty}>
          This reminder does not have linked transaction history. Past reminder dates are not
          recorded payments.
        </div>
      </section>
    </main>
  );
}
