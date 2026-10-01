'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RecurringDetailView, type RecurringRuleView } from '@finapp/ui/finance';
import { useLocalRecords } from '@/lib/offline/hooks';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Rule = LocalRecord &
  RecurringRuleView & {
    template?: { accountId?: string; amountMinor?: bigint | number | string; currency?: string };
  };
type Account = LocalRecord & { name?: string; cloudId?: string };
function idOf(record: LocalRecord) {
  return String(record.id ?? record._id ?? '');
}

export default function RecurringDetailPage() {
  const { recurringId } = useParams<{ recurringId: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
  const rulesState = useLocalRecords<Rule>('recurringRule');
  const accountsState = useLocalRecords<Account>('account');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestedId = decodeURIComponent(String(recurringId ?? ''));
  const rule = rulesState.records.find((item) =>
    [idOf(item), String(item.cloudId ?? ''), String(item._id ?? '')].includes(requestedId),
  );
  const accountId = String(rule?.template?.accountId ?? '');
  const account = accountsState.records.find((item) =>
    [idOf(item), String(item.cloudId ?? ''), String(item._id ?? '')].includes(accountId),
  );

  async function toggle() {
    if (!userId || !rule || pending) return;
    const id = idOf(rule);
    setPending(true);
    setError(null);
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
      setError(cause instanceof Error ? cause.message : 'Could not update this schedule.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="finance-page">
      <RecurringDetailView
        rule={rule ? { ...rule, id: idOf(rule) } : null}
        accountName={account?.name}
        loading={rulesState.loading}
        error={rulesState.error ? 'Unable to load schedule.' : undefined}
        actionError={error}
        pending={pending}
        onRetry={() => window.location.reload()}
        onBack={() => router.push('/recurring')}
        onToggle={() => void toggle()}
      />
    </div>
  );
}
