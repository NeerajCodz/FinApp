import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from '@/lib/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettlementEditor } from '@/components/finance';
import { Button, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { recordId, recordIds } from '@/lib/ledger';

export default function NewSettlementScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[]; member?: string | string[] }>();
  const requestedGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const [chosenGroupId, setChosenGroupId] = useState<string | undefined>(requestedGroupId);
  const [chosenMemberId, setChosenMemberId] = useState<string | undefined>(
    Array.isArray(params.member) ? params.member[0] : params.member,
  );
  const [chosenAccountId, setChosenAccountId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useGroupLedger(undefined);
  const groups = useLocalRecords<LocalRecord>(userId, 'group');
  const accounts = useLocalRecords<LocalRecord>(userId, 'account');
  const availableGroups = groups.data?.filter((item) => item.archivedAt === undefined) ?? [];
  const groupId = chosenGroupId ?? (availableGroups.length === 1 ? recordId(availableGroups[0]!) : undefined);
  const { group, members, ledger, loading, error: ledgerError, retry } = useGroupLedger(groupId);
  const currency = typeof group?.currency === 'string' ? group.currency : '';
  const accountOptions = accounts.data?.filter((item) =>
    item.archivedAt === undefined && item.currency === currency && item.ownerId === userId) ?? [];
  const account = accountOptions.find((item) => recordIds(item).includes(chosenAccountId ?? '')) ??
    (accountOptions.length === 1 ? accountOptions[0] : undefined);
  const myBalance = userId ? ledger?.balances[userId] ?? 0n : 0n;
  const direction = myBalance < 0n ? 'pay' : 'receive';
  const memberOptions = ledger && userId && myBalance !== 0n
    ? [...ledger.names].filter(([id]) => id !== userId &&
      (myBalance < 0n ? (ledger.balances[id] ?? 0n) > 0n : (ledger.balances[id] ?? 0n) < 0n))
    : [];
  const selectedMemberId = memberOptions.find(([id]) =>
    id === chosenMemberId || members?.some((entry) =>
      entry.userId === id && typeof entry.username === 'string' &&
      entry.username.toLowerCase() === chosenMemberId?.replace(/^@/, '').toLowerCase(),
    ))?.[0] ?? (memberOptions.length === 1 ? memberOptions[0]![0] : undefined);
  const member = memberOptions.find(([id]) => id === selectedMemberId);
  const memberBalance = selectedMemberId ? ledger?.balances[selectedMemberId] ?? 0n : 0n;
  const maxAmountMinor = member && myBalance !== 0n
    ? direction === 'pay'
      ? (-myBalance < memberBalance ? -myBalance : memberBalance)
      : (myBalance < -memberBalance ? myBalance : -memberBalance)
    : 0n;
  const disabledReason = !userId ? 'Sign in to record a settlement.'
    : groups.error ? 'Groups are unavailable on this device.'
    : !groups.data ? 'Loading groups…'
    : !groupId ? 'Choose a group first.'
    : !group ? 'This group is not available on this device.'
    : ledgerError ? 'The full group ledger is unavailable. Retry before recording a settlement.'
    : loading || !ledger ? 'Loading all-time group balances…'
    : !memberOptions.length ? 'There is no outstanding balance to settle with a member.'
    : !member ? 'Choose the member involved in this payment.'
    : !accounts.data ? 'Loading your accounts…'
    : !account ? 'Choose an active account in the group currency.'
    : undefined;

  async function save(amountMinor: bigint) {
    if (savingRef.current) return;
    if (!userId || !group || !groupId || !ledger || !member || !account || disabledReason ||
      amountMinor <= 0n || amountMinor > maxAmountMinor || ledger.currency !== currency) {
      setError('Select a group, member, and matching account with an outstanding balance.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const occurredAt = Date.now();
      const accountId = recordId(account);
      const fromUserId = direction === 'pay' ? userId : member[0];
      const toUserId = direction === 'pay' ? member[0] : userId;
      const record = { groupId, fromUserId, toUserId, accountId,
        amountMinor, currency, occurredAt, createdAt: occurredAt };
      await commitLocalWrite(userId, 'settlement', 'settlement.create', record,
        { groupId, fromUserId, toUserId, accountId, amountMinor, currency, occurredAt }, {
          dependencies: [
            ...(groupId.startsWith('local-') ? [`group:${groupId}`] : []),
            ...(accountId.startsWith('local-') ? [`account:${accountId}`] : []),
          ],
        });
      toast.success('Settlement saved on this device');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace({ pathname: '/group/[id]', params: { id: groupId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save settlement. Try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32, gap: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading">Settle up</Typography>
      </View>
      <View style={{ gap: 10 }}>
        <Typography variant="label">GROUP</Typography>
        {availableGroups.length ? availableGroups.map((item) => {
          const id = recordId(item);
          return <Button key={id} variant="outline" onPress={() => {
            setChosenGroupId(id); setChosenMemberId(undefined); setChosenAccountId(undefined); setError('');
          }} accessibilityLabel={`Select ${String(item.name ?? 'group')}`}
            style={{ justifyContent: 'flex-start', borderColor: id === groupId ? tokens.settlement : tokens.border }}>
            {id === groupId ? '✓  ' : ''}{String(item.name ?? 'Group')} · {String(item.currency ?? '')}
          </Button>;
        }) : <Typography variant="small">No saved group is available. Create or join a group first.</Typography>}
      </View>
      {!!ledgerError && <View accessibilityRole="alert" style={{ gap: 10 }}>
        <Typography variant="small" style={{ color: tokens.destructive }}>Could not load complete balances.</Typography>
        <Button variant="outline" onPress={retry}>Retry balances</Button>
      </View>}
      {memberOptions.length > 0 && <View style={{ gap: 10 }}>
        <Typography variant="label">{direction === 'pay' ? 'YOU PAID' : 'PAID YOU'}</Typography>
        {memberOptions.map(([id, name]) => <Button key={id} variant="outline"
          onPress={() => { setChosenMemberId(id); setError(''); }}
          accessibilityLabel={`Select ${name}`}
          style={{ justifyContent: 'flex-start', borderColor: id === selectedMemberId ? tokens.settlement : tokens.border }}>
          {id === selectedMemberId ? '✓  ' : ''}{name}
        </Button>)}
      </View>}
      {accountOptions.length > 0 && <View style={{ gap: 10 }}>
        <Typography variant="label">LINKED ACCOUNT · {currency}</Typography>
        {accountOptions.map((item) => {
          const id = recordId(item);
          return <Button key={id} variant="outline" onPress={() => { setChosenAccountId(id); setError(''); }}
            accessibilityLabel={`Select account ${String(item.name ?? 'account')}`}
            style={{ justifyContent: 'flex-start', borderColor: id === recordId(account ?? {}) ? tokens.settlement : tokens.border }}>
            {id === recordId(account ?? {}) ? '✓  ' : ''}{String(item.name ?? 'Account')}
          </Button>;
        })}
        <Typography variant="caption">For recordkeeping only. No money is moved from this account.</Typography>
      </View>}
      <SettlementEditor key={`${groupId ?? ''}:${selectedMemberId ?? ''}`} memberName={member?.[1] ?? 'a group member'}
        currency={currency || 'INR'} direction={direction} maxAmountMinor={maxAmountMinor}
        disabledReason={disabledReason} saving={saving} error={error} onSave={save} />
    </ScrollView>
  );
}
