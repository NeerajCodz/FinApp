import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { commitLocalWrite } from '@/local/commands';
import { recordId, recordIds } from '@/lib/ledger';
import { GroupEditScreen } from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';

export default function GroupSettingsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId } = useLocalSync();
  const groupState = useLocalRecords<LocalRecord>(userId, 'group');
  const memberState = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const group = groupState.data?.find((record) => id && recordIds(record).includes(id));
  const groupIds = group ? recordIds(group) : [];
  const groupLocalId = group ? recordId(group) : '';
  const groupPayloadId = group ? String(group.cloudId ?? group._id ?? group.id ?? '') : '';
  const groupIdentity = group ? String(group.cloudId ?? group._id ?? '') : '';
  const cloudGroupId = groupIdentity.startsWith('local-') ? '' : groupIdentity;
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    cloudGroupId ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const localMembers =
    memberState.data?.filter(
      (record) => typeof record.groupId === 'string' && groupIds.includes(record.groupId),
    ) ?? [];
  const members: LocalRecord[] = remoteGroup
    ? remoteGroup.members.map((member) => ({
        id: member.id,
        groupId: cloudGroupId,
        userId: member.id,
        role: member.role,
        username: member.username,
        displayName: member.displayName,
      }))
    : localMembers;
  const [nameDraft, setNameDraft] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [iconDraft, setIconDraft] = useState<string>('phosphor:UsersThree');
  const [colorDraft, setColorDraft] = useState<string | undefined>();
  const [retentionDraft, setRetentionDraft] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const updateGroupSettings = useMutation(api.groups.mutations.updateSettings);
  const updateMemberRole = useMutation(api.groups.mutations.setMemberRole);
  const addGroupMember = useMutation(api.groups.mutations.addMember);
  const removeGroupMember = useMutation(api.groups.mutations.removeMember);
  const retry = () => {
    groupState.retry();
    memberState.retry();
  };
  const remoteRole = remoteGroup?.members.find((member) => member.id === userId)?.role;
  const canManage = Boolean(
    remoteGroup && userId && (remoteGroup.ownerId === userId || remoteRole === 'admin'),
  );
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

  async function saveName() {
    if (!group || !userId || !groupLocalId || !groupPayloadId || pending) return;
    const name = nameDraft.trim();
    if (!name) {
      setActionError('Enter a group name.');
      return;
    }
    setPending('name');
    setActionError('');
    try {
      await commitLocalWrite(
        userId,
        'group',
        'group.update',
        { ...group, name },
        { groupId: groupPayloadId, name },
        {
          recordId: groupLocalId,
          dependencies: group._id || group.cloudId ? [] : [`group:${groupPayloadId}`],
          baseUpdatedAt: typeof group.updatedAt === 'number' ? group.updatedAt : undefined,
        },
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update the group name.');
    } finally {
      setPending(null);
    }
  }

  async function toggleAdmin(member: LocalRecord, makeAdmin: boolean) {
    if (!canManage || !cloudGroupId || pending) return;
    const memberUserId = typeof member.userId === 'string' ? member.userId : '';
    const memberRecordId = recordId(member);
    if (!memberUserId || !memberRecordId) return;
    setPending(memberRecordId);
    setActionError('');
    try {
      await updateMemberRole({
        groupId: cloudGroupId as Id<'groups'>,
        memberUserId: memberUserId as Id<'users'>,
        role: makeAdmin ? 'admin' : 'member',
      });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this member role.');
    } finally {
      setPending(null);
    }
  }

  async function saveGroupAppearance() {
    if (!canManage || !cloudGroupId || pending || !iconDraft || !colorDraft) return;
    setPending('appearance');
    setActionError('');
    try {
      await updateGroupSettings({
        groupId: cloudGroupId as Id<'groups'>,
        icon: iconDraft,
        color: colorDraft,
      });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update group appearance.');
    } finally {
      setPending(null);
    }
  }

  async function saveRetention() {
    if (!canManage || !cloudGroupId || pending) return;
    setPending('retention');
    setActionError('');
    try {
      await updateGroupSettings({
        groupId: cloudGroupId as Id<'groups'>,
        messageRetentionMs: retentionDraft,
      });
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Could not update message retention.',
      );
    } finally {
      setPending(null);
    }
  }

  async function addMember() {
    if (!canManage || !cloudGroupId || pending) return;
    setPending('member-add');
    setActionError('');
    try {
      const result = await addGroupMember({
        groupId: cloudGroupId as Id<'groups'>,
        username: memberInput,
      });
      setMemberInput('');
      if (!result) setActionError('No account matched; an invite was created for that username.');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not add this member.');
    } finally {
      setPending(null);
    }
  }

  async function removeMember(member: LocalRecord) {
    if (!canManage || !cloudGroupId || pending) return;
    const memberUserId = typeof member.userId === 'string' ? member.userId : '';
    if (!memberUserId) return;
    const memberRecordId = recordId(member);
    setPending(memberRecordId);
    setActionError('');
    try {
      await removeGroupMember({
        groupId: cloudGroupId as Id<'groups'>,
        memberUserId: memberUserId as Id<'users'>,
      });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not remove this member.');
    } finally {
      setPending(null);
    }
  }

  return (
    <GroupEditScreen
      group={
        group
          ? {
              id: groupLocalId,
              name: String(group.name ?? ''),
              currency: String(group.currency ?? ''),
              ownerId: typeof group.ownerId === 'string' ? group.ownerId : undefined,
              archived: group.archivedAt !== undefined,
              icon:
                typeof remoteGroup?.icon === 'string'
                  ? remoteGroup.icon
                  : typeof group.icon === 'string'
                    ? group.icon
                    : undefined,
              color:
                typeof remoteGroup?.color === 'string'
                  ? remoteGroup.color
                  : typeof group.color === 'string'
                    ? group.color
                    : undefined,
            }
          : undefined
      }
      members={members.map((member) => ({
        id: recordId(member),
        userId: typeof member.userId === 'string' ? member.userId : undefined,
        memberId: typeof member.memberId === 'string' ? member.memberId : undefined,
        name: String(member.displayName ?? member.name ?? member.username ?? 'Member'),
        username: typeof member.username === 'string' ? member.username : undefined,
        role: String(member.role ?? 'member'),
        avatarUrl: typeof member.avatarUrl === 'string' ? member.avatarUrl : undefined,
      }))}
      currentRole={
        remoteGroup?.ownerId === userId ? 'Owner' : remoteRole === 'admin' ? 'Admin' : 'Member'
      }
      canManage={canManage}
      loading={groupState.loading}
      membersLoading={memberState.loading}
      loadError={groupState.error?.message ?? memberState.error?.message}
      error={actionError || undefined}
      saving={pending}
      cloudGroupId={cloudGroupId}
      name={nameDraft}
      onNameChange={setNameDraft}
      onSaveName={() => void saveName()}
      icon={iconDraft}
      onIconChange={(value) => setIconDraft(value ?? 'phosphor:UsersThree')}
      color={colorDraft}
      onColorChange={setColorDraft}
      onSaveAppearance={() => void saveGroupAppearance()}
      retention={retentionDraft}
      onRetentionChange={setRetentionDraft}
      onSaveRetention={() => void saveRetention()}
      memberInput={memberInput}
      onMemberInputChange={setMemberInput}
      onAddMember={() => void addMember()}
      onChangeRole={(member, makeAdmin) => void toggleAdmin(member as LocalRecord, makeAdmin)}
      onRemoveMember={(member) => void removeMember(member as LocalRecord)}
      onRetry={retry}
      onBack={() => router.back()}
      onOpenAnalytics={() =>
        router.push(`/group/${encodeURIComponent(id ?? '')}/analytics` as never)
      }
    />
  );
}
