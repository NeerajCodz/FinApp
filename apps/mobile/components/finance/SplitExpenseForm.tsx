import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { GroupExpenseFormScreen, useExpenseComposer } from '@finapp/ui/finance';
import { commitLocalWrite } from '@/local/commands';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { displayAccountName, recordId, recordIds } from '@/lib/ledger';
import { useExpenseLedger } from '@/hooks/useExpenseLedger';
import { toast } from '@/lib/toast';
import type { ReceiptReview } from '@finapp/ui/finance';
import { useReceiptScanner } from './useReceiptScanner';

/**
 * New group expense: a stepped composer (amount → details → who paid → split). The server
 * records the person adding an expense as its payer, so payer changes happen in edit mode.
 */
export function SplitExpenseForm({ fixedGroupId }: { fixedGroupId?: string }) {
  const { userId, isConnected } = useLocalSync();
  const [groupId, setGroupId] = useState(fixedGroupId ?? '');
  useEffect(() => {
    if (fixedGroupId) setGroupId(fixedGroupId);
  }, [fixedGroupId]);
  const data = useExpenseLedger(userId, groupId || undefined);
  const group = data.group;
  const selectedGroupId = group ? recordId(group) : '';
  const currency = typeof group?.currency === 'string' ? group.currency : '';
  const compatibleAccounts = data.accounts.filter(
    (item) =>
      item.archivedAt === undefined && item.ownerId === userId && item.currency === currency,
  );
  const findAccount = (id: string) =>
    compatibleAccounts.find((item) => recordIds(item).includes(id));
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
  // Preselect the account when only one matches the group currency.
  const onlyAccountId = compatibleAccounts.length === 1 ? recordId(compatibleAccounts[0]!) : '';
  const { accountId: chosenAccountId, set: setComposerValue } = composer;
  useEffect(() => {
    if (!chosenAccountId && onlyAccountId) setComposerValue('accountId', onlyAccountId);
  }, [chosenAccountId, onlyAccountId, setComposerValue]);
  const account = findAccount(composer.accountId);
  const category = data.categories.find((item) => recordIds(item).includes(composer.categoryId));
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState<ReceiptReview | null>(null);
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
    onCurrencyChange: (fields) => {
      const amounts = new Map(fields.rows.map((row) => [row.id, row.amount]));
      composer.set('amount', fields.amount);
      composer.setItems(
        composer.items.map((row) =>
          amounts.has(row.id) ? { ...row, amount: amounts.get(row.id)! } : row,
        ),
      );
    },
  });

  function chooseGroup(id: string) {
    setGroupId(id);
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

  async function save() {
    const totalMinor = composer.draft.totalMinor;
    if (
      saveLock.current ||
      composer.validation ||
      !userId ||
      !group ||
      !account ||
      totalMinor === null
    )
      return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    try {
      const transactionId = Crypto.randomUUID();
      const title = composer.title.trim();
      const merchant = composer.merchant.trim() || undefined;
      const note = composer.note.trim() || undefined;
      const categoryId = category ? recordId(category) : undefined;
      const participants = composer.draft.participants;
      const items = composer.draft.items;
      await commitLocalWrite(
        userId,
        'transaction',
        'group.addExpense',
        {
          id: transactionId,
          ownerId: userId,
          groupId: selectedGroupId,
          accountId: recordId(account),
          title,
          amountMinor: totalMinor,
          currency,
          occurredAt: composer.occurredAt,
          createdAt: Date.now(),
          type: 'expense',
          status: 'posted',
          version: 1,
          ...(categoryId ? { categoryId } : {}),
          ...(merchant ? { merchant } : {}),
          ...(note ? { note } : {}),
          ...(items.length ? { items } : {}),
        },
        {
          groupId: selectedGroupId,
          accountId: recordId(account),
          title,
          amountMinor: totalMinor,
          currency,
          occurredAt: composer.occurredAt,
          participants,
          ...(categoryId ? { categoryId } : {}),
          ...(merchant ? { merchant } : {}),
          ...(note ? { note } : {}),
          ...(items.length ? { items } : {}),
        },
        {
          clientMutationId: Crypto.randomUUID(),
          dependencies: [
            `group:${selectedGroupId}`,
            `account:${recordId(account)}`,
            ...(category && !category.cloudId && !category._id ? [`category:${categoryId}`] : []),
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
      toast.success('Expense added', {
        description: isConnected ? `${title} was split.` : 'Saved on this device. It syncs later.',
      });
      router.replace(`/group/${selectedGroupId}` as never);
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
      dataError={data.error?.message}
      onRetry={data.retry}
      fixedGroupId={fixedGroupId}
      groups={data.groups
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
      categories={data.categories
        .filter((item) => item.archivedAt === undefined && item.deletedAt === undefined)
        .map((item) => ({
          id: recordId(item),
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
      onSubmit={() => void save()}
      onBack={() => {
        const backGroup = group ? selectedGroupId : fixedGroupId;
        if (backGroup) router.push(`/group/${backGroup}` as never);
        else router.back();
      }}
      onCreateGroup={() => router.push('/groups/new' as never)}
      onSignIn={() => router.push('/(auth)/sign-in' as never)}
      receiptScan={group ? receiptScanner.card : undefined}
      review={review}
      onDismissReview={() => setReview(null)}
    />
  );
}
