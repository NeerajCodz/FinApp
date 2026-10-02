import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { RecurringDetailView, type RecurringRuleView } from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';

type Rule = LocalRecord &
  RecurringRuleView & {
    template?: { accountId?: string; amountMinor?: bigint | number | string; currency?: string };
  };
type Account = LocalRecord & { name?: string; cloudId?: string };
function idOf(record: LocalRecord) {
  return String(record.id ?? record._id ?? '');
}

export default function RecurringDetailScreen() {
  const { recurringId } = useLocalSearchParams<{ recurringId: string }>();
  const { userId } = useLocalSync();
  const rulesState = useLocalRecords<Rule>(userId, 'recurringRule');
  const accountsState = useLocalRecords<Account>(userId, 'account');
  const [pending, setPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const requestedId = Array.isArray(recurringId) ? recurringId[0] : recurringId;
  const rules = rulesState.data ?? [];
  const accounts = accountsState.data ?? [];
  const rule = rules.find((item) =>
    [idOf(item), String(item.cloudId ?? ''), String(item._id ?? '')].includes(
      String(requestedId ?? ''),
    ),
  );
  const accountId = String(rule?.template?.accountId ?? '');
  const account = accounts.find((item) =>
    [idOf(item), String(item.cloudId ?? ''), String(item._id ?? '')].includes(accountId),
  );

  async function toggle() {
    if (!userId || !rule || pending) return;
    const id = idOf(rule);
    setPending(true);
    setActionError(null);
    try {
      await commitLocalWrite(
        userId,
        'recurringRule',
        'recurring.setEnabled',
        { ...rule, enabled: !rule.enabled },
        { ruleId: id, enabled: !rule.enabled },
        { recordId: id, dependencies: rule.cloudId || rule._id ? [] : [`recurringRule:${id}`] },
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this schedule.');
    } finally {
      setPending(false);
    }
  }

  return (
    <RecurringDetailView
      rule={rule ? { ...rule, id: idOf(rule) } : null}
      accountName={account?.name}
      loading={rulesState.loading}
      error={rulesState.error ? 'Unable to load schedule.' : undefined}
      actionError={actionError}
      pending={pending}
      onRetry={() => {
        rulesState.retry();
        accountsState.retry();
        setActionError(null);
      }}
      onBack={() => router.push('/recurring')}
      onToggle={() => void toggle()}
    />
  );
}
