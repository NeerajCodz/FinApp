'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { calculateNetBalances } from '@convex/splits/domain';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Card, RadioGroup } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceEmptyState, SettlementEditor } from '@finapp/ui/finance';

type Group = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  username?: string;
  displayName?: string;
  name?: string;
};
type Account = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
};
type LedgerEntry = LocalRecord & {
  groupId?: string;
  transactionId?: string;
  userId?: string;
  memberId?: string;
  fromUserId?: string;
  toUserId?: string;
  type?: string;
  status?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  deletedAt?: number;
  participants?: Array<{ userId: string; amountMinor: bigint | number | string }>;
  payerUserId?: string;
  payerAmountMinor?: bigint | number | string;
};
const asMinor = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? BigInt(value)
        : 0n;
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function NewSettlementPage() {
  return (
    <React.Suspense
      fallback={
        <div className="finance-page">
          <p className="finance-muted" role="status">
            Opening settlement form…
          </p>
        </div>
      }
    >
      <NewSettlementForm />
    </React.Suspense>
  );
}

function NewSettlementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedGroupId = searchParams.get('groupId') ?? '';
  const requestedMemberId = searchParams.get('member') ?? '';
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const { records: groups, loading: groupsLoading } = useLocalRecords<Group>('group');
  const { records: accounts, loading: accountsLoading } = useLocalRecords<Account>('account');
  const { records: memberships } = useLocalRecords<Member>('groupMember');
  const { records: transactions } = useLocalRecords<LedgerEntry>('transaction');
  const { records: payers } = useLocalRecords<LedgerEntry>('expensePayer');
  const { records: participants } = useLocalRecords<LedgerEntry>('expenseParticipant');
  const { records: settlements } = useLocalRecords<LedgerEntry>('settlement');
  const { records: profiles } = useLocalRecords<LocalRecord>('profile');
  const [groupId, setGroupId] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [rangeStatus, setRangeStatus] = React.useState<'loading' | 'loaded' | 'uncached' | 'error'>(
    'loading',
  );
  const [rangeError, setRangeError] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!userId) return;
    setGroupId(requestedGroupId);
    setMemberId(requestedMemberId);
    setAccountId('');
  }, [requestedGroupId, requestedMemberId, userId]);
  const activeGroups = groups.filter((item) => item.archivedAt === undefined);
  React.useEffect(() => {
    if (!groupId && activeGroups.length === 1) setGroupId(idOf(activeGroups[0]!));
  }, [activeGroups, groupId]);
  const group = activeGroups.find((item) => aliases(item).includes(groupId));
  const currentGroupId = group ? idOf(group) : groupId;
  const currency = group?.currency ?? '';
  const groupReady = Boolean(group);
  React.useEffect(() => {
    if (!userId || !group) return;
    if (!isConnected) {
      setRangeStatus('uncached');
      setRangeError(
        'Offline. Saved balances remain available, but this all-time range may be incomplete.',
      );
      return;
    }
    let active = true;
    setRangeStatus('loading');
    setRangeError('');
    void fetchGroupRange(currentGroupId, 0, Date.now() + 1).then(
      () => {
        if (active) setRangeStatus('loaded');
      },
      (cause: unknown) => {
        if (active) {
          setRangeStatus('error');
          setRangeError(
            cause instanceof Error ? cause.message : 'All-time balances could not be loaded.',
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [currentGroupId, fetchGroupRange, groupReady, isConnected, userId]);

  const groupIds = group ? aliases(group) : [];
  const groupMembers = memberships.filter(
    (item) => typeof item.groupId === 'string' && groupIds.includes(item.groupId),
  );
  const memberChoices: Array<{ id: string; name: string; username?: string }> = [];
  if (userId)
    memberChoices.push({
      id: userId,
      name: String(profiles[0]?.displayName ?? profiles[0]?.name ?? 'You'),
    });
  const seen = new Set(memberChoices.map((item) => item.id));
  for (const item of groupMembers) {
    const id = item.userId ?? item.memberId;
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    memberChoices.push({
      id,
      name: String(
        item.displayName ??
          item.name ??
          (item.username ? `@${item.username}` : `Member ${id.slice(-6)}`),
      ),
      username: item.username,
    });
  }
  const eligibleExpenses = transactions.filter(
    (item) =>
      typeof item.groupId === 'string' &&
      groupIds.includes(item.groupId) &&
      item.type === 'expense' &&
      item.status === 'posted' &&
      item.deletedAt === undefined &&
      item.currency === currency,
  );
  const eligibleIds = new Set(eligibleExpenses.flatMap(aliases));
  const payerRows = payers.filter(
    (item) => typeof item.transactionId === 'string' && eligibleIds.has(item.transactionId),
  );
  const participantRows = participants.filter(
    (item) => typeof item.transactionId === 'string' && eligibleIds.has(item.transactionId),
  );
  let incompleteAllocation = false;
  const payerAmounts: Array<{ userId: string; amountMinor: bigint }> = [];
  const participantAmounts: Array<{ userId: string; amountMinor: bigint }> = [];
  for (const expense of eligibleExpenses) {
    const expenseIds = aliases(expense);
    const relatedPayers = payerRows.filter(
      (item) => typeof item.transactionId === 'string' && expenseIds.includes(item.transactionId),
    );
    const relatedParticipants = participantRows.filter(
      (item) => typeof item.transactionId === 'string' && expenseIds.includes(item.transactionId),
    );
    const expensePayers = relatedPayers.length
      ? relatedPayers.map((item) => ({
          userId: String(item.userId ?? item.memberId ?? ''),
          amountMinor: asMinor(item.amountMinor),
        }))
      : expense.payerUserId
        ? [
            {
              userId: expense.payerUserId,
              amountMinor: asMinor(expense.payerAmountMinor ?? expense.amountMinor),
            },
          ]
        : [];
    const expenseParticipants = relatedParticipants.length
      ? relatedParticipants.map((item) => ({
          userId: String(item.userId ?? item.memberId ?? ''),
          amountMinor: asMinor(item.amountMinor),
        }))
      : (expense.participants ?? []).map((item) => ({
          userId: item.userId,
          amountMinor: asMinor(item.amountMinor),
        }));
    const expected = asMinor(expense.amountMinor);
    if (
      !expensePayers.length ||
      !expenseParticipants.length ||
      expensePayers.reduce((sum, item) => sum + item.amountMinor, 0n) !== expected ||
      expenseParticipants.reduce((sum, item) => sum + item.amountMinor, 0n) !== expected
    )
      incompleteAllocation = true;
    payerAmounts.push(...expensePayers);
    participantAmounts.push(...expenseParticipants);
  }
  const settlementRows = settlements
    .filter(
      (item) =>
        typeof item.groupId === 'string' &&
        groupIds.includes(item.groupId) &&
        item.currency === currency &&
        item.deletedAt === undefined,
    )
    .map((item) => ({
      fromUserId: String(item.fromUserId ?? ''),
      toUserId: String(item.toUserId ?? ''),
      amountMinor: asMinor(item.amountMinor),
    }));
  let balances: Record<string, bigint> = {};
  let ledgerError = incompleteAllocation ? 'INCOMPLETE_GROUP_SPLITS' : '';
  if (!incompleteAllocation) {
    try {
      balances = calculateNetBalances(payerAmounts, participantAmounts, settlementRows);
    } catch (cause) {
      ledgerError = cause instanceof Error ? cause.message : 'Incomplete group ledger.';
    }
  }
  const myBalance = userId ? (balances[userId] ?? 0n) : 0n;
  const direction: 'pay' | 'receive' = myBalance < 0n ? 'pay' : 'receive';
  const availableMembers = memberChoices.filter(
    (member) =>
      member.id !== userId &&
      (myBalance < 0n
        ? (balances[member.id] ?? 0n) > 0n
        : myBalance > 0n
          ? (balances[member.id] ?? 0n) < 0n
          : false),
  );
  const chosenMember =
    availableMembers.find(
      (member) =>
        member.id === memberId ||
        member.username?.toLowerCase() === memberId.replace(/^@+/, '').toLowerCase(),
    ) ?? (availableMembers.length === 1 ? availableMembers[0] : undefined);
  const counterpartBalance = chosenMember ? (balances[chosenMember.id] ?? 0n) : 0n;
  const maximum = chosenMember
    ? direction === 'pay'
      ? -myBalance < counterpartBalance
        ? -myBalance
        : counterpartBalance
      : myBalance < -counterpartBalance
        ? myBalance
        : -counterpartBalance
    : 0n;
  const accountOptions = accounts.filter(
    (item) =>
      item.archivedAt === undefined && item.ownerId === userId && item.currency === currency,
  );
  const chosenAccount =
    accountOptions.find((item) => aliases(item).includes(accountId)) ??
    (accountOptions.length === 1 ? accountOptions[0] : undefined);
  const unavailable = !group
    ? groupsLoading
      ? 'Loading groups…'
      : groupId
        ? 'This group is not available on this device.'
        : 'Choose a group first.'
    : rangeStatus === 'error'
      ? 'The full group ledger is unavailable. Retry before recording a settlement.'
      : rangeStatus === 'loading'
        ? 'Loading all-time group balances…'
        : rangeStatus === 'uncached'
          ? 'The all-time range is uncached. Reconnect before recording a settlement.'
          : ledgerError
            ? 'Complete group allocations are required to confirm the debt.'
            : !availableMembers.length
              ? 'There is no outstanding balance to settle with a member.'
              : !chosenMember
                ? 'Choose the member involved in this payment.'
                : accountsLoading
                  ? 'Loading your accounts…'
                  : !chosenAccount
                    ? 'Choose an active account in the group currency.'
                    : undefined;

  async function saveSettlement(amountMinor: bigint) {
    if (
      !userId ||
      !group ||
      !currentGroupId ||
      !chosenMember ||
      !chosenAccount ||
      amountMinor <= 0n ||
      unavailable ||
      saving
    )
      return;
    if (amountMinor > maximum) {
      setError(
        'The selected amount now exceeds the bilateral balance. Refresh balances before saving.',
      );
      return;
    }
    setSaving(true);
    setError('');
    try {
      const accountRecordId = idOf(chosenAccount);
      const fromUserId = direction === 'pay' ? userId : chosenMember.id;
      const toUserId = direction === 'pay' ? chosenMember.id : userId;
      const occurredAt = Date.now();
      const record = {
        groupId: currentGroupId,
        fromUserId,
        toUserId,
        accountId: accountRecordId,
        amountMinor,
        currency,
        occurredAt,
        createdAt: occurredAt,
      };
      await commitLocalWrite(
        userId,
        'settlement',
        'settlement.create',
        record,
        {
          groupId: currentGroupId,
          fromUserId,
          toUserId,
          accountId: accountRecordId,
          amountMinor,
          currency,
          occurredAt,
        },
        {
          dependencies: [
            ...(currentGroupId.startsWith('local-') ? [`group:${currentGroupId}`] : []),
            ...(accountRecordId.startsWith('local-') ? [`account:${accountRecordId}`] : []),
          ],
        },
      );
      router.replace(`/group/${encodeURIComponent(currentGroupId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save settlement.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">SETTLEMENT</p>
        <h1>Record a repayment.</h1>
        <p>Sign in to create a local repayment record tied to a group balance.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <Link
          className="finance-secondary-action"
          href={group ? `/group/${encodeURIComponent(currentGroupId)}/balances` : '/groups'}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 style={{ margin: 0 }}>Settle up</h1>
      </header>
      {rangeStatus === 'loading' && group && (
        <p className="finance-form-note" role="status">
          Loading all-time group expenses and repayments…
        </p>
      )}
      {(rangeStatus === 'uncached' || rangeStatus === 'error') && (
        <p
          className={rangeStatus === 'error' ? 'finance-form-error' : 'finance-form-note'}
          role={rangeStatus === 'error' ? 'alert' : 'status'}
        >
          {rangeError}
        </p>
      )}
      {rangeStatus === 'error' && group && isConnected && (
        <Button
          variant="outline"
          onPress={() => {
            setRangeStatus('loading');
            setRangeError('');
            void fetchGroupRange(currentGroupId, 0, Date.now() + 1).then(
              () => setRangeStatus('loaded'),
              (cause: unknown) => {
                setRangeStatus('error');
                setRangeError(
                  cause instanceof Error ? cause.message : 'All-time balances could not be loaded.',
                );
              },
            );
          }}
        >
          Retry all-time range
        </Button>
      )}
      <div className="finance-accounts-layout" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <Card className="finance-form-panel">
          <div className="finance-form">
            <RadioGroup
              label="GROUP"
              options={activeGroups.map((item) => ({
                value: idOf(item),
                label: `${item.name ?? 'Group'} · ${item.currency ?? 'INR'}`,
              }))}
              value={group ? idOf(group) : ''}
              onChange={(value) => {
                setGroupId(value);
                setMemberId('');
                setAccountId('');
              }}
            />
            {!activeGroups.length && (
              <FinanceEmptyState
                kind="group"
                title="No saved group is available."
                description="Create or join a group before recording a settlement."
                compact
                action={
                  <Button variant="outline" onPress={() => router.push('/groups')}>
                    Browse groups
                  </Button>
                }
              />
            )}
            {availableMembers.length > 0 && (
              <RadioGroup
                label={direction === 'pay' ? 'YOU PAID' : 'PAID YOU'}
                options={availableMembers.map((member) => ({
                  value: member.id,
                  label: member.name,
                }))}
                value={chosenMember?.id}
                onChange={(value) => {
                  setMemberId(value);
                }}
              />
            )}
            {accountOptions.length > 0 && (
              <>
                <RadioGroup
                  label={`LINKED ACCOUNT · ${currency}`}
                  options={accountOptions.map((item) => ({
                    value: idOf(item),
                    label: String(item.name ?? 'Account'),
                  }))}
                  value={chosenAccount ? idOf(chosenAccount) : ''}
                  onChange={setAccountId}
                />
                <p className="finance-form-note">
                  For recordkeeping only. No money is moved from this account.
                </p>
              </>
            )}
            <SettlementEditor
              key={`${currentGroupId}:${chosenMember?.id ?? ''}`}
              memberName={chosenMember?.name ?? 'a group member'}
              currency={currency || 'INR'}
              direction={direction}
              maxAmountMinor={maximum}
              disabledReason={unavailable}
              saving={saving}
              error={error}
              onSave={(amountMinor) => void saveSettlement(amountMinor)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
