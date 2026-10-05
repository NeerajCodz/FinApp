import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronRight, MessageCircle, Search, UserPlus, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Input, Text, Typography, useTheme } from '@finapp/ui/native';
import { EntityIcon, type SocialProfileSummary } from '@finapp/ui/finance';
import { recordId, recordIds } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';
import { toast } from '@/lib/toast';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useGroupRecords, type GroupMemberSummary } from '@/hooks/useGroupRecords';
import type { GroupRecord } from '@/lib/groupRecords';
import { RequestsSheet } from './RequestsSheet';

const PURPLE = '#C277F5';
const ICON_INK = '#16131B';

type Profile = SocialProfileSummary & { id: Id<'users'> };
type SuggestedProfile = Profile & { mutualFriendCount: number };
type RequestRow = { requestId: Id<'friendRequests'>; user: Profile; createdAt: number };
type Requests = { incoming: RequestRow[]; outgoing: RequestRow[] };
type MemberRecord = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  deletedAt?: number;
  displayName?: string;
  name?: string;
  username?: string;
  avatarId?: string;
  avatarUrl?: string | null;
};
type ActivityRecord = LocalRecord & {
  groupId?: string;
  title?: string;
  type?: string;
  status?: string;
  deletedAt?: number;
  occurredAt?: number;
  fromUserId?: string;
  toUserId?: string;
};
type GroupQueryDetail = { members?: GroupMemberSummary[] };

function timeAgo(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return 'just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function NetworkHomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const [search, setSearch] = useState('');
  const [inboxOpen, setInboxOpen] = useState(false);
  const friends = useQuery(api.social.queries.friends, userId && isConnected ? {} : 'skip') as
    Profile[] | undefined;
  const requests = useQuery(api.social.queries.requests, userId && isConnected ? {} : 'skip') as
    Requests | undefined;
  const suggestions = useQuery(
    api.social.queries.suggestions,
    userId && isConnected ? {} : 'skip',
  ) as SuggestedProfile[] | undefined;
  const searchResults = useQuery(
    api.users.queries.search,
    userId && isConnected && search.trim().length >= 2 ? { query: search.trim() } : 'skip',
  ) as Profile[] | undefined;
  const invitations = useQuery(
    api.groups.queries.incomingInvitations,
    userId && isConnected ? {} : 'skip',
  );
  const sendRequest = useMutation(api.social.mutations.sendRequest);
  const respondToRequest = useMutation(api.social.mutations.respondToRequest);
  const cancelRequest = useMutation(api.social.mutations.cancelRequest);
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
  const startConversation = useMutation(api.directMessages.mutations.startConversation);
  const groupState = useGroupRecords(userId, isConnected);
  const membersState = useLocalRecords<MemberRecord>(userId, 'groupMember');
  const transactionsState = useLocalRecords<ActivityRecord>(userId, 'transaction');
  const settlementsState = useLocalRecords<ActivityRecord>(userId, 'settlement');

  const activeGroups = groupState.data ?? [];
  const groupsForSearch = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return activeGroups.filter(
      (group) =>
        !needle ||
        String(group.name ?? '')
          .toLocaleLowerCase()
          .includes(needle),
    );
  }, [activeGroups, search]);
  const groupAliasIndex = useMemo(() => {
    const index = new Map<string, GroupRecord>();
    for (const group of activeGroups) for (const id of recordIds(group)) index.set(id, group);
    return index;
  }, [activeGroups]);
  const membersByGroup = useMemo(() => {
    const result = new Map<string, MemberRecord[]>();
    for (const group of activeGroups) {
      const aliases = recordIds(group);
      const members = (membersState.data ?? []).filter(
        (member) =>
          member.deletedAt === undefined &&
          typeof member.groupId === 'string' &&
          aliases.includes(member.groupId),
      );
      result.set(recordId(group), members);
    }
    return result;
  }, [activeGroups, membersState.data]);
  const recentActivity = useMemo(() => {
    const records = [
      ...(transactionsState.data ?? []).filter(
        (record) => record.type === 'expense' && record.status === 'posted',
      ),
      ...(settlementsState.data ?? []),
    ]
      .filter(
        (record) =>
          record.deletedAt === undefined &&
          typeof record.groupId === 'string' &&
          groupAliasIndex.has(record.groupId),
      )
      .sort((left, right) => (right.occurredAt ?? 0) - (left.occurredAt ?? 0))
      .slice(0, 4);
    return records.map((record) => {
      const group = groupAliasIndex.get(record.groupId!)!;
      return {
        id: recordId(record) || `${record.groupId}:${record.occurredAt ?? 0}`,
        groupId: recordId(group),
        groupName: String(group.name ?? 'Group'),
        groupIcon: typeof group.icon === 'string' ? group.icon : undefined,
        groupColor: typeof group.color === 'string' ? group.color : undefined,
        title: String(
          record.title ?? (record.type === 'settlement' ? 'Settlement recorded' : 'New expense'),
        ),
        timestamp: record.occurredAt ?? 0,
      };
    });
  }, [groupAliasIndex, settlementsState.data, transactionsState.data]);
  const friendIds = useMemo(
    () => new Set((friends ?? []).map((friend) => String(friend.id))),
    [friends],
  );
  const outgoingIds = useMemo(
    () => new Set((requests?.outgoing ?? []).map((row) => String(row.user.id))),
    [requests],
  );
  const displayPeople: Profile[] =
    search.trim().length >= 2
      ? (searchResults ?? []).filter((person) => person.id !== userId)
      : (suggestions ?? []).filter((person) => {
          const needle = search.trim().toLocaleLowerCase();
          return (
            !needle ||
            `${person.displayName} ${person.username ?? ''}`.toLocaleLowerCase().includes(needle)
          );
        });
  const incomingCount = (requests?.incoming.length ?? 0) + (invitations?.length ?? 0);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'That action could not be completed.');
    }
  }

  function openProfile(profile: Profile) {
    if (profile.username)
      router.push(`/@${encodeURIComponent(profile.username.replace(/^@+/, ''))}` as never);
  }

  async function handlePersonAction(profile: Profile) {
    await run(async () => {
      if (friendIds.has(String(profile.id))) {
        const conversationId = await startConversation({ userId: profile.id });
        router.push(`/messages/${encodeURIComponent(String(conversationId))}` as never);
      } else if (!outgoingIds.has(String(profile.id))) {
        await sendRequest({ recipientId: profile.id });
      } else {
        openProfile(profile);
      }
    });
  }

  async function respondToFriendRequest(requestId: string, response: 'accept' | 'decline') {
    if (!isConnected) throw new Error('Reconnect to respond to friend requests.');
    await respondToRequest({ requestId: requestId as Id<'friendRequests'>, response });
  }

  async function cancelFriendRequest(requestId: string) {
    if (!isConnected) throw new Error('Reconnect to cancel friend requests.');
    await cancelRequest({ requestId: requestId as Id<'friendRequests'> });
  }

  async function respondToGroupInvitation(inviteId: string, response: 'accept' | 'decline') {
    if (!isConnected) throw new Error('Reconnect to respond to group invitations.');
    await respondToInvitation({ inviteId: inviteId as Id<'groupInvites'>, response });
  }

  const activePeopleLoading = Boolean(userId && isConnected && suggestions === undefined);
  const requestBadge = incomingCount > 0 ? incomingCount : undefined;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          gap: 21,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: PURPLE, fontSize: 11, fontWeight: '700', letterSpacing: 1.25 }}>
              YOUR NETWORK
            </Text>
            <Typography variant="title" style={{ fontSize: 29, lineHeight: 35 }}>
              People &amp; Groups
            </Typography>
            <Text style={{ color: tokens.foregroundMuted, lineHeight: 20 }}>
              Connect, split expenses, and manage your circles.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={requestBadge ? `Requests, ${requestBadge} pending` : 'Requests'}
            onPress={() => setInboxOpen(true)}
            style={({ pressed }) => ({
              position: 'relative',
              minHeight: 43,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              borderRadius: 13,
              paddingHorizontal: 11,
              backgroundColor: pressed ? tokens.surfaceRaised : tokens.surfaceSubtle,
            })}
          >
            <UserPlus size={17} color={tokens.foreground} />
            <Text style={{ fontSize: 12, fontWeight: '600' }}>Requests</Text>
            {requestBadge ? (
              <View
                style={{
                  position: 'absolute',
                  right: -7,
                  top: -7,
                  width: 19,
                  height: 19,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: PURPLE,
                }}
              >
                <Text style={{ color: ICON_INK, fontSize: 10, fontWeight: '700' }}>
                  {requestBadge > 9 ? '9+' : requestBadge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View
          style={{
            minHeight: 50,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            borderRadius: 13,
            paddingHorizontal: 13,
            backgroundColor: tokens.surfaceSubtle,
          }}
        >
          <Search size={20} color={tokens.foregroundMuted} />
          <Input
            accessibilityLabel="Search people or groups"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Search people or groups"
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent', minHeight: 46 }}
          />
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Typography variant="label" style={{ flex: 1, fontSize: 16 }}>
              {search.trim().length >= 2 ? 'People matching your search' : 'People you may know'}
            </Typography>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/people' as never)}
              hitSlop={8}
            >
              <Text style={{ color: PURPLE, fontWeight: '600', fontSize: 13 }}>See all</Text>
            </Pressable>
          </View>
          {activePeopleLoading ? (
            <Text style={{ color: tokens.foregroundMuted }}>Finding people to connect with…</Text>
          ) : displayPeople.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
            >
              {displayPeople.slice(0, 8).map((person) => {
                const isFriend = friendIds.has(String(person.id));
                const requestPending = outgoingIds.has(String(person.id));
                return (
                  <View key={String(person.id)} style={{ width: 69, alignItems: 'center', gap: 6 }}>
                    <View style={{ position: 'relative' }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${person.displayName}'s profile`}
                        onPress={() => openProfile(person)}
                      >
                        <Avatar
                          label={person.displayName}
                          initials={initials(person.displayName)}
                          size={64}
                          avatarId={person.avatarId}
                          imageUrl={person.avatarUrl}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          isFriend
                            ? `Message ${person.displayName}`
                            : requestPending
                              ? `View pending request to ${person.displayName}`
                              : `Send friend request to ${person.displayName}`
                        }
                        onPress={() => void handlePersonAction(person)}
                        style={({ pressed }) => ({
                          position: 'absolute',
                          right: -2,
                          bottom: -2,
                          width: 30,
                          height: 30,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: tokens.background,
                          borderRadius: 16,
                          backgroundColor: tokens.surfaceRaised,
                          opacity: pressed ? 0.72 : 1,
                        })}
                      >
                        {isFriend ? (
                          <MessageCircle size={15} color={tokens.foreground} />
                        ) : (
                          <UserPlus size={15} color={tokens.foreground} />
                        )}
                      </Pressable>
                    </View>
                    <Text
                      style={{ width: '100%', textAlign: 'center', fontWeight: '600' }}
                      numberOfLines={1}
                    >
                      {person.displayName}
                    </Text>
                    <Text
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        color: tokens.foregroundMuted,
                        fontSize: 11,
                      }}
                      numberOfLines={1}
                    >
                      {person.username ? `@${person.username.replace(/^@+/, '')}` : 'Finapp user'}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={{ color: tokens.foregroundMuted }}>
              {search.trim().length >= 2 && searchResults === undefined
                ? 'Searching people…'
                : 'No people to show yet.'}
            </Text>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Typography variant="label" style={{ flex: 1, fontSize: 16 }}>
              Your groups
            </Typography>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/groups' as never)}
              hitSlop={8}
            >
              <Text style={{ color: PURPLE, fontWeight: '600', fontSize: 13 }}>See all</Text>
            </Pressable>
          </View>
          {groupState.loading ? (
            <Text style={{ color: tokens.foregroundMuted }}>Loading groups…</Text>
          ) : groupsForSearch.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 9, paddingVertical: 2 }}
            >
              {groupsForSearch.slice(0, 8).map((group) => {
                const members = membersByGroup.get(recordId(group)) ?? [];
                const cloudId = group.cloudId ?? (typeof group._id === 'string' ? group._id : '');
                const details = groupState.groupDetails[`detail:${cloudId}`] as
                  GroupQueryDetail | undefined;
                const count = details?.members?.length ?? members.length;
                return (
                  <Pressable
                    key={recordId(group)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${String(group.name ?? 'group')}`}
                    onPress={() =>
                      router.push(`/group/${encodeURIComponent(recordId(group))}` as never)
                    }
                    style={({ pressed }) => ({
                      width: 101,
                      minHeight: 116,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      borderWidth: 1,
                      borderColor: tokens.borderSubtle,
                      borderRadius: 16,
                      padding: 10,
                      backgroundColor: pressed ? tokens.surfaceRaised : tokens.surfaceSubtle,
                    })}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 15,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          typeof group.color === 'string' ? group.color : tokens.surfaceRaised,
                      }}
                    >
                      <EntityIcon
                        value={typeof group.icon === 'string' ? group.icon : 'phosphor:UsersThree'}
                        size={28}
                        color={ICON_INK}
                      />
                    </View>
                    <Text
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                      numberOfLines={1}
                    >
                      {String(group.name ?? 'Group')}
                    </Text>
                    <Text style={{ color: tokens.foregroundMuted, fontSize: 10 }}>
                      {count > 0 ? `${count} members` : 'Shared group'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={{ color: tokens.foregroundMuted }}>
              {search ? 'No groups match your search.' : 'No groups yet.'}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/groups/new' as never)}
            style={({ pressed }) => ({
              minHeight: 72,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              borderRadius: 16,
              paddingHorizontal: 13,
              backgroundColor: pressed ? tokens.surfaceRaised : tokens.surfaceSubtle,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: PURPLE,
              }}
            >
              <Users size={22} color={ICON_INK} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Typography variant="label">Create a group</Typography>
              <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
                Split expenses, chat, and plan together.
              </Text>
            </View>
            <ChevronRight size={20} color={tokens.foregroundMuted} />
          </Pressable>
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Typography variant="label" style={{ flex: 1, fontSize: 16 }}>
              Recent activity
            </Typography>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/activity' as never)}
              hitSlop={8}
            >
              <Text style={{ color: PURPLE, fontWeight: '600', fontSize: 13 }}>See all</Text>
            </Pressable>
          </View>
          {transactionsState.loading || settlementsState.loading ? (
            <Text style={{ color: tokens.foregroundMuted }}>Loading recent activity…</Text>
          ) : recentActivity.length ? (
            <View>
              {recentActivity.map((activity) => (
                <Pressable
                  key={activity.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${activity.groupName}: ${activity.title}`}
                  onPress={() =>
                    router.push(`/group/${encodeURIComponent(activity.groupId)}` as never)
                  }
                  style={({ pressed }) => ({
                    minHeight: 64,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    borderBottomWidth: 1,
                    borderColor: tokens.borderSubtle,
                    paddingHorizontal: 7,
                    backgroundColor: pressed ? tokens.surfaceSubtle : 'transparent',
                  })}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: activity.groupColor ?? tokens.surfaceRaised,
                    }}
                  >
                    <EntityIcon
                      value={activity.groupIcon ?? 'phosphor:UsersThree'}
                      size={20}
                      color={ICON_INK}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Typography variant="label" numberOfLines={1}>
                      {activity.groupName}
                    </Typography>
                    <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }} numberOfLines={1}>
                      {activity.title}
                    </Text>
                  </View>
                  <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>
                    {timeAgo(activity.timestamp)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={{ color: tokens.foregroundMuted }}>
              Your group activity will appear here.
            </Text>
          )}
        </View>
      </ScrollView>

      <RequestsSheet
        visible={inboxOpen}
        onClose={() => setInboxOpen(false)}
        requests={requests}
        invitations={invitations}
        requestsLoading={Boolean(userId && isConnected && requests === undefined)}
        invitationsLoading={Boolean(userId && isConnected && invitations === undefined)}
        requestsError={userId && !isConnected ? 'Reconnect to view friend requests.' : undefined}
        invitationsError={
          userId && !isConnected ? 'Reconnect to view group invitations.' : undefined
        }
        onRespondToRequest={respondToFriendRequest}
        onCancelRequest={cancelFriendRequest}
        onRespondToInvitation={respondToGroupInvitation}
      />
    </>
  );
}
