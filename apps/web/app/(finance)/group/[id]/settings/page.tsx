'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Pencil, UsersRound } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';

type Group = LocalRecord & { name?: string; currency?: string; ownerId?: string; updatedAt?: number };
type Member = LocalRecord & { groupId?: string; userId?: string; memberId?: string; role?: string; username?: string; displayName?: string; name?: string; updatedAt?: number };
const aliases = (record: LocalRecord) => [record.id, record._id, record.cloudId].filter((value): value is string => typeof value === 'string');
const localId = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function GroupSettingsPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const { userId } = useBrowserSync();
  const { records: groups, loading: groupsLoading, error: groupsError } = useLocalRecords<Group>('group');
  const { records: allMembers, loading: membersLoading, error: membersError } = useLocalRecords<Member>('groupMember');
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState('');
  const [error, setError] = React.useState('');
  const group = groups.find((item) => aliases(item).includes(routeId));
  const groupIds = group ? aliases(group) : [routeId];
  const groupMembers = allMembers.filter((member) => typeof member.groupId === 'string' && groupIds.includes(member.groupId));
  const currentGroupId = group ? localId(group) : routeId;
  const canManage = Boolean(group && userId && (group.ownerId === userId || groupMembers.some((member) => (member.userId ?? member.memberId) === userId && member.role === 'admin') || (!group.ownerId && !groupMembers.length)));

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !group || saving) return;
    if (!name.trim()) { setError('Enter a group name.'); return; }
    const payloadGroupId = String(group._id ?? group.cloudId ?? group.id ?? '');
    setSaving('name');
    setError('');
    try {
      await commitLocalWrite(userId, 'group', 'group.update', { ...group, name: name.trim() }, { groupId: payloadGroupId, name: name.trim() }, { recordId: currentGroupId, dependencies: group._id || group.cloudId ? [] : [`group:${payloadGroupId}`], baseUpdatedAt: typeof group.updatedAt === 'number' ? group.updatedAt : undefined });
      setEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this group.'); }
    finally { setSaving(''); }
  }

  async function changeRole(member: Member, role: 'admin' | 'member') {
    if (!userId || !group || saving) return;
    const memberUserId = String(member.userId ?? member.memberId ?? '');
    const memberId = localId(member);
    if (!memberUserId || !memberId) return;
    const payloadGroupId = String(group._id ?? group.cloudId ?? group.id ?? '');
    setSaving(memberId);
    setError('');
    try {
      await commitLocalWrite(userId, 'groupMember', 'group.setMemberRole', { ...member, role }, { groupId: payloadGroupId, memberUserId, role }, { recordId: memberId, dependencies: group._id || group.cloudId ? [] : [`group:${payloadGroupId}`], baseUpdatedAt: typeof member.updatedAt === 'number' ? member.updatedAt : undefined });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this member role.'); }
    finally { setSaving(''); }
  }

  if (!userId) return <section className="finance-welcome"><p className="finance-kicker">GROUP SETTINGS</p><h1>Keep the group in order.</h1><p>Sign in to manage locally saved group details and member roles.</p><Link className="finance-primary-link" href="/sign-in">Sign in <ArrowRight size={16} /></Link></section>;
  if (groupsLoading && !group) return <div className="finance-page"><p className="finance-muted" role="status">Opening saved group…</p></div>;
  if (!group) return <div className="finance-page"><Link className="finance-secondary-action" href="/groups">‹ Groups</Link><Empty title="Group unavailable offline" description={groupsError ? `Local group data could not be read: ${groupsError}` : 'Reconnect to refresh this group on the device.'} /></div>;

  return (
    <div className="finance-page">
      <header className="finance-page-heading"><div><Link className="finance-secondary-action" href={`/group/${encodeURIComponent(currentGroupId)}`}>‹ {group.name ?? 'Group'}</Link><p className="finance-kicker">GROUP ADMINISTRATION</p><h1>Settings</h1><p className="finance-muted">Currency remains fixed to INR for the life of this group.</p></div><Badge variant={canManage ? 'success' : 'neutral'}>{canManage ? 'Manager' : 'Member'}</Badge></header>
      {(error || groupsError || membersError) && <p className="finance-form-error" role="alert">{error || groupsError || membersError}</p>}
      <Card className="finance-form-panel"><SectionHeader title="Group identity" action={<Badge variant="neutral">INR</Badge>} />{editing ? <form className="finance-form" onSubmit={saveName}><FinanceInput label="Group name" value={name} onChangeText={setName} maxLength={80} required disabled={!canManage} /><p className="finance-form-note">Group currency cannot be changed.</p><div className="finance-page-actions"><Button type="submit" disabled={!canManage || saving === 'name'}>{saving === 'name' ? 'Saving…' : 'Save name'} <Check size={15} /></Button><Button type="button" variant="outline" onPress={() => setEditing(false)}>Cancel</Button></div></form> : <div className="finance-record-copy"><strong>{group.name ?? 'Shared group'}</strong><small>Currency · Indian rupee (INR)</small>{canManage && <Button variant="outline" onPress={() => { setName(group.name ?? ''); setEditing(true); }}><Pencil size={15} /> Rename group</Button>}</div>}</Card>
      <Card className="finance-record-panel"><SectionHeader title="Members" action={<UsersRound size={17} />} />{membersLoading ? <p className="finance-muted" role="status">Loading saved membership…</p> : groupMembers.length ? <ul className="finance-record-list">{groupMembers.map((member) => { const memberUserId = String(member.userId ?? member.memberId ?? localId(member)); const isOwner = member.role === 'owner' || group.ownerId === memberUserId; const role = member.role ?? (group.ownerId === memberUserId ? 'owner' : 'member'); return <li key={localId(member)}><span className="finance-record-copy"><strong>{memberUserId === userId ? 'You' : member.displayName ?? member.name ?? (member.username ? `@${member.username}` : `Member ${memberUserId.slice(-6)}`)}</strong><small>{member.username ? `@${member.username} · ` : ''}{role}</small></span>{canManage && !isOwner && <Button size="sm" variant="outline" disabled={Boolean(saving)} onPress={() => changeRole(member, role === 'admin' ? 'member' : 'admin')}>{saving === localId(member) ? 'Saving…' : role === 'admin' ? 'Remove admin' : 'Make admin'}</Button>}</li>; })}</ul> : <Empty title="Membership is not cached yet" description="Member details appear after the group range or initial sync completes." />}</Card>
    </div>
  );
}
