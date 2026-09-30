'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowLeft, ArrowRight, Check, Pencil } from 'lucide-react';
import { Avatar, Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import { EntityIcon, EntityIconPicker } from '@finapp/ui/finance';

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  updatedAt?: number;
  icon?: string;
  messageRetentionMs?: number;
};
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  role?: string;
  username?: string;
  displayName?: string;
  name?: string;
  updatedAt?: number;
};
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const localId = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function GroupSettingsPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const { userId } = useBrowserSync();
  const {
    records: groups,
    loading: groupsLoading,
    error: groupsError,
  } = useLocalRecords<Group>('group');
  const {
    records: allMembers,
    loading: membersLoading,
    error: membersError,
  } = useLocalRecords<Member>('groupMember');
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState('');
  const [error, setError] = React.useState('');
  const [memberInput, setMemberInput] = React.useState('');
  const [iconDraft, setIconDraft] = React.useState<string>();
  const [retentionDraft, setRetentionDraft] = React.useState<number | null>(null);
  const updateGroupSettings = useMutation(api.groups.mutations.updateSettings);
  const updateMemberRole = useMutation(api.groups.mutations.setMemberRole);
  const addGroupMember = useMutation(api.groups.mutations.addMember);
  const removeGroupMember = useMutation(api.groups.mutations.removeMember);
  const group = groups.find((item) => aliases(item).includes(routeId));
  const groupIds = group ? aliases(group) : [routeId];
  const currentGroupId = group ? localId(group) : routeId;
  const cloudGroupId = group ? String(group.cloudId ?? group._id ?? '') : '';
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    cloudGroupId ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const localMembers = allMembers.filter(
    (member) => typeof member.groupId === 'string' && groupIds.includes(member.groupId),
  );
  const groupMembers: Member[] = remoteGroup
    ? remoteGroup.members.map((member) => ({
        id: member.id,
        groupId: cloudGroupId,
        userId: member.id,
        role: member.role,
        username: member.username,
        displayName: member.displayName,
      }))
    : localMembers;
  const remoteRole = remoteGroup?.members.find((member) => member.id === userId)?.role;
  const canManage = Boolean(
    remoteGroup && userId && (remoteGroup.ownerId === userId || remoteRole === 'admin'),
  );
  const currentRole =
    remoteGroup?.ownerId === userId ? 'Owner' : remoteRole === 'admin' ? 'Admin' : 'Member';
  const memberRows: Member[] = groupMembers.length
    ? groupMembers
    : [
        {
          id: `${currentGroupId}:owner`,
          groupId: currentGroupId,
          userId: String(group?.ownerId ?? userId ?? ''),
          displayName: 'You',
          role: 'owner',
        },
      ];
  React.useEffect(() => {
    setIconDraft(
      remoteGroup ? remoteGroup.icon : typeof group?.icon === 'string' ? group.icon : undefined,
    );
    setRetentionDraft(remoteGroup?.messageRetentionMs ?? null);
  }, [group?.icon, remoteGroup?.icon, remoteGroup?.messageRetentionMs]);

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !group || saving) return;
    if (!name.trim()) {
      setError('Enter a group name.');
      return;
    }
    const payloadGroupId = String(group._id ?? group.cloudId ?? group.id ?? '');
    setSaving('name');
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'group',
        'group.update',
        { ...group, name: name.trim() },
        { groupId: payloadGroupId, name: name.trim() },
        {
          recordId: currentGroupId,
          dependencies: group._id || group.cloudId ? [] : [`group:${payloadGroupId}`],
          baseUpdatedAt: typeof group.updatedAt === 'number' ? group.updatedAt : undefined,
        },
      );
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this group.');
    } finally {
      setSaving('');
    }
  }

  async function changeRole(member: Member, role: 'admin' | 'member') {
    if (!canManage || !cloudGroupId || saving) return;
    const memberUserId = String(member.userId ?? member.memberId ?? '');
    const memberId = localId(member);
    if (!memberUserId || !memberId) return;
    setSaving(memberId);
    setError('');
    try {
      await updateMemberRole({
        groupId: cloudGroupId as Id<'groups'>,
        memberUserId: memberUserId as Id<'users'>,
        role,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this member role.');
    } finally {
      setSaving('');
    }
  }

  async function saveGroupIcon() {
    if (!canManage || !cloudGroupId || saving) return;
    setSaving('icon');
    setError('');
    try {
      await updateGroupSettings({
        groupId: cloudGroupId as Id<'groups'>,
        icon: iconDraft ?? null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the group icon.');
    } finally {
      setSaving('');
    }
  }

  async function saveRetention() {
    if (!canManage || !cloudGroupId || saving) return;
    setSaving('retention');
    setError('');
    try {
      await updateGroupSettings({
        groupId: cloudGroupId as Id<'groups'>,
        messageRetentionMs: retentionDraft,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update message retention.');
    } finally {
      setSaving('');
    }
  }

  async function addMember() {
    if (!canManage || !cloudGroupId || saving) return;
    setSaving('member-add');
    setError('');
    try {
      const result = await addGroupMember({
        groupId: cloudGroupId as Id<'groups'>,
        username: memberInput,
      });
      setMemberInput('');
      if (!result) setError('No account matched; an invite was created for that username.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add this member.');
    } finally {
      setSaving('');
    }
  }

  async function removeMember(member: Member) {
    if (!canManage || !cloudGroupId || saving) return;
    const memberUserId = String(member.userId ?? member.memberId ?? '');
    if (!memberUserId) return;
    const memberId = localId(member);
    setSaving(memberId);
    setError('');
    try {
      await removeGroupMember({
        groupId: cloudGroupId as Id<'groups'>,
        memberUserId: memberUserId as Id<'users'>,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this member.');
    } finally {
      setSaving('');
    }
  }

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">GROUP SETTINGS</p>
        <h1>Keep the group in order.</h1>
        <p>Sign in to manage locally saved group details and member roles.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  if (groupsLoading && !group)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Opening saved group…
        </p>
      </div>
    );
  if (!group)
    return (
      <div className="finance-page">
        <Link className="finance-secondary-action" href="/groups">
          ‹ Groups
        </Link>
        <Empty
          title="Group unavailable offline"
          description={
            groupsError
              ? `Local group data could not be read: ${groupsError}`
              : 'Reconnect to refresh this group on the device.'
          }
        />
      </div>
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            className="finance-secondary-action"
            href={`/group/${encodeURIComponent(currentGroupId)}`}
            aria-label="Back to group"
          >
            <ArrowLeft size={18} />
          </Link>
          <EntityIcon
            value={
              remoteGroup
                ? (remoteGroup.icon ?? 'lucide:UsersRound')
                : (group.icon ?? 'lucide:UsersRound')
            }
            size={24}
          />
          <div>
            <p className="finance-kicker">GROUP MANAGEMENT</p>
            <h1 style={{ margin: 0 }}>Settings</h1>
          </div>
        </div>
      </header>
      {(error || groupsError || membersError) && (
        <p className="finance-form-error" role="alert">
          {error || groupsError || membersError}
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title={group.name ?? 'Group'}
          action={
            <Badge variant="neutral">
              {group.archivedAt === undefined ? 'Active group' : 'Archived group'}
            </Badge>
          }
        />
        <p className="finance-muted">
          {groupMembers.length || 1} {(groupMembers.length || 1) === 1 ? 'member' : 'members'}
        </p>
        <div className="finance-page-actions">
          <span className="finance-form-note">Your access</span>
          <Badge variant={currentRole === 'Member' ? 'neutral' : 'success'}>{currentRole}</Badge>
        </div>
      </Card>
      <Card className="finance-form-panel">
        <SectionHeader title="General" />
        <p className="finance-form-note">
          Owners and admins can rename the group. Currency stays fixed for existing splits.
        </p>
        {editing ? (
          <form className="finance-form" onSubmit={saveName}>
            <FinanceInput
              label="Group name"
              value={name}
              onChangeText={setName}
              maxLength={80}
              required
              disabled={!canManage}
            />
            <p className="finance-form-note">
              Currency · {group.currency ?? 'INR'}. Kept fixed so existing split amounts stay
              consistent.
            </p>
            <div className="finance-page-actions">
              <Button type="submit" disabled={!canManage || saving === 'name'}>
                {saving === 'name' ? 'Saving…' : 'Save name'} <Check size={15} />
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving === 'name'}
                onPress={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="finance-record-copy">
            <strong>Group name</strong>
            <small>{group.name ?? 'Shared group'}</small>
            <small>Currency · {group.currency ?? 'INR'}</small>
            <small>Kept fixed so existing split amounts stay consistent.</small>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Edit group name"
                onPress={() => {
                  setName(group.name ?? '');
                  setEditing(true);
                }}
              >
                <Pencil size={18} />
              </Button>
            )}
          </div>
        )}
      </Card>
      {canManage && (
        <Card className="finance-form-panel">
          <SectionHeader title="Appearance & chat" />
          <p className="finance-form-note">
            Icon and chat retention changes require an internet connection.
          </p>
          <div className="finance-form-field">
            <span>Group icon</span>
            <EntityIconPicker
              mode="either"
              value={iconDraft}
              onChange={setIconDraft}
              label="Group icon"
              compact
              allowClear
            />
            <Button disabled={Boolean(saving) || !cloudGroupId} onPress={saveGroupIcon}>
              {saving === 'icon' ? 'Saving…' : 'Save icon'}
            </Button>
          </div>
          <label className="finance-form-field">
            <span>Disappearing messages</span>
            <select
              aria-label="Disappearing message retention"
              value={retentionDraft === null ? '' : String(retentionDraft)}
              onChange={(event) =>
                setRetentionDraft(
                  event.currentTarget.value ? Number(event.currentTarget.value) : null,
                )
              }
            >
              <option value="">Never</option>
              <option value="86400000">1 day</option>
              <option value="604800000">7 days</option>
              <option value="2592000000">30 days</option>
            </select>
          </label>
          <p className="finance-form-note">
            Existing and new messages, including bill images, are deleted when their retention
            expires.
          </p>
          <Button disabled={Boolean(saving) || !cloudGroupId} onPress={saveRetention}>
            {saving === 'retention' ? 'Saving…' : 'Save retention'}
          </Button>
        </Card>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title="Members"
          action={<Badge variant="neutral">{groupMembers.length || 1} total</Badge>}
        />
        {canManage && (
          <div className="finance-form-row" style={{ marginBlock: 14 }}>
            <input
              aria-label="Add member username"
              value={memberInput}
              onChange={(event) => setMemberInput(event.currentTarget.value)}
              placeholder="@username"
              autoComplete="off"
            />
            <Button
              type="button"
              disabled={Boolean(saving) || !memberInput.trim()}
              onPress={addMember}
            >
              {saving === 'member-add' ? 'Adding…' : 'Add member'}
            </Button>
          </div>
        )}
        {membersLoading && !remoteGroup ? (
          <p className="finance-muted" role="status">
            Loading saved membership…
          </p>
        ) : memberRows.length ? (
          <ul className="finance-record-list">
            {memberRows.map((member) => {
              const memberUserId = String(member.userId ?? member.memberId ?? localId(member));
              const isOwner = member.role === 'owner' || group.ownerId === memberUserId;
              const role = member.role ?? (group.ownerId === memberUserId ? 'owner' : 'member');
              const memberName = String(
                member.displayName ?? member.name ?? member.username ?? 'Member',
              );
              return (
                <li key={localId(member) || memberUserId}>
                  <Avatar
                    initials={memberName
                      .split(/\s+/)
                      .map((part) => part[0] ?? '')
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                    label={memberName}
                    size={42}
                  />
                  <span className="finance-record-copy">
                    <strong>{memberName}</strong>
                    <small>
                      {isOwner ? 'Group owner' : role === 'admin' ? 'Group admin' : 'Member'}
                    </small>
                  </span>
                  {canManage && !isOwner && (
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(saving)}
                        onPress={() => changeRole(member, role === 'admin' ? 'member' : 'admin')}
                      >
                        {saving === localId(member)
                          ? 'Saving…'
                          : role === 'admin'
                            ? 'Remove admin'
                            : 'Make admin'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(saving)}
                        onPress={() => removeMember(member)}
                      >
                        {saving === localId(member) ? 'Removing…' : 'Remove'}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            title="Membership is not cached yet"
            description="Member details appear after the group range or initial sync completes."
          />
        )}
        <p className="finance-form-note">
          Owners and admins can manage members, the group icon, and disappearing-message retention.
        </p>
        <p className="finance-form-note">
          Group name changes save locally and sync when connected.
        </p>
      </Card>
    </div>
  );
}
