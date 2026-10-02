import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { allocateParticipants } from '@convex/splits/domain';
import { GroupExpenseFormScreen, type GroupExpenseMethod } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { parseMinor } from '@/lib/money';
import { displayAccountName, recordId, recordIds } from '@/lib/ledger';

type Member = { userId: string; name: string; avatarUrl?: string | null };
function memberName(record: LocalRecord | undefined, fallback: string): string {
  return String(record?.displayName ?? record?.name ?? record?.username ?? fallback);
}

export function SplitExpenseForm({ fixedGroupId }: { fixedGroupId?: string }) {
  const { userId } = useLocalSync();
  const { data: groups } = useLocalRecords<LocalRecord>(userId, 'group');
  const { data: memberships } = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const { data: accounts } = useLocalRecords<LocalRecord>(userId, 'account');
  const { data: profiles } = useLocalRecords<LocalRecord>(userId, 'profile');
  const [groupId, setGroupId] = useState(fixedGroupId ?? '');
  const [accountId, setAccountId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<GroupExpenseMethod>('equal');
  const [selectedIds, setSelectedIds] = useState<string[]>(userId ? [userId] : []);
  const initializedSelection = useRef(Boolean(userId));
  const [basis, setBasis] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (userId && !initializedSelection.current) {
      initializedSelection.current = true;
      setSelectedIds([userId]);
    }
  }, [userId]);
  useEffect(() => {
    if (fixedGroupId) setGroupId(fixedGroupId);
  }, [fixedGroupId]);

  const group = groups?.find((item) => recordIds(item).includes(groupId));
  const selectedGroupId = group ? recordId(group) : '';
  const currency = typeof group?.currency === 'string' ? group.currency : '';
  const groupIds = new Set(group ? recordIds(group) : []);
  const members: Member[] = [];
  if (userId)
    members.push({
      userId,
      name: memberName(profiles?.[0], 'Signed-in member'),
      avatarUrl: typeof profiles?.[0]?.avatarUrl === 'string' ? profiles[0].avatarUrl : null,
    });
  for (const item of memberships ?? []) {
    const memberId = item.userId ?? item.memberId;
    if (
      typeof item.groupId !== 'string' ||
      !groupIds.has(item.groupId) ||
      typeof memberId !== 'string' ||
      members.some((member) => member.userId === memberId)
    )
      continue;
    members.push({
      userId: memberId,
      name: memberName(item, `Member ${memberId.slice(-6)}`),
      avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : null,
    });
  }
  const compatibleAccounts = (accounts ?? []).filter(
    (item) =>
      item.archivedAt === undefined && item.ownerId === userId && item.currency === currency,
  );
  const account = compatibleAccounts.find((item) => recordIds(item).includes(accountId));
  const payerName = memberName(profiles?.[0], 'Signed-in member');
  const participantIds = members
    .filter((member) => selectedIds.includes(member.userId))
    .map((member) => member.userId);

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
      const values =
        method === 'equal'
          ? undefined
          : participantIds.map((id) => {
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
      validation =
        cause instanceof Error &&
        !['INVALID_SPLIT', 'INVALID_AMOUNT', 'INVALID_CURRENCY'].includes(cause.message)
          ? cause.message
          : method === 'exact'
            ? 'Exact amounts must add up to the total.'
            : method === 'percentage'
              ? 'Percentages must add up to 100%.'
              : method === 'shares'
                ? 'Enter at least one positive whole share.'
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
      const clientMutationId = Crypto.randomUUID();
      const transactionId = Crypto.randomUUID();
      const now = Date.now();
      const participants = shares.map((share) => ({
        ...share,
        method,
        ...(method === 'equal'
          ? {}
          : {
              basisValue: (method === 'shares'
                ? BigInt(basis[share.userId]!)
                : parseMinor(basis[share.userId]!, method === 'percentage' ? 'USD' : currency)
              ).toString(),
            }),
      }));
      await commitLocalWrite(
        userId,
        'transaction',
        'group.addExpense',
        {
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
        },
        {
          groupId: selectedGroupId,
          accountId: recordId(account),
          title: title.trim(),
          amountMinor,
          currency,
          occurredAt: now,
          participants,
        },
        {
          clientMutationId,
          dependencies: [`group:${selectedGroupId}`, `account:${recordId(account)}`],
          relatedRecords: [
            {
              entityType: 'expensePayer',
              record: { transactionId, userId, memberId: userId, amountMinor },
            },
            ...participants.map((participant) => ({
              entityType: 'expenseParticipant' as const,
              record: {
                transactionId,
                userId: participant.userId,
                memberId: participant.userId,
                amountMinor: participant.amountMinor,
                method,
                basisValue: participant.basisValue,
              },
            })),
          ],
        },
      );
      router.replace(`/group/${selectedGroupId}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this split.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <GroupExpenseFormScreen
      signedIn={Boolean(userId)}
      fixedGroupId={fixedGroupId}
      groups={(groups ?? [])
        .filter((item) => item.archivedAt === undefined)
        .map((item) => ({
          id: recordId(item),
          name: String(item.name ?? 'Unnamed group'),
          currency: typeof item.currency === 'string' ? item.currency : undefined,
        }))}
      selectedGroupId={selectedGroupId}
      groupName={typeof group?.name === 'string' ? group.name : undefined}
      groupIcon={typeof group?.icon === 'string' ? group.icon : undefined}
      groupColor={typeof group?.color === 'string' ? group.color : undefined}
      currency={currency}
      accounts={compatibleAccounts.map((item) => ({
        id: recordId(item),
        name: displayAccountName(String(item.name ?? 'Account')),
      }))}
      selectedAccountId={account ? recordId(account) : ''}
      members={members}
      payerName={payerName}
      title={title}
      amount={amount}
      method={method}
      selectedMemberIds={selectedIds}
      basis={basis}
      shares={shares}
      totalMinor={amountMinor}
      validation={validation}
      error={error}
      saving={saving}
      onGroupChange={chooseGroup}
      onAccountChange={setAccountId}
      onTitleChange={setTitle}
      onAmountChange={setAmount}
      onMethodChange={(next) => {
        setMethod(next);
        setBasis({});
      }}
      onParticipantChange={(memberId, selected) =>
        setSelectedIds((current) =>
          selected
            ? current.includes(memberId)
              ? current
              : [...current, memberId]
            : current.filter((id) => id !== memberId),
        )
      }
      onBasisChange={(memberId, value) =>
        setBasis((current) => ({ ...current, [memberId]: value }))
      }
      onSubmit={() => void save()}
      onBack={() => {
        const backGroup = group ? selectedGroupId : fixedGroupId;
        if (backGroup) router.push(`/group/${backGroup}` as never);
        else router.back();
      }}
      onCreateGroup={() => router.push('/groups/new' as never)}
      onSignIn={() => router.push('/(auth)/sign-in' as never)}
    />
  );
}
