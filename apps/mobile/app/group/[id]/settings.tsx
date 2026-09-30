import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, NotePencil, UsersThree } from '@finapp/ui/icons/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { commitLocalWrite } from '@/local/commands';
import { recordId, recordIds } from '@/lib/ledger';
import {
  Avatar,
  Button,
  Card,
  Empty,
  IconButton,
  Input,
  Separator,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { EntityIcon, EntityIconPicker } from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';

export default function GroupSettingsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const groupState = useLocalRecords<LocalRecord>(userId, 'group');
  const memberState = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const group = groupState.data?.find((record) => id && recordIds(record).includes(id));
  const groupIds = group ? recordIds(group) : [];
  const groupLocalId = group ? recordId(group) : '';
  const groupPayloadId = group ? String(group.cloudId ?? group._id ?? group.id ?? '') : '';
  const cloudGroupId = group ? String(group.cloudId ?? group._id ?? '') : '';
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [iconDraft, setIconDraft] = useState<string>();
  const [retentionDraft, setRetentionDraft] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const updateGroupSettings = useMutation(api.groups.mutations.updateSettings);
  const updateMemberRole = useMutation(api.groups.mutations.setMemberRole);
  const addGroupMember = useMutation(api.groups.mutations.addMember);
  const removeGroupMember = useMutation(api.groups.mutations.removeMember);
  const loading = groupState.loading || memberState.loading;
  const loadError = groupState.error || memberState.error;
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
      remoteGroup ? remoteGroup.icon : typeof group?.icon === 'string' ? group.icon : undefined,
    );
    setRetentionDraft(remoteGroup?.messageRetentionMs ?? null);
  }, [group?.icon, remoteGroup?.icon, remoteGroup?.messageRetentionMs]);

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
      setEditingName(false);
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

  async function saveGroupIcon() {
    if (!canManage || !cloudGroupId || pending) return;
    setPending('icon');
    setActionError('');
    try {
      await updateGroupSettings({
        groupId: cloudGroupId as Id<'groups'>,
        icon: iconDraft ?? null,
      });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update the group icon.');
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
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 36,
        gap: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back to group" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ gap: 2 }}>
          <Typography variant="caption" style={{ color: tokens.primary }}>
            GROUP MANAGEMENT
          </Typography>
          <Typography variant="title">Settings</Typography>
        </View>
      </View>

      {!id ? (
        <Empty title="Missing group ID" description="Open settings from a saved group." />
      ) : loadError ? (
        <Empty
          title="Group settings unavailable"
          description="Saved group details could not be loaded."
          icon={<UsersThree size={28} color={tokens.foregroundMuted} />}
          action={
            <Button variant="outline" onPress={retry}>
              Retry
            </Button>
          }
        />
      ) : loading ? (
        <Typography variant="small">Loading group details…</Typography>
      ) : !group ? (
        <Empty title="Group unavailable" description="This group is not saved on this device." />
      ) : (
        <>
          <Card
            variant="subtle"
            style={{
              gap: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: tokens.surfaceSubtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <EntityIcon
                  value={
                    remoteGroup
                      ? (remoteGroup.icon ?? 'lucide:UsersRound')
                      : typeof group.icon === 'string'
                        ? group.icon
                        : 'lucide:UsersRound'
                  }
                  size={23}
                  color={tokens.primary}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Typography variant="heading" numberOfLines={2}>
                  {String(group.name ?? 'Group')}
                </Typography>
                <Typography variant="caption">
                  {group.archivedAt === undefined ? 'Active group' : 'Archived group'}
                </Typography>
              </View>
              <Typography variant="caption">{members.length || 1} members</Typography>
            </View>
            <Separator />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Typography variant="caption">Your access</Typography>
              <View
                style={{
                  marginLeft: 'auto',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 9,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <Typography variant="caption">
                  {remoteGroup?.ownerId === userId
                    ? 'Owner'
                    : remoteRole === 'admin'
                      ? 'Admin'
                      : 'Member'}
                </Typography>
              </View>
            </View>
          </Card>

          <View style={{ gap: 12 }}>
            <Typography variant="label">General</Typography>
            <View
              style={{
                padding: 16,
                gap: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                backgroundColor: tokens.surfaceSubtle,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Typography variant="bodyLarge">Group name</Typography>
                  {!editingName && (
                    <Typography variant="small">{String(group.name ?? 'Group')}</Typography>
                  )}
                </View>
                {canManage && !editingName && (
                  <IconButton
                    label="Edit group name"
                    variant="ghost"
                    onPress={() => {
                      setNameDraft(String(group.name ?? ''));
                      setActionError('');
                      setEditingName(true);
                    }}
                  >
                    <NotePencil size={18} color={tokens.primary} />
                  </IconButton>
                )}
              </View>
              {editingName && (
                <View style={{ gap: 10 }}>
                  <Input
                    accessibilityLabel="Group name"
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    maxLength={80}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => void saveName()}
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Button
                      style={{ flex: 1 }}
                      disabled={pending === 'name'}
                      onPress={() => void saveName()}
                    >
                      {pending === 'name' ? 'Saving…' : 'Save name'}
                    </Button>
                    <Button
                      style={{ flex: 1 }}
                      variant="outline"
                      disabled={pending === 'name'}
                      onPress={() => setEditingName(false)}
                    >
                      Cancel
                    </Button>
                  </View>
                </View>
              )}
              <Separator />
              <View style={{ gap: 3 }}>
                <Typography variant="bodyLarge">Currency</Typography>
                <Typography variant="small">{String(group.currency ?? 'INR')}</Typography>
                <Typography variant="caption">
                  Kept fixed so existing split amounts stay consistent.
                </Typography>
              </View>
            </View>
          </View>
          {canManage && (
            <View style={{ gap: 12 }}>
              <Typography variant="label">Appearance & chat</Typography>
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                Icon and chat retention changes require an internet connection.
              </Typography>
              <View
                style={{
                  padding: 16,
                  gap: 12,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: tokens.borderSubtle,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <EntityIconPicker
                  mode="either"
                  value={iconDraft}
                  onChange={setIconDraft}
                  label="Group icon"
                  compact
                  allowClear
                />
                <Button
                  variant="outline"
                  disabled={Boolean(pending) || !cloudGroupId}
                  onPress={() => void saveGroupIcon()}
                >
                  {pending === 'icon' ? 'Saving icon…' : 'Save icon'}
                </Button>
                <Separator />
                <Typography variant="bodyLarge">Disappearing messages</Typography>
                <Typography variant="caption">
                  Existing and new messages, including bill images, are deleted on expiry.
                </Typography>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { value: null, label: 'Never' },
                    { value: 86_400_000, label: '1 day' },
                    { value: 604_800_000, label: '7 days' },
                    { value: 2_592_000_000, label: '30 days' },
                  ].map((option) => (
                    <Button
                      key={option.label}
                      size="sm"
                      variant={retentionDraft === option.value ? 'secondary' : 'outline'}
                      onPress={() => setRetentionDraft(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </View>
                <Button
                  disabled={Boolean(pending) || !cloudGroupId}
                  onPress={() => void saveRetention()}
                >
                  {pending === 'retention' ? 'Saving…' : 'Save retention'}
                </Button>
              </View>
            </View>
          )}

          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="label">Members</Typography>
              <Typography variant="caption">{members.length || 1} total</Typography>
            </View>
            {canManage && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Input
                  accessibilityLabel="Add member username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={memberInput}
                  onChangeText={setMemberInput}
                  placeholder="@username"
                  style={{ flex: 1 }}
                />
                <Button
                  size="sm"
                  disabled={Boolean(pending) || !memberInput.trim() || !cloudGroupId}
                  onPress={() => void addMember()}
                >
                  {pending === 'member-add' ? 'Adding…' : 'Add'}
                </Button>
              </View>
            )}
            <View
              style={{
                paddingHorizontal: 16,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                backgroundColor: tokens.surfaceSubtle,
              }}
            >
              {(members.length
                ? members
                : [
                    {
                      id: `${groupLocalId}:owner`,
                      userId: String(group.ownerId ?? userId ?? ''),
                      displayName: 'You',
                      role: 'owner',
                    },
                  ]
              ).map((member, index) => {
                const name = String(
                  member.displayName ?? member.name ?? member.username ?? 'Member',
                );
                const role = String(member.role ?? 'member');
                const memberUserId = String(member.userId ?? '');
                const isOwner = role === 'owner' || memberUserId === String(group.ownerId ?? '');
                const canChangeRole = canManage && !isOwner && memberUserId.length > 0;
                return (
                  <React.Fragment key={recordId(member) || memberUserId || name}>
                    {index > 0 && <Separator />}
                    <View
                      style={{ minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    >
                      <Avatar
                        initials={name
                          .split(/\s+/)
                          .map((part) => part[0] ?? '')
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                        label={name}
                        size={42}
                        imageUrl={typeof member.avatarUrl === 'string' ? member.avatarUrl : null}
                      />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Typography variant="bodyLarge" numberOfLines={1}>
                          {name}
                        </Typography>
                        <Typography variant="caption">
                          {isOwner ? 'Group owner' : role === 'admin' ? 'Group admin' : 'Member'}
                        </Typography>
                      </View>
                      {canChangeRole && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Button
                            variant={role === 'admin' ? 'secondary' : 'outline'}
                            size="sm"
                            disabled={Boolean(pending)}
                            onPress={() => void toggleAdmin(member, role !== 'admin')}
                          >
                            {pending === recordId(member)
                              ? 'Saving…'
                              : role === 'admin'
                                ? 'Remove admin'
                                : 'Make admin'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={Boolean(pending)}
                            onPress={() => void removeMember(member)}
                          >
                            {pending === recordId(member) ? 'Removing…' : 'Remove'}
                          </Button>
                        </View>
                      )}
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
            <Typography variant="caption">
              Owners and admins can manage members, the group icon, and message retention.
            </Typography>
          </View>

          {!!actionError && (
            <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
              {actionError}
            </Typography>
          )}
          <Typography variant="caption">
            Group name changes sync when connected; membership, icon, and retention save online.
          </Typography>
        </>
      )}
    </ScrollView>
  );
}
