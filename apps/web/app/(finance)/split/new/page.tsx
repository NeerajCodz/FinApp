'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
type Member = LocalRecord & { groupId?: string; userId?: string; memberId?: string; username?: string; displayName?: string; name?: string };
type Account = LocalRecord & { name?: string; currency?: string; ownerId?: string; archivedAt?: number };
const aliases = (record: LocalRecord) => [record.id, record._id, record.cloudId].filter((value): value is string => typeof value === 'string');
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function NewSplitPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: groups } = useLocalRecords<Group>('group');
  const { records: memberships } = useLocalRecords<Member>('groupMember');
  const { records: accounts } = useLocalRecords<Account>('account');
  const { records: profiles } = useLocalRecords<LocalRecord>('profile');
  const [groupId, setGroupId] = React.useState('');
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
    const requested = new URLSearchParams(window.location.search).get('groupId');
    if (requested) setGroupId(requested);
    setSelectedIds((current) => current.length ? current : [userId]);
  }, [userId]);

  const activeGroups = groups.filter((item) => item.archivedAt === undefined);
  React.useEffect(() => {
    if (!groupId && activeGroups.length === 1) setGroupId(idOf(activeGroups[0]!));
  }, [activeGroups, groupId]);
  const group = activeGroups.find((item) => aliases(item).includes(groupId));
  const groupIds = group ? aliases(group) : [];
  const currency = group?.currency ?? '';
  const groupMembers: Array<{ userId: string; name: string }> = [];
  if (userId) groupMembers.push({ userId, name: String(profiles[0]?.displayName ?? profiles[0]?.name ?? 'You') });
  const seenMembers = new Set(groupMembers.map((member) => member.userId));
  for (const member of memberships) {
    const memberUserId = member.userId ?? member.memberId;
    if (typeof member.groupId !== 'string' || !groupIds.includes(member.groupId) || typeof memberUserId !== 'string' || seenMembers.has(memberUserId)) continue;
    seenMembers.add(memberUserId);
    groupMembers.push({ userId: memberUserId, name: String(member.displayName ?? member.name ?? (member.username ? `@${member.username}` : `Member ${memberUserId.slice(-6)}`)) });
  }
  const accountOptions = accounts.filter((item) => item.archivedAt === undefined && item.ownerId === userId && item.currency === currency);
  const selectedAccount = accountOptions.find((item) => aliases(item).includes(accountId)) ?? accountOptions[0];
  const participantIds = groupMembers.filter((member) => selectedIds.includes(member.userId)).map((member) => member.userId);
  let totalMinor: bigint | null = null;
  let shares: Array<{ userId: string; amountMinor: bigint }> = [];
  let validation = '';
  if (!userId) validation = 'Sign in before recording a split.';
  else if (!group) validation = 'Choose a saved group.';
  else if (!currency) validation = 'The group currency is unavailable.';
  else if (currency !== 'INR') validation = 'Groups use Indian rupees. This group cannot accept expenses in another currency.';
  else if (!selectedAccount) validation = 'Add or choose an active personal account in the group currency.';
  else if (!title.trim()) validation = 'Enter what this expense was for.';
  else if (!amount.trim()) validation = 'Enter the total amount.';
  else if (!participantIds.length || participantIds.length !== selectedIds.length) validation = 'Choose at least one current group member.';
  else {
    try {
      totalMinor = parseMinor(amount, currency);
      if (totalMinor <= 0n) throw new Error('Enter an amount greater than zero.');
      const values = method === 'equal' ? undefined : participantIds.map((memberId) => {
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
      validation = cause instanceof Error && !['INVALID_SPLIT', 'INVALID_AMOUNT', 'INVALID_CURRENCY'].includes(cause.message)
        ? cause.message
        : method === 'exact' ? 'Exact allocations must add up to the total.' : method === 'percentage' ? 'Percentages must add up to 100%.' : method === 'shares' ? 'Enter at least one positive whole share.' : 'Enter a valid amount.';
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
    if (!userId || !group || !selectedAccount || totalMinor === null || validation || saving) return;
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
        ...(method === 'equal' ? {} : { basisValue: (method === 'shares' ? BigInt(basis[share.userId]!) : parseMinor(basis[share.userId]!, method === 'percentage' ? 'USD' : currency)).toString() }),
      }));
      const cleanTitle = title.trim();
      await commitLocalWrite(userId, 'transaction', 'group.addExpense', {
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
        payerUserId: userId,
        payerAmountMinor: totalMinor,
        participants,
      }, {
        groupId: groupRecordId,
        accountId: accountRecordId,
        title: cleanTitle,
        amountMinor: totalMinor,
        currency,
        occurredAt: now,
        participants,
      }, {
        recordId: transactionId,
        clientMutationId,
        dependencies: [
          ...(groupRecordId.startsWith('local-') ? [`group:${groupRecordId}`] : []),
          ...(accountRecordId.startsWith('local-') ? [`account:${accountRecordId}`] : []),
        ],
      });
      router.replace(`/group/${encodeURIComponent(groupRecordId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this split.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId) return <section className="finance-welcome"><p className="finance-kicker">SHARED EXPENSE</p><h1>Split a cost fairly.</h1><p>Sign in to create an offline-first shared expense for a saved group.</p><Link className="finance-primary-link" href="/sign-in">Sign in <ArrowRight size={16} /></Link></section>;

  return (
    <div className="finance-page">
      <header className="finance-page-heading"><div><Link className="finance-secondary-action" href={groupId ? `/group/${encodeURIComponent(groupId)}` : '/groups'}><ArrowLeft size={15} /> Back</Link><p className="finance-kicker">GROUP EXPENSE</p><h1>Split an expense</h1><p className="finance-muted">The current user pays. Choose how the amount is shared among group members.</p></div><Badge variant="neutral">Saved locally first</Badge></header>
      <div className="finance-accounts-layout">
        <Card className="finance-form-panel"><SectionHeader title="Expense details" action={<UsersRound size={17} />} /><form className="finance-form" onSubmit={saveExpense}>
          <Select label="Group · currency stays INR" options={activeGroups.map((item) => `${item.name ?? 'Group'} · ${item.currency ?? 'INR'}`)} value={group ? `${group.name ?? 'Group'} · ${group.currency ?? 'INR'}` : ''} onChange={(value) => { const selected = activeGroups.find((item) => `${item.name ?? 'Group'} · ${item.currency ?? 'INR'}` === value); if (selected) chooseGroup(idOf(selected)); }} />
          {group && <Select label="Paid from your account" options={accountOptions.map((item) => String(item.name ?? 'Account'))} value={selectedAccount?.name ?? ''} onChange={(value) => { const selected = accountOptions.find((item) => item.name === value); if (selected) setAccountId(idOf(selected)); }} />}
          <FinanceInput label="What was this for?" value={title} onChangeText={setTitle} maxLength={120} placeholder="Dinner after the match" required />
          <FinanceInput label={`Total amount · ${currency || 'group currency'}`} type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChangeText={setAmount} required />
          <Select label="Split method" options={['Equal', 'Exact amounts', 'Percentages', 'Shares']} value={{ equal: 'Equal', exact: 'Exact amounts', percentage: 'Percentages', shares: 'Shares' }[method]} onChange={(value) => { const next: SplitMethod = value === 'Exact amounts' ? 'exact' : value === 'Percentages' ? 'percentage' : value === 'Shares' ? 'shares' : 'equal'; setMethod(next); setBasis({}); }} />
          <section className="finance-form-field"><span>Participants</span>{groupMembers.length ? <ul className="finance-record-list">{groupMembers.map((member) => <li key={member.userId}><label className="finance-checkbox-row"><input type="checkbox" checked={selectedIds.includes(member.userId)} onChange={(event) => setSelectedIds((current) => event.currentTarget.checked ? [...current, member.userId] : current.filter((id) => id !== member.userId))} /><span>{member.userId === userId ? `${member.name} (payer)` : member.name}</span></label></li>)}</ul> : <p className="finance-form-note">No group members are cached. Reconnect and open the group before splitting.</p>}</section>
          {method !== 'equal' && participantIds.map((memberId) => { const member = groupMembers.find((item) => item.userId === memberId); return <FinanceInput key={memberId} label={`${member?.name ?? 'Member'} · ${method === 'shares' ? 'shares' : method === 'percentage' ? 'percent' : currency}`} type="number" min="0" step={method === 'shares' ? '1' : '0.01'} value={basis[memberId] ?? ''} onChangeText={(value) => setBasis((current) => ({ ...current, [memberId]: value }))} required />; })}
          {shares.length > 0 && <Card variant="subtle"><SectionHeader title="Allocation preview" />{shares.map((share) => <p key={share.userId} className="finance-form-note">{groupMembers.find((member) => member.userId === share.userId)?.name ?? 'Member'} · {formatMinor(share.amountMinor, currency)}</p>)}</Card>}
          {validation && <p className="finance-form-error" role="status">{validation}</p>}{error && <p className="finance-form-error" role="alert">{error}</p>}
          <Button type="submit" disabled={saving || Boolean(validation)}>{saving ? 'Saving split…' : 'Save shared expense'} <ArrowRight size={15} /></Button>
          <p className="finance-form-note">This is a group expense, not a personal transaction. Its payer and allocations sync together through the group expense outbox.</p>
        </form></Card>
        <Card className="finance-record-panel"><SectionHeader title="How it works" /><p className="finance-muted">The expense is recorded once, with your account as payer. Participant shares must add up to the total before it can be saved.</p><p className="finance-form-note">Exact amounts, percentages, and shares are validated with the same allocation rules as the mobile app.</p></Card>
      </div>
    </div>
  );
}
