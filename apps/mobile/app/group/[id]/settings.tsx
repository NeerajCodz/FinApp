import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, NotePencil, UsersThree } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
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
} from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useTheme } from '@finapp/ui/native';

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
  const members =
    memberState.data?.filter(
      (record) => typeof record.groupId === 'string' && groupIds.includes(record.groupId),
    ) ?? [];
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const loading = groupState.loading || memberState.loading;
  const loadError = groupState.error || memberState.error;
  const retry = () => {
    groupState.retry();
    memberState.retry();
  };
  const groupLocalId = group ? recordId(group) : '';
  const groupPayloadId = group ? String(group._id ?? group.cloudId ?? group.id ?? '') : '';
  const canManage = Boolean(
    group &&
    userId &&
    (group.ownerId === userId ||
      members.some((member) => member.userId === userId && member.role === 'admin') ||
      (!group.ownerId && members.length === 0)),
  );

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
    if (!group || !userId || !groupPayloadId || pending) return;
    const memberUserId = typeof member.userId === 'string' ? member.userId : '';
    const memberRecordId = recordId(member);
    if (!memberUserId || !memberRecordId) return;
    const role = makeAdmin ? 'admin' : 'member';
    setPending(memberRecordId);
    setActionError('');
    try {
      await commitLocalWrite(
        userId,
        'groupMember',
        'group.setMemberRole',
        { ...member, role },
        { groupId: groupPayloadId, memberUserId, role },
        {
          recordId: memberRecordId,
          dependencies: group._id || group.cloudId ? [] : [`group:${groupPayloadId}`],
          baseUpdatedAt: typeof member.updatedAt === 'number' ? member.updatedAt : undefined,
        },
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this member role.');
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
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title" style={{ flex: 1 }}>
          Group settings
        </Typography>
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
                <UsersThree size={23} color={tokens.primary} />
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
                  {group.ownerId === userId || (!group.ownerId && members.length === 0)
                    ? 'Owner'
                    : members.find((member) => member.userId === userId)?.role === 'admin'
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
                        <Button
                          variant={role === 'admin' ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={pending === recordId(member)}
                          onPress={() => void toggleAdmin(member, role !== 'admin')}
                        >
                          {pending === recordId(member)
                            ? 'Saving…'
                            : role === 'admin'
                              ? 'Remove admin'
                              : 'Make admin'}
                        </Button>
                      )}
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
            <Typography variant="caption">
              Owners and admins can rename the group and promote or remove admins.
            </Typography>
          </View>

          {!!actionError && (
            <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
              {actionError}
            </Typography>
          )}
          <Typography variant="caption">
            Changes are saved on this device and sync when connected.
          </Typography>
        </>
      )}
    </ScrollView>
  );
}
