'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarClock, CalendarDays, Plus } from 'lucide-react';
import { Button, Card, Empty, IconButton, SectionHeader, Text, Typography, useTheme } from '@finapp/ui/web';
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
  const { userId, isConnected } = useBrowserSync();
  const router = useRouter();
  const { tokens } = useTheme();
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
      setNotificationsAllowed('Notification' in window && Notification.permission === 'granted');
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
  const enabledCount = ordered.filter((rule) => rule.enabled).length;
  const nextDueAt = ordered
    .filter((rule) => rule.enabled)
    .map(dueDate)
    .filter((at) => at > now)
    .sort((left, right) => left - right)[0];

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
    <div className="finance-page" style={{ gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title" style={{ flex: 1 }}>
          Recurring
        </Typography>
        {ordered.length > 0 && !adding && (
          <IconButton
            label="Add recurring reminder"
            variant="ghost"
            onPress={() => setAdding(true)}
          >
            <Plus size={21} aria-hidden="true" />
          </IconButton>
        )}
      </header>

      <Text style={{ maxWidth: 340 }}>
        Reminder-only rules keep upcoming expenses visible. They never create a transaction
        automatically.
      </Text>

      {(rulesLoading || accountsLoading) && (
        <Typography variant="small">Loading saved reminders…</Typography>
      )}
      {loadError && (
        <div role="alert" style={{ display: 'grid', gap: 10 }}>
          <Text style={{ color: tokens.destructive }}>Saved recurring rules could not be loaded.</Text>
          <Button
            variant="outline"
            onPress={() => {
              window.location.reload();
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {!!error && (
        <Text role="alert" style={{ color: tokens.destructive }}>
          {error}
        </Text>
      )}

      {ordered.length > 0 && (
        <section style={{ display: 'grid', gap: 6 }}>
          <Typography variant="label">
            {enabledCount} active · {ordered.length - enabledCount} paused
          </Typography>
          {nextDueAt && (
            <Typography variant="heading">
              Next due {new Date(nextDueAt).toLocaleDateString()}
            </Typography>
          )}
        </section>
      )}

      {dueRules.length > 0 && (
        <Card
          className="finance-record-panel"
          role="status"
          aria-live="polite"
          style={{ display: 'grid', gap: 10 }}
        >
          <SectionHeader title="Reminder due" action={<CalendarClock size={18} aria-hidden="true" />} />
          <Text>
            {dueRules.length} scheduled {dueRules.length === 1 ? 'reminder is' : 'reminders are'}{' '}
            due. Finapp never records a transaction automatically.
          </Text>
          <ul>
            {dueRules.map((rule) => (
              <li key={String(rule.id ?? rule._id ?? '')}>
                <strong>{rule.name ?? 'Recurring reminder'}</strong>
                {` · ${new Date(Number(rule.nextOccurrence)).toLocaleDateString()}`}
              </li>
            ))}
          </ul>
          <Text>
            This in-app reminder remains available if browser notifications are unavailable or
            permission has not been granted. Notifications are delivered only while Finapp is open.
          </Text>
          <Link className="finance-inline-link" href="/settings/notifications">
            Notification controls <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </Card>
      )}

      {!rulesLoading && !accountsLoading && !loadError && ordered.length === 0 && (
        <Empty
          title="Nothing scheduled"
          description="Add a reminder for a repeating expense. You decide when to record it."
          icon={<CalendarDays size={20} aria-hidden="true" />}
          action={!adding && <Button onPress={() => setAdding(true)}>Add reminder</Button>}
        />
      )}

      {ordered.length > 0 && (
        <section>
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
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 0',
                  borderBottom: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    width: 42,
                    height: 42,
                    flex: '0 0 42px',
                    placeItems: 'center',
                    borderRadius: 14,
                    background: tokens.surfaceRaised,
                  }}
                >
                  <CalendarDays size={20} color={tokens.primary} />
                </span>
                <span style={{ display: 'grid', flex: 1, minWidth: 0, gap: 4 }}>
                  <Typography variant="bodyLarge">{rule.name ?? 'Reminder'}</Typography>
                  <Typography variant="small">
                    {rule.enabled
                      ? `${rule.frequency ?? 'monthly'} · ${at > now ? new Date(at).toLocaleDateString() : 'due'}`
                      : 'Paused'}{' '}
                    · Reminder only
                  </Typography>
                  {formattedAmount && <Typography variant="small">{formattedAmount}</Typography>}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  aria-label={`${rule.enabled ? 'Pause' : 'Resume'} ${rule.name ?? 'reminder'}`}
                  onPress={() => void setEnabled(rule)}
                >
                  {rule.enabled ? 'Pause' : 'Resume'}
                </Button>
              </div>
            );
          })}
        </section>
      )}
      {!isConnected && !rulesLoading && (
        <Typography variant="small">Offline · showing saved rules</Typography>
      )}

      {adding && (
        <section
          style={{
            display: 'grid',
            gap: 14,
            paddingTop: 16,
            borderTop: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <Typography variant="heading">New reminder</Typography>
          <form className="finance-form" onSubmit={createRule} style={{ gap: 14 }}>
            <FinanceInput
              label="Expense name"
              value={name}
              onChangeText={setName}
              placeholder="Expense name"
              maxLength={80}
              required
            />
            <Typography variant="label">Account</Typography>
            {activeAccounts.length === 0 && !accountsLoading && (
              <Text>
                Create an account first.{' '}
                <Link className="finance-inline-link" href="/account/new">
                  Add an account
                </Link>
              </Text>
            )}
            {activeAccounts.map((account) => {
              const id = String(account.id ?? account._id ?? '');
              return (
                <Button
                  key={id}
                  size="sm"
                  variant={accountId === id ? 'secondary' : 'outline'}
                  aria-pressed={accountId === id}
                  onPress={() => setAccountId(id)}
                  style={{ justifyContent: 'flex-start' }}
                >
                  {account.name ?? 'Account'} · {account.currency ?? 'INR'}
                </Button>
              );
            })}
            <FinanceInput
              label={selectedAccount ? `Amount · ${selectedAccount.currency ?? 'INR'}` : 'Amount'}
              value={amount}
              onChangeText={setAmount}
              inputMode="decimal"
              required
            />
            <Typography variant="label">Repeat from tomorrow</Typography>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {frequencies.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={option === frequency ? 'secondary' : 'outline'}
                  aria-pressed={option === frequency}
                  onPress={() => setFrequency(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            <Text>First reminder is tomorrow. You decide when to record the expense.</Text>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                style={{ flex: 1 }}
                variant="outline"
                disabled={saving}
                onPress={() => {
                  setAdding(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                style={{ flex: 1 }}
                type="submit"
                disabled={saving || !selectedAccount || !name.trim() || !amount.trim()}
              >
                {saving ? 'Saving…' : 'Save reminder'}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
