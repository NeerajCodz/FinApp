'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { allocateParticipants } from '@convex/splits/domain';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { ArrowLeft, ArrowRight, UsersRound } from 'lucide-react';
import { Badge, Button, Card, SectionHeader, Select } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';

type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';
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
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function NewSplitPage() {
  return (
    <React.Suspense
      fallback={
        <div className="finance-page">
          <p className="finance-muted" role="status">
            Opening split form…
          </p>
        </div>
      }
    >
      <NewSplitForm />
    </React.Suspense>
  );
}

function NewSplitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedGroupId = searchParams.get('groupId') ?? '';
  const { userId } = useBrowserSync();
  const { records: groups } = useLocalRecords<Group>('group');
  const { records: memberships } = useLocalRecords<Member>('groupMember');
  const { records: accounts } = useLocalRecords<Account>('account');
  const { records: profiles } = useLocalRecords<LocalRecord>('profile');
  const [groupId, setGroupId] = React.useState(requestedGroupId);
  const [accountId, setAccountId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<SplitMethod>('equal');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [basis, setBasis] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!userId) return;
    setGroupId(requestedGroupId);
    setSelectedIds([userId]);
    setAccountId('');
    setBasis({});
    setError('');
  }, [requestedGroupId, userId]);

  const activeGroups = groups.filter((item) => item.archivedAt === undefined);
  React.useEffect(() => {
    if (!groupId && activeGroups.length === 1) setGroupId(idOf(activeGroups[0]!));
  }, [activeGroups, groupId]);
  const group = activeGroups.find((item) => aliases(item).includes(groupId));
  const groupIds = group ? aliases(group) : [];
  const currency = group?.currency ?? '';
  const groupMembers: Array<{ userId: string; name: string }> = [];
  if (userId)
    groupMembers.push({
      userId,
      name: String(profiles[0]?.displayName ?? profiles[0]?.name ?? 'Signed-in member'),
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
  else if (!group) validation = 'Choose a saved group.';
  else if (!currency) validation = 'The group currency is unavailable.';
  else if (!selectedAccount)
    validation = 'Add or choose an active personal account in the group currency.';
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
              if (!value) throw new Error('Enter a split value for every selected member.');
              if (method === 'shares') {
                if (!/^\d+$/.test(value)) throw new Error('Shares must be positive whole numbers.');
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
            ? 'Exact allocations must add up to the total.'
            : method === 'percentage'
              ? 'Percentages must add up to 100%.'
              : method === 'shares'
                ? 'Enter at least one positive whole share.'
                : 'Enter a valid amount.';
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
    if (!userId || !group || !selectedAccount || totalMinor === null || validation || saving)
      return;
    setSaving(true);
    setError('');
    try {
      const groupRecordId = idOf(group);
      const accountRecordId = idOf(selectedAccount);
      const now = Date.now();
      const clientMutationId = crypto.randomUUID().replaceAll('-', '');
      const transactionId = `local-${clientMutationId}`;
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
            ...(groupRecordId.startsWith('local-') ? [`group:${groupRecordId}`] : []),
            ...(accountRecordId.startsWith('local-') ? [`account:${accountRecordId}`] : []),
          ],
          relatedRecords: [
            {
              entityType: 'expensePayer',
              record: {
                transactionId,
                userId,
                memberId: userId,
                amountMinor: totalMinor,
              },
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
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">SHARED EXPENSE</p>
        <h1>Split a cost fairly.</h1>
        <p>Sign in to create an offline-first shared expense for a saved group.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <Link
            className="finance-secondary-action"
            href={groupId ? `/group/${encodeURIComponent(groupId)}` : '/groups'}
          >
            <ArrowLeft size={15} /> Back
          </Link>
          <p className="finance-kicker">GROUP EXPENSE</p>
          <h1>Split expense</h1>
          <p className="finance-muted">
            The current user pays. Choose how the amount is shared among group members.
          </p>
        </div>
        <Badge variant="neutral">Saved locally first</Badge>
      </header>
      <div className="finance-accounts-layout">
        <Card className="finance-form-panel">
          <SectionHeader title="Expense details" action={<UsersRound size={17} />} />
          <form className="finance-form" onSubmit={saveExpense}>
            <Select
              label="Group"
              options={activeGroups.map(
                (item) => `${item.name ?? 'Group'} · ${item.currency ?? 'INR'}`,
              )}
              value={group ? `${group.name ?? 'Group'} · ${group.currency ?? 'INR'}` : ''}
              onChange={(value) => {
                const selected = activeGroups.find(
                  (item) => `${item.name ?? 'Group'} · ${item.currency ?? 'INR'}` === value,
                );
                if (selected) chooseGroup(idOf(selected));
              }}
            />
            {!activeGroups.length && <p className="finance-form-note">No saved groups yet.</p>}
            <Link className="finance-secondary-action" href="/group/new">
              Create a group <ArrowRight size={15} />
            </Link>
            {group && (
              <>
                <FinanceInput
                  label={`Total amount · ${currency}`}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChangeText={setAmount}
                  required
                />
                <FinanceInput
                  label="What was it for?"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                  placeholder="Dinner after the match"
                  required
                />
                <div className="finance-form-field">
                  <span>Paid by</span>
                  <strong>
                    {String(profiles[0]?.displayName ?? profiles[0]?.name ?? 'Signed-in member')}
                  </strong>
                  <p className="finance-form-note">
                    Recorded from your account. Another payer is not supported here.
                  </p>
                </div>
                <Select
                  label={`Account in ${currency}`}
                  options={accountOptions.map((item) => String(item.name ?? 'Account'))}
                  value={selectedAccount?.name ?? ''}
                  onChange={(value) => {
                    const selected = accountOptions.find((item) => item.name === value);
                    if (selected) setAccountId(idOf(selected));
                  }}
                />
                {!accountOptions.length && (
                  <p className="finance-form-note">
                    No account uses {currency}. Add one before saving a split.
                  </p>
                )}
                <Select
                  label="Split method"
                  options={['Equal', 'Exact', '%', 'Shares']}
                  value={
                    {
                      equal: 'Equal',
                      exact: 'Exact',
                      percentage: '%',
                      shares: 'Shares',
                    }[method]
                  }
                  onChange={(value) => {
                    const next: SplitMethod =
                      value === 'Exact'
                        ? 'exact'
                        : value === '%'
                          ? 'percentage'
                          : value === 'Shares'
                            ? 'shares'
                            : 'equal';
                    setMethod(next);
                    setBasis({});
                  }}
                />
                <section className="finance-form-field">
                  <span>Group members sharing this expense</span>
                  <ul className="finance-record-list">
                    {groupMembers.map((member) => {
                      const share = shares.find((item) => item.userId === member.userId);
                      return (
                        <li key={member.userId}>
                          <label className="finance-checkbox-row">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(member.userId)}
                              onChange={(event) => {
                                const checked = event.currentTarget.checked;
                                setSelectedIds((current) =>
                                  checked
                                    ? [...current, member.userId]
                                    : current.filter((id) => id !== member.userId),
                                );
                              }}
                            />
                            <span>{member.name}</span>
                            {share && <small>{formatMinor(share.amountMinor, currency)}</small>}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {groupMembers.length === 1 && (
                    <p className="finance-form-note">
                      Other group members will be available once their memberships are saved on this
                      device.
                    </p>
                  )}
                </section>
                {method !== 'equal' &&
                  participantIds.map((memberId) => {
                    const member = groupMembers.find((item) => item.userId === memberId);
                    return (
                      <FinanceInput
                        key={memberId}
                        label={
                          method === 'exact'
                            ? `Amount for ${member?.name ?? 'Member'}`
                            : method === 'percentage'
                              ? `Percentage for ${member?.name ?? 'Member'}`
                              : `Shares for ${member?.name ?? 'Member'}`
                        }
                        type="number"
                        min="0"
                        step={method === 'shares' ? '1' : '0.01'}
                        placeholder={
                          method === 'percentage'
                            ? '0–100%'
                            : method === 'shares'
                              ? 'Whole shares'
                              : currency
                        }
                        value={basis[memberId] ?? ''}
                        onChangeText={(value) =>
                          setBasis((current) => ({ ...current, [memberId]: value }))
                        }
                        required
                      />
                    );
                  })}
                <SectionHeader
                  title="Total"
                  action={
                    <strong className="finance-record-amount">
                      {totalMinor !== null ? formatMinor(totalMinor, currency) : currency}
                    </strong>
                  }
                />
              </>
            )}
            {validation && (
              <p className="finance-form-error" role="alert">
                {validation}
              </p>
            )}
            {error && (
              <p className="finance-form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={saving || Boolean(validation)}>
              {saving ? 'Saving…' : 'Save split'} <ArrowRight size={15} />
            </Button>
            <p className="finance-form-note">
              This is a group expense, not a personal transaction. Its payer and allocations sync
              together through the group expense outbox.
            </p>
          </form>
        </Card>
        <Card className="finance-record-panel">
          <SectionHeader title="How it works" />
          <p className="finance-muted">
            The expense is recorded once, with your account as payer. Participant shares must add up
            to the total before it can be saved.
          </p>
          <p className="finance-form-note">
            Exact amounts, percentages, and shares are validated with the same allocation rules as
            the mobile app.
          </p>
        </Card>
      </div>
    </div>
  );
}
