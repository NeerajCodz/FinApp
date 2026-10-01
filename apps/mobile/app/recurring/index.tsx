import React from 'react';
import { router } from 'expo-router';
import {
  RecurringIndexView,
  type RecurringCreateValues,
  type RecurringRuleView,
} from '@finapp/ui/finance';
import { nextOccurrence } from '@convex/recurring/domain';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { parseMinor } from '@/lib/money';
import type { LocalRecord } from '@/local/repository';

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
type Account = LocalRecord & {
  name?: string;
  currency?: string;
  archivedAt?: number;
  cloudId?: string;
};
function recordId(record: LocalRecord) {
  return String(record.id ?? record._id ?? '');
}

export default function RecurringScreen() {
  const { userId, isConnected } = useLocalSync();
  const rulesState = useLocalRecords<Rule>(userId, 'recurringRule');
  const accountsState = useLocalRecords<Account>(userId, 'account');
  const [pending, setPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const rules = rulesState.data ?? [];
  const accounts = accountsState.data ?? [];

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
      const dueAt = nextOccurrence(createdAt, values.frequency, 1);
      const accountId = recordId(account);
      await commitLocalWrite(
        userId,
        'recurringRule',
        'recurring.create',
        {
          ownerId: userId,
          name: values.name.trim(),
          template: {
            type: 'expense',
            title: values.name.trim(),
            amountMinor,
            accountId,
            currency,
          },
          frequency: values.frequency,
          interval: 1,
          nextOccurrence: dueAt,
          autoCreate: false,
          reminderSettings: { enabled: true },
          enabled: true,
          createdAt,
          updatedAt: createdAt,
        },
        {
          name: values.name.trim(),
          amountMinor,
          currency,
          accountId,
          frequency: values.frequency,
          nextOccurrence: dueAt,
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

  const loadError = rulesState.error || accountsState.error;
  return (
    <RecurringIndexView
      rules={rules.map((rule) => ({ ...rule, id: recordId(rule) }))}
      accounts={accounts.map((account) => ({ ...account, id: recordId(account) }))}
      loading={rulesState.loading || accountsState.loading}
      error={loadError ? 'Unable to load schedules.' : undefined}
      onRetry={() => {
        rulesState.retry();
        accountsState.retry();
      }}
      connected={isConnected}
      pending={pending}
      actionError={actionError}
      onOpen={(id) => router.push(`/recurring/${encodeURIComponent(id)}` as never)}
      onAddAccount={() => router.push('/accounts/new' as never)}
      onToggle={(rule) => void toggle(rule)}
      onCreate={create}
    />
  );
}
