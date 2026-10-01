'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowRight } from 'lucide-react';
import { Empty } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { GroupEditScreen } from '@finapp/ui/finance';

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  updatedAt?: number;
  icon?: string;
  color?: string;
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
  const router = useRouter();
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
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [memberInput, setMemberInput] = React.useState('');
  const [iconDraft, setIconDraft] = React.useState<string>('phosphor:UsersThree');
  const [colorDraft, setColorDraft] = React.useState<string | undefined>();
  const [retentionDraft, setRetentionDraft] = React.useState<number | null>(null);
  const [invitationUrl, setInvitationUrl] = React.useState('');
  const [invitationExpiresAt, setInvitationExpiresAt] = React.useState<number>();
  const [invitationBusy, setInvitationBusy] = React.useState(false);
  const [invitationError, setInvitationError] = React.useState('');
  const [invitationStatus, setInvitationStatus] = React.useState('');
  const createInvitationLink = useMutation(api.groups.mutations.createInvitationLink);
  const revokeInvitationLink = useMutation(api.groups.mutations.revokeInvitationLink);
  async function createInvitation() {
    if (!canManage || !cloudGroupId || invitationBusy) return;
    setInvitationBusy(true);
    setInvitationError('');
    setInvitationStatus('');
    try {
      const result = await createInvitationLink({ groupId: cloudGroupId as Id<'groups'> });
      setInvitationUrl(
        `${window.location.origin}/group-invite?token=${encodeURIComponent(result.token)}`,
      );
      setInvitationExpiresAt(result.expiresAt);
      setInvitationStatus('Invitation link created. The previous link, if any, has been revoked.');
    } catch (cause) {
      setInvitationError(
        cause instanceof Error ? cause.message : 'Could not create an invitation link.',
      );
    } finally {
      setInvitationBusy(false);
    }
  }
  async function revokeInvitation() {
    if (!canManage || !cloudGroupId || invitationBusy) return;
    setInvitationBusy(true);
    setInvitationError('');
    setInvitationStatus('');
    try {
      await revokeInvitationLink({ groupId: cloudGroupId as Id<'groups'> });
      setInvitationUrl('');
      setInvitationExpiresAt(undefined);
      setInvitationStatus('Invitation link revoked.');
    } catch (cause) {
      setInvitationError(
        cause instanceof Error ? cause.message : 'Could not revoke the invitation link.',
      );
    } finally {
      setInvitationBusy(false);
    }
  }
  async function shareInvitation() {
    if (!invitationUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${group?.name ?? 'my group'}`, url: invitationUrl });
        setInvitationStatus('Invitation link shared.');
      } else {
        await navigator.clipboard.writeText(invitationUrl);
        setInvitationStatus('Invitation link copied.');
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name !== 'AbortError')
        setInvitationError('Could not share the link. Select and copy it instead.');
    }
  }
  const updateGroupSettings = useMutation(api.groups.mutations.updateSettings);
  const updateMemberRole = useMutation(api.groups.mutations.setMemberRole);
  const addGroupMember = useMutation(api.groups.mutations.addMember);
  const removeGroupMember = useMutation(api.groups.mutations.removeMember);
  const group = groups.find((item) => aliases(item).includes(routeId));
  const groupIds = group ? aliases(group) : [routeId];
  const currentGroupId = group ? localId(group) : routeId;
  const groupIdentity = group ? String(group.cloudId ?? group._id ?? '') : '';
  const cloudGroupId = groupIdentity.startsWith('local-') ? '' : groupIdentity;
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
        avatarUrl: member.avatarUrl,
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
      remoteGroup
        ? (remoteGroup.icon ?? 'phosphor:UsersThree')
        : typeof group?.icon === 'string'
          ? group.icon
          : 'phosphor:UsersThree',
    );
    setColorDraft(
      remoteGroup ? remoteGroup.color : typeof group?.color === 'string' ? group.color : undefined,
    );
    setRetentionDraft(remoteGroup?.messageRetentionMs ?? null);
  }, [
    group?.color,
    group?.icon,
    remoteGroup?.color,
    remoteGroup?.icon,
    remoteGroup?.messageRetentionMs,
  ]);

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

  async function saveGroupAppearance() {
    if (!canManage || !cloudGroupId || saving || !iconDraft || !colorDraft) return;
    setSaving('appearance');
    setError('');
    try {
      await updateGroupSettings({
        groupId: cloudGroupId as Id<'groups'>,
        icon: iconDraft,
        color: colorDraft,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the group appearance.');
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
    setSuccessMessage('');
    try {
      await addGroupMember({
        groupId: cloudGroupId as Id<'groups'>,
        username: memberInput,
      });
      setMemberInput('');
      setSuccessMessage('Invitation sent. The recipient can accept it from their notifications.');
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
    <GroupEditScreen
      group={{
        id: currentGroupId,
        name: group.name ?? '',
        currency: group.currency ?? '',
        ownerId: group.ownerId,
        archived: group.archivedAt !== undefined,
        icon: remoteGroup?.icon ?? group.icon,
        color: remoteGroup?.color ?? group.color,
      }}
      members={memberRows.map((member) => ({
        id: localId(member),
        userId: String(member.userId ?? member.memberId ?? ''),
        memberId: String(member.memberId ?? ''),
        name: String(member.displayName ?? member.name ?? member.username ?? 'Member'),
        username: typeof member.username === 'string' ? member.username : undefined,
        role: String(member.role ?? 'member'),
        avatarUrl: typeof member.avatarUrl === 'string' ? member.avatarUrl : undefined,
      }))}
      currentRole={currentRole}
      canManage={canManage}
      membersLoading={membersLoading}
      remoteLoaded={Boolean(remoteGroup)}
      error={error || groupsError || membersError || undefined}
      successMessage={successMessage}
      saving={saving}
      cloudGroupId={cloudGroupId}
      name={name}
      onNameChange={setName}
      onSaveName={saveName}
      icon={iconDraft}
      onIconChange={(value) => setIconDraft(value ?? 'phosphor:UsersThree')}
      color={colorDraft}
      onColorChange={setColorDraft}
      onSaveAppearance={saveGroupAppearance}
      retention={retentionDraft}
      onRetentionChange={setRetentionDraft}
      onSaveRetention={saveRetention}
      memberInput={memberInput}
      onMemberInputChange={setMemberInput}
      onAddMember={addMember}
      onChangeRole={(member, role) => void changeRole(member as Member, role)}
      onRemoveMember={(member) => void removeMember(member as Member)}
      onBack={() => router.push(`/group/${encodeURIComponent(currentGroupId)}`)}
      onOpenAnalytics={() => router.push(`/group/${encodeURIComponent(currentGroupId)}/analytics`)}
      invitationUrl={canManage ? invitationUrl : undefined}
      invitationExpiresAt={canManage ? invitationExpiresAt : undefined}
      invitationBusy={invitationBusy}
      invitationError={invitationError}
      invitationStatus={invitationStatus}
      onCreateInvitation={() => void createInvitation()}
      onRevokeInvitation={() => void revokeInvitation()}
      onShareInvitation={() => void shareInvitation()}
    />
  );
}
