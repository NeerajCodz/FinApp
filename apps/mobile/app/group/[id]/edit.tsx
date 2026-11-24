import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Share } from 'react-native';
import * as Linking from 'expo-linking';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { commitLocalWrite } from '@/local/commands';
import { recordId, recordIds } from '@/lib/ledger';
import {
  GroupEditScreen,
  groupErrorMessage,
  INVITATION_LINK_DEFAULT_EXPIRY_MS,
  outstandingBalance,
  outstandingBalanceFromError,
  settleFirstCounterpart,
  type InvitationLinkExpiryMs,
  type OutstandingBalance,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { toast } from '@/lib/toast';

/** You can record a payment with a member only if one of you owes and the other is owed. */
function canSettleWith(
  balances: Record<string, bigint> | null | undefined,
  meId: string | null | undefined,
  memberId: string,
) {
  const mine = (meId && balances?.[meId]) || 0n;
  const theirs = balances?.[memberId] ?? 0n;
  return (mine > 0n && theirs < 0n) || (mine < 0n && theirs > 0n);
}

export default function GroupSettingsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId, isConnected } = useLocalSync();
  const groupState = useLocalRecords<LocalRecord>(userId, 'group');
  const memberState = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const group = groupState.data?.find((record) => id && recordIds(record).includes(id));
  const groupIds = group ? recordIds(group) : [];
  const groupLocalId = group ? recordId(group) : '';
  const groupPayloadId = group ? String(group.cloudId ?? group._id ?? group.id ?? '') : '';
  const groupIdentity = group ? String(group.cloudId ?? group._id ?? '') : '';
  const cloudGroupId = groupIdentity;
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
        avatarId: member.avatarId,
        avatarUrl: member.avatarUrl,
      }))
    : localMembers;
  const [nameDraft, setNameDraft] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [iconDraft, setIconDraft] = useState<string>('phosphor:UsersThree');
  const [colorDraft, setColorDraft] = useState<string | undefined>();
  const [retentionDraft, setRetentionDraft] = useState<number | null>(null);
  const [invitationUrl, setInvitationUrl] = useState('');
  const [invitationExpiresAt, setInvitationExpiresAt] = useState<number>();
  const [invitationExpiryMs, setInvitationExpiryMs] = useState<InvitationLinkExpiryMs>(
    INVITATION_LINK_DEFAULT_EXPIRY_MS,
  );
  const [invitationBusy, setInvitationBusy] = useState(false);
  const [invitationError, setInvitationError] = useState('');
  const [invitationStatus, setInvitationStatus] = useState('');
  const createInvitationLink = useMutation(api.groups.mutations.createInvitationLink);
  const revokeInvitationLink = useMutation(api.groups.mutations.revokeInvitationLink);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const updateGroupSettings = useMutation(api.groups.mutations.updateSettings);
  const updateMemberRole = useMutation(api.groups.mutations.setMemberRole);
  const transferOwnership = useMutation(api.groups.mutations.transferOwnership);
  const addGroupMember = useMutation(api.groups.mutations.addMember);
  const removeGroupMember = useMutation(api.groups.mutations.removeMember);
  const leaveGroupMutation = useMutation(api.groups.mutations.leaveGroup);
  const { ledger } = useGroupLedger(id);
  const [balanceGuard, setBalanceGuard] = useState<{
    memberId: string;
    memberName: string;
    self: boolean;
    balance: OutstandingBalance;
  } | null>(null);
  const groupCurrency = String(group?.currency ?? ledger?.currency ?? '');
  const memberDisplayName = (member: LocalRecord) =>
    String(member.displayName ?? member.name ?? member.username ?? 'Member');
  /** Shows the "Settle first" dialog; returns true when an open balance blocks the action. */
  function guardBalance(memberId: string, memberName: string, self: boolean, error?: unknown) {
    const balance =
      (error === undefined ? null : outstandingBalanceFromError(error)) ??
      (error === undefined ? outstandingBalance(ledger?.balances, memberId, groupCurrency) : null);
    if (!balance) return false;
    setBalanceGuard({
      memberId,
      memberName,
      self,
      balance: { ...balance, currency: balance.currency || groupCurrency },
    });
    return true;
  }
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

  function makeOwner(member: LocalRecord) {
    if (!isConnected) {
      setActionError('You are offline. Reconnect to hand over the group.');
      return;
    }
    const memberUserId = typeof member.userId === 'string' ? member.userId : '';
    const memberRecordId = recordId(member);
    if (!cloudGroupId || pending || !memberUserId || !memberRecordId) return;
    const name = String(member.displayName ?? member.name ?? 'this member');
    Alert.alert('Hand over the group?', `${name} becomes the owner. You stay on as an admin.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Make owner',
        onPress: () => {
          setPending(memberRecordId);
          setActionError('');
          transferOwnership({
            groupId: cloudGroupId as Id<'groups'>,
            newOwnerId: memberUserId as Id<'users'>,
          })
            .catch((cause: unknown) =>
              setActionError(
                cause instanceof Error ? cause.message : 'Could not hand over the group.',
              ),
            )
            .finally(() => setPending(null));
        },
      },
    ]);
  }

  async function toggleAdmin(member: LocalRecord, makeAdmin: boolean) {
    if (!isConnected) {
      setActionError('You are offline. Reconnect to manage group members.');
      return;
    }
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
    if (!isConnected) {
      setActionError('You are offline. Reconnect to update group settings.');
      return;
    }
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
    if (!isConnected) {
      setActionError('You are offline. Reconnect to update group settings.');
      return;
    }
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
    if (!isConnected) {
      setActionError('You are offline. Reconnect to invite group members.');
      return;
    }
    if (!canManage || !cloudGroupId || pending) return;
    setPending('member-add');
    setActionError('');
    setSuccessMessage('');
    try {
      await addGroupMember({
        groupId: cloudGroupId as Id<'groups'>,
        username: memberInput,
      });
      setMemberInput('');
      setSuccessMessage('Invitation sent. The recipient can accept it from their notifications.');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not add this member.');
    } finally {
      setPending(null);
    }
  }

  async function removeMember(member: LocalRecord) {
    if (!isConnected) {
      setActionError('You are offline. Reconnect to manage group members.');
      return;
    }
    if (!canManage || !cloudGroupId || pending) return;
    const memberUserId = typeof member.userId === 'string' ? member.userId : '';
    if (!memberUserId) return;
    if (guardBalance(memberUserId, memberDisplayName(member), false)) return;
    const memberRecordId = recordId(member);
    setPending(memberRecordId);
    setActionError('');
    try {
      await removeGroupMember({
        groupId: cloudGroupId as Id<'groups'>,
        memberUserId: memberUserId as Id<'users'>,
      });
      toast.success(`${memberDisplayName(member)} was removed`);
    } catch (cause) {
      if (!guardBalance(memberUserId, memberDisplayName(member), false, cause))
        setActionError(groupErrorMessage(cause, 'Could not remove this member.'));
    } finally {
      setPending(null);
    }
  }

  async function leaveGroup() {
    if (!isConnected) {
      setActionError('You are offline. Reconnect to leave the group.');
      return;
    }
    if (!userId || !cloudGroupId || pending) return;
    if (guardBalance(userId, 'You', true)) return;
    setPending('leave');
    setActionError('');
    try {
      await leaveGroupMutation({ groupId: cloudGroupId as Id<'groups'> });
      toast.success(`You left ${String(group?.name ?? 'the group')}`);
      router.replace('/groups' as never);
    } catch (cause) {
      if (!guardBalance(userId, 'You', true, cause))
        setActionError(groupErrorMessage(cause, 'Could not leave the group.'));
    } finally {
      setPending(null);
    }
  }

  async function createInvitation() {
    if (!isConnected) {
      setInvitationError('You are offline. Reconnect to create an invitation link.');
      return;
    }
    if (!canManage || !cloudGroupId || invitationBusy) return;
    setInvitationBusy(true);
    setInvitationError('');
    setInvitationStatus('');
    try {
      const result = await createInvitationLink({
        groupId: cloudGroupId as Id<'groups'>,
        expiresInMs: invitationExpiryMs,
      });
      const url = Linking.createURL('/group/invite', { queryParams: { token: result.token } });
      setInvitationUrl(url);
      setInvitationExpiresAt(result.expiresAt);
      setInvitationStatus('New link generated. Any previous active link was invalidated.');
    } catch (cause) {
      setInvitationError(
        cause instanceof Error ? cause.message : 'Could not create an invitation link.',
      );
    } finally {
      setInvitationBusy(false);
    }
  }
  async function revokeInvitation() {
    if (!isConnected) {
      setInvitationError('You are offline. Reconnect to revoke the invitation link.');
      return;
    }
    if (!canManage || !cloudGroupId || invitationBusy) return;
    setInvitationBusy(true);
    setInvitationError('');
    setInvitationStatus('');
    try {
      await revokeInvitationLink({ groupId: cloudGroupId as Id<'groups'> });
      setInvitationUrl('');
      setInvitationExpiresAt(undefined);
      setInvitationStatus('Invitation link reset and revoked.');
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
      await Share.share({
        message: `Join ${group?.name ?? 'my group'}: ${invitationUrl}`,
        url: invitationUrl,
      });
      setInvitationStatus('Invitation link shared.');
    } catch (cause) {
      setInvitationError(cause instanceof Error ? cause.message : 'Could not share the link.');
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
        avatarId: typeof member.avatarId === 'string' ? member.avatarId : undefined,
        avatarUrl: typeof member.avatarUrl === 'string' ? member.avatarUrl : undefined,
      }))}
      currentRole={
        remoteGroup?.ownerId === userId ? 'Owner' : remoteRole === 'admin' ? 'Admin' : 'Member'
      }
      canManage={canManage}
      loading={groupState.loading}
      membersLoading={memberState.loading}
      loadError={groupState.error?.message ?? memberState.error?.message}
      error={
        actionError ||
        (!isConnected
          ? 'Offline. Reconnect to manage group settings, invitations, and membership.'
          : undefined)
      }
      successMessage={successMessage}
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
      onMakeOwner={
        remoteGroup && userId && remoteGroup.ownerId === userId
          ? (member) => makeOwner(member as LocalRecord)
          : undefined
      }
      onRemoveMember={(member) =>
        void removeMember(
          (members.find((record) => recordId(record) === member.id) ?? member) as LocalRecord,
        )
      }
      meId={userId}
      balances={ledger?.balances}
      balanceCurrency={groupCurrency}
      formerMembers={remoteGroup?.formerMembers.map((former) => ({
        id: former.id,
        name: former.displayName,
        avatarId: former.avatarId,
        leftAt: former.leftAt,
      }))}
      canLeave={Boolean(remoteGroup && userId && remoteGroup.ownerId !== userId && cloudGroupId)}
      onLeave={() => void leaveGroup()}
      balanceGuard={balanceGuard}
      onDismissBalanceGuard={() => setBalanceGuard(null)}
      onSettleFirst={
        balanceGuard &&
        (balanceGuard.self || canSettleWith(ledger?.balances, userId, balanceGuard.memberId))
          ? () => {
              const guard = balanceGuard;
              setBalanceGuard(null);
              if (!guard) return;
              const counterpart = guard.self
                ? settleFirstCounterpart(ledger?.balances, guard.memberId)
                : guard.memberId;
              router.push({
                pathname: '/settle/new',
                params: { groupId: id ?? '', ...(counterpart ? { member: counterpart } : {}) },
              });
            }
          : undefined
      }
      onRetry={retry}
      onBack={() => router.back()}
      onOpenAnalytics={() =>
        router.push(`/group/${encodeURIComponent(id ?? '')}/analytics` as never)
      }
      invitationUrl={canManage ? invitationUrl : undefined}
      invitationExpiresAt={canManage ? invitationExpiresAt : undefined}
      invitationExpiryMs={canManage ? invitationExpiryMs : undefined}
      onInvitationExpiryChange={setInvitationExpiryMs}
      invitationBusy={invitationBusy}
      invitationError={invitationError}
      invitationStatus={invitationStatus}
      onCreateInvitation={() => void createInvitation()}
      onRevokeInvitation={() => void revokeInvitation()}
      onShareInvitation={() => void shareInvitation()}
    />
  );
}
