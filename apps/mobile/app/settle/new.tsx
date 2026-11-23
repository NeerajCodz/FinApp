import React, { useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from '@/lib/toast';
import { formatMinor } from '@convex/shared/money';
import {
  groupErrorMessage,
  isValidTransferSequence,
  SettleUpHub,
  type SettlePerson,
  type SettleTransfer,
} from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { displayAccountName, recordId, recordIds } from '@/lib/ledger';
import { useUndoSettlement } from '@/lib/settlementUndo';

export default function NewSettlementScreen() {
  const params = useLocalSearchParams<{
    groupId?: string | string[];
    member?: string | string[];
  }>();
  const requestedGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const requestedMember = Array.isArray(params.member) ? params.member[0] : params.member;
  const [chosenGroupId, setChosenGroupId] = useState<string | undefined>(requestedGroupId);
  const [chosenAccountId, setChosenAccountId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ title: string; description: string } | null>(null);
  const savingRef = useRef(false);
  const { isConnected } = useLocalSync();
  const undo = useUndoSettlement();
  const { userId } = useGroupLedger(undefined);
  const groups = useLocalRecords<LocalRecord>(userId, 'group');
  const accounts = useLocalRecords<LocalRecord>(userId, 'account');
  const availableGroups = groups.data?.filter((item) => item.archivedAt === undefined) ?? [];
  const groupId =
    chosenGroupId ?? (availableGroups.length === 1 ? recordId(availableGroups[0]!) : undefined);
  const { group, members, ledger, loading, error: ledgerError, retry } = useGroupLedger(groupId);
  const cloudGroupId = String(group?.cloudId ?? group?._id ?? '');
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    isConnected && cloudGroupId ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const currency = typeof group?.currency === 'string' ? group.currency : '';
  const accountOptions =
    accounts.data?.filter(
      (item) =>
        item.archivedAt === undefined && item.currency === currency && item.ownerId === userId,
    ) ?? [];
  const account =
    accountOptions.find((item) => recordIds(item).includes(chosenAccountId ?? '')) ??
    (accountOptions.length === 1 ? accountOptions[0] : undefined);

  const groupIds = group ? recordIds(group) : [];
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
  for (const member of members ?? []) {
    const memberId = String(member.userId ?? member.memberId ?? '');
    if (
      !memberId ||
      seen.has(memberId) ||
      typeof member.groupId !== 'string' ||
      !groupIds.includes(member.groupId)
    )
      continue;
    seen.add(memberId);
    people.push({
      id: memberId,
      name:
        memberId === userId
          ? 'You'
          : (ledger?.names.get(memberId) ??
            String(member.displayName ?? member.name ?? member.username ?? 'Member')),
      avatarUrl: typeof member.avatarUrl === 'string' ? member.avatarUrl : null,
      avatarId: typeof member.avatarId === 'string' ? member.avatarId : undefined,
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
    ? (people.find(
        (person) =>
          person.id === requestedMember ||
          members?.some(
            (entry) =>
              (entry.userId ?? entry.memberId) === person.id &&
              typeof entry.username === 'string' &&
              entry.username.toLowerCase() === requestedMember.replace(/^@/, '').toLowerCase(),
          ),
      )?.id ?? requestedMember)
    : undefined;

  const status: 'loading' | 'ready' | 'unavailable' | 'no-group' = !groupId
    ? 'no-group'
    : groups.error || (!group && groups.data)
      ? 'unavailable'
      : ledgerError
        ? 'unavailable'
        : loading || !ledger
          ? 'loading'
          : 'ready';
  const blockedReason = !userId
    ? 'Sign in to record a settlement.'
    : !accounts.data
      ? 'Loading your accounts…'
      : !account
        ? accountOptions.length
          ? 'Choose the account this payment belongs to.'
          : `Add an active ${currency} account to record settlements.`
        : undefined;

  async function record(transfers: SettleTransfer[], note?: string) {
    if (savingRef.current) return;
    if (!userId || !group || !groupId || !ledger || !account || blockedReason) {
      setError(blockedReason ?? 'Choose a group, person and account first.');
      return;
    }
    if (!transfers.length || !isValidTransferSequence(ledger.balances, transfers)) {
      setError(groupErrorMessage('SETTLEMENT_EXCEEDS_BALANCE'));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    const savedIds: string[] = [];
    try {
      const accountId = recordId(account);
      for (const transfer of transfers) {
        const occurredAt = Date.now();
        const payload = {
          groupId,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          accountId,
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
                ...(!group._id && !group.cloudId ? [`group:${groupId}`] : []),
                ...(!account._id && !account.cloudId ? [`account:${accountId}`] : []),
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      toast.success('Settlement recorded', {
        description: isConnected ? description : 'Saved on this device; it syncs when online.',
        action: { label: 'Undo', onPress: () => void undo(savedIds) },
      });
    } catch (cause) {
      setError(groupErrorMessage(cause, 'Could not save settlement. Try again.'));
      if (savedIds.length)
        toast.info(`${savedIds.length} of ${transfers.length} payments were saved`, {
          action: { label: 'Undo', onPress: () => void undo(savedIds) },
        });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <SettleUpHub
      groups={availableGroups.map((item) => ({
        id: recordId(item),
        name: String(item.name ?? 'Group'),
        currency: String(item.currency ?? ''),
        icon: typeof item.icon === 'string' ? item.icon : undefined,
        color: typeof item.color === 'string' ? item.color : undefined,
      }))}
      selectedGroupId={groupId}
      onSelectGroup={(id) => {
        setChosenGroupId(id);
        setChosenAccountId(undefined);
        setError('');
      }}
      accounts={accountOptions.map((item) => ({
        id: recordId(item),
        name: displayAccountName(String(item.name ?? 'Account')),
      }))}
      selectedAccountId={account ? recordId(account) : undefined}
      onSelectAccount={(id) => {
        setChosenAccountId(id);
        setError('');
      }}
      status={status}
      statusMessage={
        status === 'unavailable'
          ? !group
            ? 'This group is not available on this device.'
            : 'The full group ledger is unavailable. Retry before recording a settlement.'
          : undefined
      }
      onRetry={retry}
      meId={userId}
      currency={currency || 'INR'}
      balances={ledger?.balances ?? {}}
      people={people}
      initialMemberId={initialMemberId}
      blockedReason={blockedReason}
      saving={saving}
      error={error || undefined}
      onRecord={(transfers, note) => void record(transfers, note)}
      success={success}
      onDone={() =>
        groupId
          ? router.replace({ pathname: '/group/[id]', params: { id: groupId } })
          : router.back()
      }
      onAnother={() => setSuccess(null)}
      onBack={() => router.back()}
    />
  );
}
