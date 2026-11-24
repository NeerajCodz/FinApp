'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { GroupExpenseFormScreen, useExpenseComposer } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { aliases, idOf, useGroupLedger } from '@/lib/groupLedger';
import type { ReceiptReview } from '@finapp/ui/finance';
import { useReceiptScanner } from '@/components/finance/useReceiptScanner';

const unsynced = (record: LocalRecord) => !record.cloudId && !record._id;

/**
 * New group expense: a stepped composer (amount → details → who paid → split). The server
 * records the person adding an expense as its payer, so payer changes happen in edit mode.
 */
export function NewSplitForm({ fixedGroupId }: { fixedGroupId?: string }) {
  const router = useRouter();
  const lockedGroupId = fixedGroupId ?? '';
  const { userId, isConnected } = useBrowserSync();
  const [groupId, setGroupId] = React.useState(lockedGroupId);
  React.useEffect(() => setGroupId(lockedGroupId), [lockedGroupId]);
  const data = useGroupLedger(groupId || undefined);
  const activeGroups = data.groups.filter((item) => item.archivedAt === undefined);
  React.useEffect(() => {
    if (!groupId && activeGroups.length === 1) setGroupId(idOf(activeGroups[0]!));
  }, [activeGroups, groupId]);
  const group = data.group;
  const currency = typeof group?.currency === 'string' ? group.currency : '';
  const accountOptions = data.accounts.filter(
    (item) =>
      item.archivedAt === undefined && item.ownerId === userId && item.currency === currency,
  );
  const findAccount = (id: string) => accountOptions.find((item) => aliases(item).includes(id));
  const composer = useExpenseComposer({
    currency,
    currentUserId: userId,
    memberIds: data.members.map((member) => member.userId),
    detailsError: (values) =>
      !group
        ? 'Choose a group first.'
        : !currency
          ? 'This group has no currency.'
          : findAccount(values.accountId)
            ? ''
            : 'Choose an account in the group currency.',
  });
  const onlyAccountId = accountOptions.length === 1 ? idOf(accountOptions[0]!) : '';
  const { accountId: chosenAccountId, set: setComposerValue } = composer;
  React.useEffect(() => {
    if (!chosenAccountId && onlyAccountId) setComposerValue('accountId', onlyAccountId);
  }, [chosenAccountId, onlyAccountId, setComposerValue]);
  const account = findAccount(composer.accountId);
  const category = data.categories.find((item) => aliases(item).includes(composer.categoryId));
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [review, setReview] = React.useState<ReceiptReview | null>(null);
  const receiptScanner = useReceiptScanner({
    currency,
    disabled: saving || !group || !isConnected,
    onReview: setReview,
    onFields: (fields, scanReview) => {
      // Scanned bills open as an itemized expense split "By item".
      composer.reset({
        title: fields.title,
        merchant: fields.merchant,
        ...(fields.occurredAt !== null ? { occurredAt: fields.occurredAt } : {}),
        itemize: true,
        items: fields.rows,
        method: 'itemized',
        basis: {},
        ...(fields.categoryId ? { categoryId: fields.categoryId } : {}),
      });
      setReview(scanReview);
    },
  });
  const saveLock = React.useRef(false);

  function chooseGroup(nextGroupId: string) {
    setGroupId(nextGroupId);
    composer.reset({
      accountId: '',
      participantIds: userId ? [userId] : [],
      payerIds: userId ? [userId] : [],
      basis: {},
      payerAmounts: {},
      items: composer.items.map((item) => ({ ...item, participantIds: null })),
    });
    setError('');
  }

  async function saveExpense() {
    const totalMinor = composer.draft.totalMinor;
    if (!userId || !group || !account || totalMinor === null || composer.validation) return;
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    try {
      const groupRecordId = idOf(group);
      const accountRecordId = idOf(account);
      const transactionId = crypto.randomUUID();
      const title = composer.title.trim();
      const merchant = composer.merchant.trim() || undefined;
      const note = composer.note.trim() || undefined;
      const categoryId = category ? idOf(category) : undefined;
      const participants = composer.draft.participants;
      const items = composer.draft.items;
      const optional = {
        ...(categoryId ? { categoryId } : {}),
        ...(merchant ? { merchant } : {}),
        ...(note ? { note } : {}),
        ...(items.length ? { items } : {}),
      };
      await commitLocalWrite(
        userId,
        'transaction',
        'group.addExpense',
        {
          id: transactionId,
          ownerId: userId,
          groupId: groupRecordId,
          accountId: accountRecordId,
          title,
          amountMinor: totalMinor,
          currency,
          occurredAt: composer.occurredAt,
          createdAt: Date.now(),
          type: 'expense',
          status: 'posted',
          version: 1,
          ...optional,
        },
        {
          groupId: groupRecordId,
          accountId: accountRecordId,
          title,
          amountMinor: totalMinor,
          currency,
          occurredAt: composer.occurredAt,
          participants,
          ...optional,
        },
        {
          recordId: transactionId,
          clientMutationId: crypto.randomUUID(),
          dependencies: [
            ...(unsynced(group) ? [`group:${groupRecordId}`] : []),
            ...(unsynced(account) ? [`account:${accountRecordId}`] : []),
            ...(category && unsynced(category) ? [`category:${categoryId}`] : []),
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
                method: participant.method,
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
      loading={Boolean(userId) && data.loading}
      dataError={data.error}
      fixedGroupId={lockedGroupId || undefined}
      groups={activeGroups.map((item) => ({
        id: idOf(item),
        name: String(item.name ?? 'Group'),
        currency: typeof item.currency === 'string' ? item.currency : undefined,
      }))}
      selectedGroupId={group ? idOf(group) : ''}
      groupName={typeof group?.name === 'string' ? group.name : undefined}
      groupIcon={typeof group?.icon === 'string' ? group.icon : undefined}
      groupColor={typeof group?.color === 'string' ? group.color : undefined}
      currency={currency}
      accounts={accountOptions.map((item) => ({
        id: idOf(item),
        name: String(item.name ?? 'Account'),
      }))}
      categories={data.categories
        .filter(
          (item) =>
            item.ownerId === userId &&
            item.archivedAt === undefined &&
            item.deletedAt === undefined,
        )
        .map((item) => ({
          id: idOf(item),
          name: String(item.name ?? 'Category'),
          icon: typeof item.icon === 'string' ? item.icon : undefined,
          color: typeof item.color === 'string' ? item.color : undefined,
        }))}
      members={data.members}
      currentUserId={userId}
      composer={composer}
      payerEditable={false}
      offline={!isConnected}
      error={error}
      saving={saving}
      onGroupChange={chooseGroup}
      onSubmit={() => void saveExpense()}
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
      receiptScan={group ? receiptScanner.card : undefined}
      review={review}
      onDismissReview={() => setReview(null)}
    />
  );
}
