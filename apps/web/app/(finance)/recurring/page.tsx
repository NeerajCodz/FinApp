'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Plus } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { nextOccurrence, type Recurrence } from '@convex/recurring/domain';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { deliverDueReminders } from '@/lib/browser/recurring-reminders';
import { FinanceInput } from '@/components/finance/FinanceInput';

type Account = LocalRecord & {
  name?: string;
  currency?: string;
  archivedAt?: number;
  cloudId?: string;
};
type Rule = LocalRecord & {
  name?: string;
  frequency?: Recurrence;
  interval?: number;
  nextOccurrence?: number;
  enabled?: boolean;
  autoCreate?: boolean;
  template?: { amountMinor?: bigint | number | string; currency?: string; accountId?: string };
};
const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export default function RecurringPage() {
  const { userId } = useBrowserSync();
  const {
    records: rules,
    loading: rulesLoading,
    error: rulesError,
  } = useLocalRecords<Rule>('recurringRule');
  const {
    records: accounts,
    loading: accountsLoading,
    error: accountsError,
  } = useLocalRecords<Account>('account');
  const activeAccounts = accounts.filter((account) => account.archivedAt === undefined);
  const sentReminders = React.useRef(new Set<string>());
  const [notificationsAllowed, setNotificationsAllowed] = React.useState(false);
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [frequency, setFrequency] = React.useState<(typeof frequencies)[number]>('monthly');
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selectedAccount = activeAccounts.find(
    (account) => String(account.id ?? account._id ?? '') === accountId,
  );
  const ordered = [...rules].sort(
    (a, b) => Number(a.nextOccurrence ?? 0) - Number(b.nextOccurrence ?? 0),
  );
  const [now, setNow] = React.useState(() => Date.now());
  const dueRules = React.useMemo(
    () =>
      rules.filter(
        (rule) =>
          rule.enabled &&
          Number(rule.nextOccurrence ?? 0) > 0 &&
          Number(rule.nextOccurrence ?? 0) <= now,
      ),
    [now, rules],
  );

  React.useEffect(() => {
    const refreshClock = () => setNow(Date.now());
    const timer = window.setInterval(refreshClock, 60_000);
    window.addEventListener('focus', refreshClock);
    document.addEventListener('visibilitychange', refreshClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshClock);
      document.removeEventListener('visibilitychange', refreshClock);
    };
  }, []);

  React.useEffect(() => {
    const updatePermission = () =>
      setNotificationsAllowed(
        'Notification' in window && Notification.permission === 'granted',
      );
    updatePermission();
    window.addEventListener('focus', updatePermission);
    return () => window.removeEventListener('focus', updatePermission);
  }, []);

  React.useEffect(() => {
    if (
      !userId ||
      rulesLoading ||
      dueRules.length === 0 ||
      !notificationsAllowed ||
      document.visibilityState !== 'visible'
    )
      return;
    deliverDueReminders(
      userId,
      dueRules,
      now,
      window.localStorage,
      (rule) => {
        const id = String(rule.id ?? rule._id ?? '');
        const occurrence = Number(rule.nextOccurrence ?? 0);
        new Notification(rule.name ? `Reminder: ${rule.name}` : 'Recurring reminder due', {
          body: 'Finapp is open. Review the reminder and decide whether to record it.',
          tag: `finapp-recurring:${id}:${occurrence}`,
        });
      },
      sentReminders.current,
    );
  }, [dueRules, notificationsAllowed, now, rulesLoading, userId]);

  React.useEffect(() => {
    const hasSelectedAccount = activeAccounts.some(
      (account) => String(account.id ?? account._id ?? '') === accountId,
    );
    if (!hasSelectedAccount) {
      setAccountId(String(activeAccounts[0]?.id ?? activeAccounts[0]?._id ?? ''));
    }
  }, [accountId, activeAccounts]);

  const dueDate = (rule: Rule) => {
    let at = Number(rule.nextOccurrence ?? 0);
    for (let step = 0; at > 0 && at <= now && step < 1024; step += 1) {
      at = nextOccurrence(at, rule.frequency ?? 'monthly', Number(rule.interval ?? 1));
    }
    return at;
  };

  async function createRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !selectedAccount || !name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const amountMinor = parseMinor(amount, selectedAccount.currency ?? 'INR');
      if (amountMinor <= 0n) throw new Error('Enter an amount greater than zero.');
      const now = Date.now();
      const nextAt = now + 86_400_000;
      const accountLocalId = String(selectedAccount.id ?? selectedAccount._id ?? '');
      const record: LocalRecord = {
        ownerId: userId,
        name: name.trim(),
        template: {
          type: 'expense',
          title: name.trim(),
          amountMinor,
          accountId: accountLocalId,
          currency: selectedAccount.currency ?? 'INR',
        },
        frequency,
        interval: 1,
        nextOccurrence: nextAt,
        autoCreate: false,
        reminderSettings: { enabled: true },
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
      const accountDependency =
        selectedAccount.cloudId || selectedAccount._id ? [] : [`account:${accountLocalId}`];
      await commitLocalWrite(
        userId,
        'recurringRule',
        'recurring.create',
        record,
        {
          name: name.trim(),
          amountMinor,
          currency: selectedAccount.currency ?? 'INR',
          accountId: accountLocalId,
          frequency,
          nextOccurrence: nextAt,
        },
        { dependencies: accountDependency },
      );
      setName('');
      setAmount('');
      setAdding(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this reminder.');
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(rule: Rule) {
    if (!userId || saving) return;
    const id = String(rule.id ?? rule._id ?? '');
    setSaving(true);
    setError(null);
    try {
      await commitLocalWrite(
        userId,
        'recurringRule',
        'recurring.setEnabled',
        {
          ...rule,
          enabled: !rule.enabled,
        },
        { ruleId: id, enabled: !rule.enabled },
        { recordId: id, dependencies: rule.cloudId || rule._id ? [] : [`recurringRule:${id}`] },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this reminder.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">REPEAT, WITHOUT AUTOPILOT</p>
        <h1>Recurring</h1>
        <p>Sign in to manage reminder rules stored in this browser.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  const loadError = rulesError ?? accountsError;

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">A REMINDER, NOT A TRANSACTION</p>
          <h1>Recurring</h1>
          <p className="finance-muted">
            Upcoming expenses stay visible. Nothing is ever recorded automatically.
          </p>
        </div>
        <Badge variant="neutral">{rules.filter((rule) => rule.enabled).length} active</Badge>
      </header>
      {dueRules.length > 0 && (
        <Card className="finance-record-panel" role="status" aria-live="polite">
          <SectionHeader title="Reminder due" action={<CalendarClock size={18} aria-hidden="true" />} />
          <p>
            {dueRules.length} scheduled {dueRules.length === 1 ? 'reminder is' : 'reminders are'} due.
            Finapp never records a transaction automatically.
          </p>
          <ul>
            {dueRules.map((rule) => (
              <li key={String(rule.id ?? rule._id ?? '')}>
                <strong>{rule.name ?? 'Recurring reminder'}</strong>
                {` · ${new Date(Number(rule.nextOccurrence)).toLocaleDateString()}`}
              </li>
            ))}
          </ul>
          <p className="finance-muted">
            This in-app reminder remains available if browser notifications are unavailable or
            permission has not been granted. Notifications are delivered only while Finapp is open.
          </p>
          <Link className="finance-inline-link" href="/settings/notifications">
            Notification controls <ArrowRight size={15} />
          </Link>
        </Card>
      )}
      {(error || loadError) && (
        <p className="finance-form-error" role="alert">
          {error ?? `Saved reminders could not be loaded: ${loadError}`}
        </p>
      )}
      <div className="finance-accounts-layout">
        <Card className="finance-record-panel">
          <SectionHeader
            title="Upcoming reminders"
            action={
              <Button
                type="button"
                variant="outline"
                onPress={() => setAdding((value) => !value)}
                aria-expanded={adding}
              >
                <Plus size={16} /> {adding ? 'Close form' : 'Add reminder'}
              </Button>
            }
          />
          {rulesLoading || accountsLoading ? (
            <p className="finance-muted" role="status">
              Opening saved reminders…
            </p>
          ) : loadError ? (
            <p className="finance-muted">Reload this page to retry local storage.</p>
          ) : ordered.length === 0 ? (
            <Empty
              title="Nothing scheduled yet"
              description="Create a reminder for a repeating bill, then decide when to enter each transaction."
              icon={<CalendarClock size={20} />}
            />
          ) : (
            <ul
              className="finance-record-list"
              style={{ margin: 0, padding: 0, listStyle: 'none' }}
            >
              {ordered.map((rule) => {
                const id = String(rule.id ?? rule._id ?? '');
                const at = dueDate(rule);
                const money = rule.template?.amountMinor;
                let formattedAmount = '';
                if (money !== undefined && rule.template?.currency) {
                  try {
                    formattedAmount = formatMinor(
                      typeof money === 'bigint' ? money : BigInt(money),
                      rule.template.currency,
                    );
                  } catch {
                    formattedAmount = '';
                  }
                }
                return (
                  <li
                    className="finance-plan-card"
                    style={{ display: 'grid', alignItems: 'stretch' }}
                    key={id}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <span>
                        <strong>{rule.name ?? 'Reminder'}</strong>
                        <small>
                          {rule.enabled
                            ? `${rule.frequency ?? 'monthly'} · ${at > now ? new Date(at).toLocaleDateString() : 'Date needs attention'}`
                            : 'Paused'}{' '}
                          · Reminder only
                        </small>
                      </span>
                      <strong>{formattedAmount}</strong>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <span className="finance-muted">
                        {rule.autoCreate
                          ? 'Automatic recording disabled'
                          : 'Will not create a transaction'}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        aria-label={`${rule.enabled ? 'Pause' : 'Resume'} ${rule.name ?? 'reminder'}`}
                        onPress={() => void setEnabled(rule)}
                      >
                        {rule.enabled ? 'Pause' : 'Resume'}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {adding && (
          <Card className="finance-record-panel">
            <SectionHeader title="New reminder" />
            <form className="finance-form" onSubmit={createRule}>
              <FinanceInput
                label="Reminder name"
                value={name}
                onChangeText={setName}
                placeholder="Rent"
                maxLength={80}
                required
              />
              <label className="finance-form-field">
                <span>Active account</span>
                <select
                  value={accountId}
                  onChange={(event) => setAccountId(event.currentTarget.value)}
                  required
                  aria-label="Account for reminder"
                >
                  <option value="">Choose an account</option>
                  {activeAccounts.map((account) => (
                    <option
                      key={String(account.id ?? account._id)}
                      value={String(account.id ?? account._id)}
                    >
                      {account.name ?? 'Account'} · {account.currency ?? 'INR'}
                    </option>
                  ))}
                </select>
              </label>
              {activeAccounts.length === 0 && !accountsLoading && (
                <p className="finance-muted">Create an active account before adding a reminder.</p>
              )}
              <FinanceInput
                label={`Amount${selectedAccount ? ` · ${selectedAccount.currency ?? 'INR'}` : ''}`}
                value={amount}
                onChangeText={setAmount}
                inputMode="decimal"
                required
              />
              <label className="finance-form-field">
                <span>Repeat</span>
                <select
                  value={frequency}
                  onChange={(event) =>
                    setFrequency(event.currentTarget.value as (typeof frequencies)[number])
                  }
                  aria-label="Repeat frequency"
                >
                  {frequencies.map((option) => (
                    <option key={option} value={option}>
                      {option[0].toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="finance-muted">
                First reminder is tomorrow. You decide when to record the expense.
              </p>
              <Button
                type="submit"
                disabled={saving || !name.trim() || !amount.trim() || !selectedAccount}
              >
                {saving ? 'Saving…' : 'Save reminder'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
