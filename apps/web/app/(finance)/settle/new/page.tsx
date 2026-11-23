'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { formatMinor } from '@convex/shared/money';
import { ArrowRight } from 'lucide-react';
import { ListSkeleton } from '@finapp/ui/web';
import {
  groupErrorMessage,
  isValidTransferSequence,
  SettleUpHub,
  type SettlePerson,
  type SettleTransfer,
} from '@finapp/ui/finance';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import {
  localRecordId,
  recordAliases,
  useGroupLedger,
  type LedgerGroup,
} from '@/lib/groups/useGroupLedger';
import { useUndoSettlement } from '@/lib/groups/settlementUndo';

type Account = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
};

export default function NewSettlementPage() {
  return (
    <React.Suspense
      fallback={
        <div className="finance-page">
          <ListSkeleton rows={3} />
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
  const requestedMember = searchParams.get('member') ?? '';
  const [chosenGroupId, setChosenGroupId] = React.useState(requestedGroupId);
  const [accountId, setAccountId] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState<{ title: string; description: string } | null>(null);
  const saveLock = React.useRef(false);
  React.useEffect(() => setChosenGroupId(requestedGroupId), [requestedGroupId]);
  const { records: allGroups, loading: groupsLoading } = useLocalRecords<LedgerGroup>('group');
  const activeGroups = allGroups.filter((item) => item.archivedAt === undefined);
  const routeGroupId =
    chosenGroupId || (activeGroups.length === 1 ? localRecordId(activeGroups[0]!) : '');
  const ledger = useGroupLedger(routeGroupId || undefined);
  const { userId, isConnected, group, groupId, cloudGroupId, members, balances } = ledger;
  const undo = useUndoSettlement();
  const { records: accounts, loading: accountsLoading } = useLocalRecords<Account>('account');
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    isConnected && cloudGroupId ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const currency = group?.currency ?? '';
  const accountOptions = accounts.filter(
    (item) =>
      item.archivedAt === undefined && item.ownerId === userId && item.currency === currency,
  );
  const chosenAccount =
    accountOptions.find((item) => recordAliases(item).includes(accountId)) ??
    (accountOptions.length === 1 ? accountOptions[0] : undefined);

  const people: SettlePerson[] = [];
  const seen = new Set<string>();
  for (const member of remoteGroup?.members ?? []) {
    seen.add(member.id);
    people.push({
      id: member.id,
      name: member.id === userId ? 'You' : member.displayName,
      avatarUrl: member.avatarUrl,
      avatarId: member.avatarId,
    });
  }
  for (const member of members) {
    const memberId = String(member.userId ?? member.memberId ?? '');
    if (!memberId || seen.has(memberId)) continue;
    seen.add(memberId);
    people.push({
      id: memberId,
      name:
        memberId === userId
          ? 'You'
          : String(
              member.displayName ??
                member.name ??
                (member.username ? `@${member.username}` : `Member ${memberId.slice(-6)}`),
            ),
      avatarUrl: member.avatarUrl ?? null,
      avatarId: member.avatarId,
    });
  }
  for (const former of remoteGroup?.formerMembers ?? []) {
    if (seen.has(former.id)) continue;
    seen.add(former.id);
    people.push({
      id: former.id,
      name: former.displayName,
      avatarId: former.avatarId,
      leftAt: former.leftAt,
    });
  }
  const initialMemberId = requestedMember
    ? (members.find(
        (member) =>
          member.userId === requestedMember ||
          member.username?.toLowerCase() === requestedMember.replace(/^@+/, '').toLowerCase(),
      )?.userId ?? requestedMember)
    : undefined;

  const status: 'loading' | 'ready' | 'unavailable' | 'no-group' = !routeGroupId
    ? 'no-group'
    : !group
      ? groupsLoading
        ? 'loading'
        : 'unavailable'
      : ledger.status;
  const blockedReason = accountsLoading
    ? 'Loading your accounts…'
    : !chosenAccount
      ? accountOptions.length
        ? 'Choose the account this payment belongs to.'
        : `Add an active ${currency} account to record settlements.`
      : undefined;

  async function record(transfers: SettleTransfer[], note?: string) {
    if (saveLock.current) return;
    if (!userId || !group || !groupId || !balances || !chosenAccount || blockedReason) {
      setError(blockedReason ?? 'Choose a group, person and account first.');
      return;
    }
    if (!transfers.length || !isValidTransferSequence(balances, transfers)) {
      setError(groupErrorMessage('SETTLEMENT_EXCEEDS_BALANCE'));
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError('');
    const savedIds: string[] = [];
    try {
      const accountRecordId = localRecordId(chosenAccount);
      for (const transfer of transfers) {
        const occurredAt = Date.now();
        const payload = {
          groupId,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          accountId: accountRecordId,
          amountMinor: transfer.amountMinor,
          currency,
          occurredAt,
          ...(note ? { note } : {}),
        };
        savedIds.push(
          await commitLocalWrite(
            userId,
            'settlement',
            'settlement.create',
            { ...payload, createdAt: occurredAt },
            payload,
            {
              dependencies: [
                ...(!group.cloudId && !group._id ? [`group:${groupId}`] : []),
                ...(!chosenAccount.cloudId && !chosenAccount._id
                  ? [`account:${accountRecordId}`]
                  : []),
              ],
            },
          ),
        );
      }
      const total = transfers.reduce((sum, transfer) => sum + transfer.amountMinor, 0n);
      const name = (id: string) => people.find((person) => person.id === id)?.name ?? 'a member';
      const description =
        transfers.length === 1
          ? `${transfers[0]!.fromUserId === userId ? 'You' : name(transfers[0]!.fromUserId)} paid ${
              transfers[0]!.toUserId === userId ? 'you' : name(transfers[0]!.toUserId)
            } ${formatMinor(total, currency)}${note ? ` · “${note}”` : ''}.`
          : `${transfers.length} payments totalling ${formatMinor(total, currency)} were recorded.`;
      setSuccess({ title: 'Payment recorded', description });
      toast.success('Settlement recorded', {
        description: isConnected ? description : 'Saved in this browser; it syncs when online.',
        action: { label: 'Undo', onClick: () => void undo(savedIds) },
      });
    } catch (cause) {
      setError(groupErrorMessage(cause, 'Could not save settlement.'));
      if (savedIds.length)
        toast.info(`${savedIds.length} of ${transfers.length} payments were saved`, {
          action: { label: 'Undo', onClick: () => void undo(savedIds) },
        });
    } finally {
      saveLock.current = false;
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
    <SettleUpHub
      groups={activeGroups.map((item) => ({
        id: localRecordId(item),
        name: item.name ?? 'Group',
        currency: item.currency ?? '',
        icon: item.icon,
        color: item.color,
      }))}
      selectedGroupId={group ? groupId : undefined}
      onSelectGroup={(id) => {
        setChosenGroupId(id);
        setAccountId('');
        setError('');
      }}
      accounts={accountOptions.map((item) => ({
        id: localRecordId(item),
        name: String(item.name ?? 'Account'),
      }))}
      selectedAccountId={chosenAccount ? localRecordId(chosenAccount) : undefined}
      onSelectAccount={(id) => {
        setAccountId(id);
        setError('');
      }}
      status={status}
      statusMessage={
        status === 'unavailable'
          ? !group
            ? 'This group is not available in this browser.'
            : groupErrorMessage(ledger.error, 'The full group ledger is unavailable.')
          : undefined
      }
      onRetry={ledger.retry}
      meId={userId}
      currency={currency || 'INR'}
      balances={balances ?? {}}
      people={people}
      initialMemberId={initialMemberId}
      blockedReason={blockedReason}
      saving={saving}
      error={error || undefined}
      onRecord={(transfers, note) => void record(transfers, note)}
      success={success}
      onDone={() => router.replace(group ? `/group/${encodeURIComponent(groupId)}` : '/groups')}
      onAnother={() => setSuccess(null)}
      onBack={() =>
        router.push(group ? `/group/${encodeURIComponent(groupId)}/balances` : '/groups')
      }
    />
  );
}
