'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  RecurringIndexView,
  type RecurringCreateValues,
  type RecurringRuleView,
} from '@finapp/ui/finance';
import { nextOccurrence } from '@convex/recurring/domain';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { deliverDueReminders } from '@/lib/browser/recurring-reminders';

type Account = LocalRecord & {
  name?: string;
  currency?: string;
  archivedAt?: number;
  cloudId?: string;
};
type Rule = LocalRecord &
  RecurringRuleView & {
    frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    template?: {
      type?: string;
      amountMinor?: bigint | number | string;
      currency?: string;
      accountId?: string;
    };
  };
function recordId(record: LocalRecord) {
  return String(record.id ?? record._id ?? '');
}

export default function RecurringPage() {
  const { userId, isConnected } = useBrowserSync();
  const router = useRouter();
  const rulesState = useLocalRecords<Rule>('recurringRule');
  const accountsState = useLocalRecords<Account>('account');
  const sentReminders = React.useRef(new Set<string>());
  const [notificationsAllowed, setNotificationsAllowed] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const rules = rulesState.records;
  const accounts = accountsState.records;
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
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  React.useEffect(() => {
    const update = () =>
      setNotificationsAllowed('Notification' in window && Notification.permission === 'granted');
    update();
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, []);
  React.useEffect(() => {
    if (
      !userId ||
      rulesState.loading ||
      !dueRules.length ||
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
  }, [dueRules, notificationsAllowed, now, rulesState.loading, userId]);

  async function create(values: RecurringCreateValues): Promise<boolean> {
    if (!userId || pending) return false;
    const account = accounts.find(
      (item) => recordId(item) === values.accountId && item.archivedAt === undefined,
    );
    if (!account) {
      setActionError('Choose an active account.');
      return false;
    }
    setPending(true);
    setActionError(null);
    try {
      const currency = account.currency ?? 'INR';
      const amountMinor = parseMinor(values.amount, currency);
      if (amountMinor <= 0n) throw new Error('Enter an amount greater than zero.');
      const createdAt = Date.now();
      const nextAt = nextOccurrence(createdAt, values.frequency, 1);
      const accountId = recordId(account);
      const record: LocalRecord = {
        ownerId: userId,
        name: values.name.trim(),
        template: { type: 'expense', title: values.name.trim(), amountMinor, accountId, currency },
        frequency: values.frequency,
        interval: 1,
        nextOccurrence: nextAt,
        autoCreate: false,
        reminderSettings: { enabled: true },
        enabled: true,
        createdAt,
        updatedAt: createdAt,
      };
      await commitLocalWrite(
        userId,
        'recurringRule',
        'recurring.create',
        record,
        {
          name: values.name.trim(),
          amountMinor,
          currency,
          accountId,
          frequency: values.frequency,
          nextOccurrence: nextAt,
        },
        { dependencies: account.cloudId || account._id ? [] : [`account:${accountId}`] },
      );
      return true;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not save this reminder.');
      return false;
    } finally {
      setPending(false);
    }
  }

  async function toggle(rule: RecurringRuleView) {
    if (!userId || pending) return;
    const local = rules.find((item) => recordId(item) === rule.id);
    if (!local) {
      setActionError('This schedule is no longer available.');
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      await commitLocalWrite(
        userId,
        'recurringRule',
        'recurring.setEnabled',
        { ...local, enabled: !local.enabled },
        { ruleId: rule.id, enabled: !local.enabled },
        {
          recordId: rule.id,
          dependencies: local.cloudId || local._id ? [] : [`recurringRule:${rule.id}`],
        },
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this reminder.');
    } finally {
      setPending(false);
    }
  }

  if (!userId)
    return (
      <div className="finance-page">
        <section className="finance-welcome">
          <p className="finance-kicker">REPEAT, WITHOUT AUTOPILOT</p>
          <h1>Recurring</h1>
          <p>Sign in to manage reminder rules stored in this browser.</p>
          <a className="finance-primary-link" href="/sign-in">
            Sign in
          </a>
        </section>
      </div>
    );
  const loadError = rulesState.error || accountsState.error;
  return (
    <div className="finance-page">
      <RecurringIndexView
        rules={rules.map((rule) => ({ ...rule, id: recordId(rule) }))}
        accounts={accounts.map((account) => ({ ...account, id: recordId(account) }))}
        loading={rulesState.loading || accountsState.loading}
        error={loadError ? 'Unable to load schedules.' : undefined}
        onRetry={() => window.location.reload()}
        connected={isConnected}
        pending={pending}
        actionError={actionError}
        onOpen={(id) => router.push(`/recurring/${encodeURIComponent(id)}`)}
        onAddAccount={() => router.push('/accounts/new')}
        onToggle={(rule) => void toggle(rule)}
        onCreate={create}
      />
    </div>
  );
}
