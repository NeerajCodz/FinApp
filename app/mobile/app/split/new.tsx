import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { allocateParticipants } from '@convex/splits/domain';
import { CurrencyInput, SemanticMarker } from '@/components/finance';
import { Button, IconButton, Input, Label, Separator, Tabs, Text, Typography } from '@/components/ui';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { formatMinor, parseMinor } from '@/lib/money';
import { displayAccountName, recordId, recordIds } from '@/lib/ledger';

type Method = 'equal' | 'exact' | 'percentage' | 'shares';
type Member = { userId: string; name: string };

function memberName(record: LocalRecord | undefined, fallback: string): string {
  return String(record?.displayName ?? record?.name ?? record?.username ?? fallback);
}

export default function SplitExpenseScreen() {
  const { groupId: routeGroupId } = useLocalSearchParams<{ groupId?: string }>();
  const { userId } = useLocalSync();
  const { data: groups } = useLocalRecords<LocalRecord>(userId, 'group');
  const { data: memberships } = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const { data: accounts } = useLocalRecords<LocalRecord>(userId, 'account');
  const { data: profiles } = useLocalRecords<LocalRecord>(userId, 'profile');
  const [groupId, setGroupId] = useState(routeGroupId ?? '');
  const [accountId, setAccountId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('equal');
  const [selectedIds, setSelectedIds] = useState<string[]>(userId ? [userId] : []);
  const initializedSelection = useRef(Boolean(userId));
  const [basis, setBasis] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (userId && !initializedSelection.current) {
      initializedSelection.current = true;
      setSelectedIds([userId]);
    }
  }, [userId]);

  const group = groups?.find((item) => recordIds(item).includes(groupId));
  const selectedGroupId = group ? recordId(group) : '';
  const currency = typeof group?.currency === 'string' ? group.currency : '';
  const groupIds = new Set(group ? recordIds(group) : []);
  const members: Member[] = [];
  if (userId) members.push({ userId, name: memberName(profiles?.[0], 'Signed-in member') });
  for (const item of memberships ?? []) {
    const memberId = item.userId ?? item.memberId;
    if (typeof item.groupId !== 'string' || !groupIds.has(item.groupId) ||
      typeof memberId !== 'string' || members.some((member) => member.userId === memberId)) continue;
    members.push({ userId: memberId, name: memberName(item, `Member ${memberId.slice(-6)}`) });
  }
  const compatibleAccounts = (accounts ?? []).filter((item) =>
    item.archivedAt === undefined && item.ownerId === userId && item.currency === currency);
  const account = compatibleAccounts.find((item) => recordIds(item).includes(accountId));
  const payerName = memberName(profiles?.[0], 'Signed-in member');
  const participantIds = members.filter((member) => selectedIds.includes(member.userId)).map((member) => member.userId);

  let amountMinor: bigint | null = null;
  let shares: { userId: string; amountMinor: bigint }[] = [];
  let validation = '';
  if (!userId) validation = 'Sign in before recording a split.';
  else if (!group || !selectedGroupId) validation = 'Choose a saved group to record this split.';
  else if (!currency) validation = 'This group has no currency.';
  else if (!account) validation = 'Choose an account in the group currency.';
  else if (!title.trim()) validation = 'Enter what this expense was for.';
  else if (!amount.trim()) validation = 'Enter the total amount.';
  else if (participantIds.length === 0 || participantIds.length !== selectedIds.length)
    validation = 'Choose at least one current group member.';
  else {
    try {
      amountMinor = parseMinor(amount, currency);
      if (amountMinor <= 0n) throw new Error('Enter an amount greater than zero.');
      const values = method === 'equal' ? undefined : participantIds.map((id) => {
        const entry = (basis[id] ?? '').trim();
        if (!entry) throw new Error('Enter a value for every selected member.');
        if (method === 'shares') {
          if (!/^\d+$/.test(entry)) throw new Error('Shares must be whole numbers.');
          return BigInt(entry);
        }
        const value = parseMinor(entry, method === 'percentage' ? 'USD' : currency);
        if (value < 0n) throw new Error('Split values cannot be negative.');
        return value;
      });
      shares = allocateParticipants(amountMinor, participantIds, method, values);
    } catch (cause) {
      validation = cause instanceof Error && !['INVALID_SPLIT', 'INVALID_AMOUNT', 'INVALID_CURRENCY'].includes(cause.message)
        ? cause.message
        : method === 'exact' ? 'Exact amounts must add up to the total.'
          : method === 'percentage' ? 'Percentages must add up to 100%.'
            : method === 'shares' ? 'Enter at least one positive whole share.'
              : 'Enter a valid amount in the group currency.';
    }
  }

  function chooseGroup(id: string) {
    setGroupId(id);
    setAccountId('');
    setSelectedIds(userId ? [userId] : []);
    setBasis({});
    setError('');
  }

  async function save() {
    if (saving || validation || !userId || !group || !account || amountMinor === null) return;
    setSaving(true);
    setError('');
    try {
      const bytes = await Crypto.getRandomBytesAsync(16);
      const clientMutationId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      const transactionId = `local-${clientMutationId}`;
      const now = Date.now();
      const participants = shares.map((share) => ({
        ...share,
        method,
        ...(method === 'equal' ? {} : {
          basisValue: (method === 'shares' ? BigInt(basis[share.userId]!)
            : parseMinor(basis[share.userId]!, method === 'percentage' ? 'USD' : currency)).toString(),
        }),
      }));
      await commitLocalWrite(userId, 'transaction', 'group.addExpense', {
        id: transactionId,
        ownerId: userId,
        groupId: selectedGroupId,
        accountId: recordId(account),
        title: title.trim(),
        amountMinor,
        currency,
        occurredAt: now,
        createdAt: now,
        type: 'expense',
        status: 'posted',
      }, {
        groupId: selectedGroupId,
        accountId: recordId(account),
        title: title.trim(),
        amountMinor,
        currency,
        occurredAt: now,
        participants,
      }, {
        recordId: transactionId,
        clientMutationId,
        dependencies: [`group:${selectedGroupId}`, `account:${recordId(account)}`],
        relatedRecords: [
          { entityType: 'expensePayer', record: {
            transactionId, userId, memberId: userId, amountMinor,
          } },
          ...participants.map((participant) => ({
            entityType: 'expenseParticipant' as const,
            record: { transactionId, userId: participant.userId, memberId: participant.userId,
              amountMinor: participant.amountMinor, method, basisValue: participant.basisValue },
          })),
        ],
      });
      router.replace(`/group/${selectedGroupId}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this split.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{
        paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, gap: 24,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="heading" style={{ flex: 1 }}>Split expense</Typography>
          <SemanticMarker type="split" />
        </View>

        <View style={{ gap: 10 }}>
          <Label>Group</Label>
          {(groups ?? []).filter((item) => item.archivedAt === undefined).map((item) => {
            const id = recordId(item);
            const chosen = id === selectedGroupId;
            return <Pressable key={id} accessibilityRole="radio"
              accessibilityLabel={`${String(item.name ?? 'Unnamed group')}, ${String(item.currency ?? 'currency unavailable')}`}
              accessibilityState={{ selected: chosen }} onPress={() => chooseGroup(id)}
              style={{ minHeight: 52, padding: 14, borderRadius: 14, borderWidth: 1,
                borderColor: chosen ? tokens.split : tokens.borderSubtle, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: chosen ? tokens.split : tokens.foreground }}>{String(item.name ?? 'Unnamed group')}</Text>
              <Typography variant="small">{String(item.currency ?? '')}</Typography>
            </Pressable>;
          })}
          {!groups?.length && <Typography variant="small">No saved groups yet.</Typography>}
          <Button variant="outline" onPress={() => router.push('/group/new' as never)}>Create a group</Button>
        </View>

        {group && <>
          <CurrencyInput currency={currency} value={amount} onChangeText={setAmount} />
          <View style={{ gap: 8 }}>
            <Label>What was it for?</Label>
            <Input accessibilityLabel="Split expense title" placeholder="Dinner, travel, supplies"
              value={title} onChangeText={setTitle} />
          </View>
          <View style={{ gap: 10 }}>
            <Label>Paid by</Label>
            <Typography variant="bodyLarge">{payerName}</Typography>
            <Typography variant="caption">Recorded from your account. Another payer is not supported here.</Typography>
            <Label>Account in {currency}</Label>
            {compatibleAccounts.map((item) => {
              const id = recordId(item);
              const chosen = account ? recordIds(account).includes(id) : false;
              return <Pressable key={id} accessibilityRole="radio" accessibilityLabel={displayAccountName(String(item.name ?? 'Account'))}
                accessibilityState={{ selected: chosen }} onPress={() => setAccountId(id)}
                style={{ minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1,
                  borderColor: chosen ? tokens.split : tokens.borderSubtle }}>
                <Text style={{ color: chosen ? tokens.split : tokens.foreground }}>{displayAccountName(String(item.name ?? 'Account'))}</Text>
              </Pressable>;
            })}
            {!compatibleAccounts.length && <Typography variant="small">
              No account uses {currency}. Add one before saving a split.
            </Typography>}
          </View>
          <Separator />
          <View style={{ gap: 12 }}>
            <Label>Split method</Label>
            <Tabs value={method} onChange={(next) => { setMethod(next as Method); setBasis({}); }} tabs={[
              { label: 'Equal', value: 'equal' }, { label: 'Exact', value: 'exact' },
              { label: '%', value: 'percentage' }, { label: 'Shares', value: 'shares' },
            ]} />
          </View>
          <View style={{ gap: 10 }}>
            <Label>Group members sharing this expense</Label>
            {members.map((member) => {
              const selected = selectedIds.includes(member.userId);
              const share = shares.find((item) => item.userId === member.userId);
              return <View key={member.userId} style={{ gap: 8, paddingVertical: 4 }}>
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`Include ${member.name}`}
                  accessibilityState={{ checked: selected }} onPress={() => {
                    setSelectedIds((current) => selected
                      ? current.filter((id) => id !== member.userId) : [...current, member.userId]);
                  }} style={{ minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: selected ? tokens.split : tokens.foregroundMuted }}>
                    {selected ? '●' : '○'}  {member.name}
                  </Text>
                  {share && <Typography variant="small">{formatMinor(share.amountMinor, currency)}</Typography>}
                </Pressable>
                {selected && method !== 'equal' && <View style={{ gap: 4 }}>
                  <Label>{method === 'exact' ? `Amount for ${member.name}`
                    : method === 'percentage' ? `Percentage for ${member.name}` : `Shares for ${member.name}`}</Label>
                  <Input accessibilityLabel={`${method} value for ${member.name}`}
                    keyboardType={method === 'shares' ? 'number-pad' : 'decimal-pad'}
                    placeholder={method === 'percentage' ? '0–100%' : method === 'shares' ? 'Whole shares' : currency}
                    value={basis[member.userId] ?? ''}
                    onChangeText={(value) => setBasis((current) => ({ ...current, [member.userId]: value }))} />
                </View>}
              </View>;
            })}
            {members.length === 1 && <Typography variant="small">
              Other group members will be available once their memberships are saved on this device.
            </Typography>}
          </View>
          <Separator />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Typography variant="bodyLarge">Total</Typography>
            <Typography variant="bodyLarge" style={{ color: tokens.split }}>
              {amountMinor !== null ? formatMinor(amountMinor, currency) : currency}
            </Typography>
          </View>
        </>}
        {!!validation && <Typography accessibilityRole="alert" variant="small" style={{ color: tokens.foregroundMuted }}>
          {validation}
        </Typography>}
        {!!error && <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>{error}</Typography>}
        <Button size="lg" disabled={saving || !!validation} onPress={save}
          style={{ backgroundColor: saving || !!validation ? tokens.controlDisabledBackground : tokens.split }}>
          <Text style={{ color: saving || !!validation ? tokens.controlDisabledForeground : '#FFFFFF',
            fontFamily: 'SpaceGrotesk_600SemiBold' }}>{saving ? 'Saving…' : 'Save split'}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
