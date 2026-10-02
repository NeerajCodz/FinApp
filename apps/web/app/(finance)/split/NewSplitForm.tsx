'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { allocateParticipants } from '@convex/splits/domain';
import { parseMinor } from '@convex/shared/money';
import { GroupExpenseFormScreen, type GroupExpenseMethod } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  archivedAt?: number;
  icon?: string;
  color?: string;
};
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  username?: string;
  displayName?: string;
  name?: string;
  avatarId?: string;
  avatarUrl?: string | null;
};
type Account = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
};
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export function NewSplitForm({ fixedGroupId }: { fixedGroupId?: string }) {
  const router = useRouter();
  const lockedGroupId = fixedGroupId ?? '';
  const { userId } = useBrowserSync();
  const { records: groups } = useLocalRecords<Group>('group');
  const { records: memberships } = useLocalRecords<Member>('groupMember');
  const { records: accounts } = useLocalRecords<Account>('account');
  const { records: profiles } = useLocalRecords<LocalRecord>('profile');
  const [groupId, setGroupId] = React.useState(lockedGroupId);
  const [accountId, setAccountId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<GroupExpenseMethod>('equal');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [basis, setBasis] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const saveLock = React.useRef(false);
  React.useEffect(() => {
    if (!userId) return;
    setGroupId(lockedGroupId);
    setSelectedIds([userId]);
    setAccountId('');
    setBasis({});
    setError('');
  }, [lockedGroupId, userId]);

  const activeGroups = groups.filter((item) => item.archivedAt === undefined);
  React.useEffect(() => {
    if (!groupId && activeGroups.length === 1) setGroupId(idOf(activeGroups[0]!));
  }, [activeGroups, groupId]);
  const group = activeGroups.find((item) => aliases(item).includes(groupId));
  const groupIds = group ? aliases(group) : [];
  const currency = group?.currency ?? '';
  const groupMembers: Array<{ userId: string; name: string; avatarId?: string; avatarUrl?: string | null }> = [];
  if (userId)
    groupMembers.push({
      userId,
      name: String(profiles[0]?.displayName ?? profiles[0]?.name ?? 'Signed-in member'),
      avatarId: typeof profiles[0]?.avatarId === 'string' ? profiles[0].avatarId : undefined,
      avatarUrl: typeof profiles[0]?.avatarUrl === 'string' ? profiles[0].avatarUrl : null,
    });
  const seenMembers = new Set(groupMembers.map((member) => member.userId));
  for (const member of memberships) {
    const memberUserId = member.userId ?? member.memberId;
    if (
      typeof member.groupId !== 'string' ||
      !groupIds.includes(member.groupId) ||
      typeof memberUserId !== 'string' ||
      seenMembers.has(memberUserId)
    )
      continue;
    seenMembers.add(memberUserId);
    groupMembers.push({
      userId: memberUserId,
      name: String(
        member.displayName ??
          member.name ??
          (member.username ? `@${member.username}` : `Member ${memberUserId.slice(-6)}`),
      ),
      avatarUrl: member.avatarUrl,
      avatarId: typeof member.avatarId === 'string' ? member.avatarId : undefined,
    });
  }
  const accountOptions = accounts.filter(
    (item) =>
      item.archivedAt === undefined && item.ownerId === userId && item.currency === currency,
  );
  const selectedAccount =
    accountOptions.find((item) => aliases(item).includes(accountId)) ??
    (accountOptions.length === 1 ? accountOptions[0] : undefined);
  const participantIds = groupMembers
    .filter((member) => selectedIds.includes(member.userId))
    .map((member) => member.userId);
  let totalMinor: bigint | null = null;
  let shares: Array<{ userId: string; amountMinor: bigint }> = [];
  let validation = '';
  if (!userId) validation = 'Sign in before recording a split.';
  else if (!group) validation = 'Choose a saved group to record this split.';
  else if (!currency) validation = 'This group has no currency.';
  else if (!selectedAccount) validation = 'Choose an account in the group currency.';
  else if (!title.trim()) validation = 'Enter what this expense was for.';
  else if (!amount.trim()) validation = 'Enter the total amount.';
  else if (!participantIds.length || participantIds.length !== selectedIds.length)
    validation = 'Choose at least one current group member.';
  else {
    try {
      totalMinor = parseMinor(amount, currency);
      if (totalMinor <= 0n) throw new Error('Enter an amount greater than zero.');
      const values =
        method === 'equal'
          ? undefined
          : participantIds.map((memberId) => {
              const value = (basis[memberId] ?? '').trim();
              if (!value) throw new Error('Enter a value for every selected member.');
              if (method === 'shares') {
                if (!/^\d+$/.test(value)) throw new Error('Shares must be whole numbers.');
                return BigInt(value);
              }
              const parsed = parseMinor(value, method === 'percentage' ? 'USD' : currency);
              if (parsed < 0n) throw new Error('Split values cannot be negative.');
              return parsed;
            });
      shares = allocateParticipants(totalMinor, participantIds, method, values);
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

  function chooseGroup(nextGroupId: string) {
    setGroupId(nextGroupId);
    setAccountId('');
    setSelectedIds(userId ? [userId] : []);
    setBasis({});
    setError('');
  }

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !userId ||
      !group ||
      !selectedAccount ||
      totalMinor === null ||
      validation ||
      saveLock.current
    )
      return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    try {
      const groupRecordId = idOf(group);
      const accountRecordId = idOf(selectedAccount);
      const now = Date.now();
      const clientMutationId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();
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
      const cleanTitle = title.trim();
      await commitLocalWrite(
        userId,
        'transaction',
        'group.addExpense',
        {
          id: transactionId,
          ownerId: userId,
          groupId: groupRecordId,
          accountId: accountRecordId,
          title: cleanTitle,
          amountMinor: totalMinor,
          currency,
          occurredAt: now,
          createdAt: now,
          type: 'expense',
          status: 'posted',
        },
        {
          groupId: groupRecordId,
          accountId: accountRecordId,
          title: cleanTitle,
          amountMinor: totalMinor,
          currency,
          occurredAt: now,
          participants,
        },
        {
          recordId: transactionId,
          clientMutationId,
          dependencies: [
            ...(!group.cloudId && !group._id ? [`group:${groupRecordId}`] : []),
            ...(!selectedAccount.cloudId && !selectedAccount._id
              ? [`account:${accountRecordId}`]
              : []),
          ],
          relatedRecords: [
            {
              entityType: 'expensePayer',
              record: { transactionId, userId, memberId: userId, amountMinor: totalMinor },
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
      router.replace(`/group/${encodeURIComponent(groupRecordId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this split.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return (
    <GroupExpenseFormScreen
      signedIn={Boolean(userId)}
      fixedGroupId={lockedGroupId || undefined}
      groups={activeGroups.map((item) => ({
        id: idOf(item),
        name: item.name ?? 'Group',
        currency: item.currency,
      }))}
      selectedGroupId={group ? idOf(group) : ''}
      groupName={group?.name}
      groupIcon={group?.icon}
      groupColor={group?.color}
      currency={currency}
      accounts={accountOptions.map((item) => ({
        id: idOf(item),
        name: String(item.name ?? 'Account'),
      }))}
      selectedAccountId={selectedAccount ? idOf(selectedAccount) : ''}
      members={groupMembers}
      payerName={String(profiles[0]?.displayName ?? profiles[0]?.name ?? 'Signed-in member')}
      payerAvatarId={typeof profiles[0]?.avatarId === 'string' ? profiles[0].avatarId : undefined}
      payerAvatarUrl={typeof profiles[0]?.avatarUrl === 'string' ? profiles[0].avatarUrl : null}
      title={title}
      amount={amount}
      method={method}
      selectedMemberIds={selectedIds}
      basis={basis}
      shares={shares}
      totalMinor={totalMinor}
      validation={validation}
      error={error}
      saving={saving}
      onGroupChange={chooseGroup}
      onAccountChange={setAccountId}
      onTitleChange={setTitle}
      onAmountChange={setAmount}
      onMethodChange={(value) => {
        setMethod(value);
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
      onSubmit={saveExpense}
      onBack={() =>
        router.push(
          lockedGroupId
            ? `/group/${encodeURIComponent(lockedGroupId)}`
            : group
              ? `/group/${encodeURIComponent(idOf(group))}`
              : '/groups',
        )
      }
      onCreateGroup={() => router.push('/groups/new')}
      onSignIn={() => router.push('/sign-in')}
    />
  );
}
