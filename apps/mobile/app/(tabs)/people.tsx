import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Search, UserPlus } from 'lucide-react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Button, Input, Text, Typography, useTheme } from '@finapp/ui/native';
import {
  FinanceEmptyState,
  SocialPersonRow,
  SocialSection,
  type IncomingInvitation,
  type SocialProfileSummary,
} from '@finapp/ui/finance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RequestsSheet } from '@/components/social/RequestsSheet';
import { toast } from '@/lib/toast';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Profile = SocialProfileSummary & { id: Id<'users'> };
type SuggestedProfile = Profile & { mutualFriendCount: number };
type RequestRow = { requestId: Id<'friendRequests'>; user: Profile; createdAt: number };
type Requests = { incoming: RequestRow[]; outgoing: RequestRow[] };
type Conversation = Profile & {
  id: Id<'directConversations'>;
  userId: Id<'users'>;
  updatedAt: number;
  lastMessage: null | { text?: string };
};
type PeopleFilter = 'all' | 'nearby' | 'mutuals';

const filters: { id: PeopleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'mutuals', label: 'Mutuals' },
];

export default function PeopleScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [inboxOpen, setInboxOpen] = useState(false);
  const friends = useQuery(api.social.queries.friends, userId && isConnected ? {} : 'skip') as
    Profile[] | undefined;
  const requests = useQuery(api.social.queries.requests, userId && isConnected ? {} : 'skip') as
    Requests | undefined;
  const suggestions = useQuery(
    api.social.queries.suggestions,
    userId && isConnected ? {} : 'skip',
  ) as SuggestedProfile[] | undefined;
  const conversations = useQuery(
    api.directMessages.queries.listConversations,
    userId && isConnected ? {} : 'skip',
  ) as Conversation[] | undefined;
  const invitations = useQuery(
    api.groups.queries.incomingInvitations,
    userId && isConnected ? {} : 'skip',
  ) as IncomingInvitation[] | undefined;
  const results = useQuery(
    api.users.queries.search,
    userId && isConnected && search.trim().length >= 2 ? { query: search.trim() } : 'skip',
  ) as Profile[] | undefined;
  const sendRequest = useMutation(api.social.mutations.sendRequest);
  const respondToRequest = useMutation(api.social.mutations.respondToRequest);
  const cancelRequest = useMutation(api.social.mutations.cancelRequest);
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
  const startConversation = useMutation(api.directMessages.mutations.startConversation);
  const friendIds = useMemo(
    () => new Set((friends ?? []).map((person) => String(person.id))),
    [friends],
  );
  const outgoingIds = useMemo(
    () => new Set((requests?.outgoing ?? []).map((row) => String(row.user.id))),
    [requests],
  );
  const requestCount = (requests?.incoming.length ?? 0) + (invitations?.length ?? 0);

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That action could not be completed.');
    }
  }

  function openProfile(profile: Profile) {
    if (profile.username)
      router.push(`/@${encodeURIComponent(profile.username.replace(/^@+/, ''))}` as never);
  }

  async function openConversation(personId: Id<'users'>) {
    await runAction(async () => {
      const conversationId = await startConversation({ userId: personId });
      router.push(`/messages/${encodeURIComponent(String(conversationId))}` as never);
    });
  }

  function personRow(profile: Profile, detail?: string) {
    const isFriend = friendIds.has(String(profile.id));
    const hasIncoming = requests?.incoming.some((row) => row.user.id === profile.id);
    const hasOutgoing = outgoingIds.has(String(profile.id));
    return (
      <SocialPersonRow
        key={String(profile.id)}
        profile={profile}
        detail={detail}
        onPress={() => openProfile(profile)}
        action={
          <Button
            size="sm"
            variant={isFriend ? 'outline' : 'primary'}
            onPress={() => {
              if (isFriend) void openConversation(profile.id);
              else if (hasIncoming || hasOutgoing) setInboxOpen(true);
              else void runAction(() => sendRequest({ recipientId: profile.id }));
            }}
          >
            {isFriend ? 'Chat' : hasIncoming ? 'Respond' : hasOutgoing ? 'Pending' : 'Add friend'}
          </Button>
        }
      />
    );
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

  const filteredPeople = (suggestions ?? []).filter((profile) =>
    filter === 'mutuals' ? profile.mutualFriendCount > 0 : true,
  );
  const searchResults = (results ?? []).filter((profile) => String(profile.id) !== userId);
  const loading = Boolean(userId && isConnected && suggestions === undefined);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 26,
          gap: 20,
          alignItems: 'stretch',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text
              style={{ color: tokens.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 }}
            >
              PEOPLE
            </Text>
            <Typography variant="title" style={{ fontSize: 32, lineHeight: 38 }}>
              People
            </Typography>
            <Text style={{ color: tokens.foregroundMuted, lineHeight: 21 }}>
              Find people to connect and share expenses.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={requestCount ? `Requests, ${requestCount} pending` : 'Requests'}
            onPress={() => setInboxOpen(true)}
            style={{
              position: 'relative',
              minHeight: 42,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              borderRadius: 13,
              paddingHorizontal: 11,
              backgroundColor: tokens.surfaceSubtle,
            }}
          >
            <UserPlus size={17} color={tokens.foreground} />
            <Text style={{ fontSize: 12, fontWeight: '600' }}>Requests</Text>
            {requestCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -7,
                  right: -7,
                  width: 19,
                  height: 19,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tokens.primary,
                }}
              >
                <Text style={{ color: tokens.primaryForeground, fontSize: 10, fontWeight: '700' }}>
                  {requestCount > 9 ? '9+' : requestCount}
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
          <Search size={19} color={tokens.foregroundMuted} />
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search by username"
            accessibilityLabel="Search people by username"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent', minHeight: 46 }}
          />
        </View>

        <ScrollView
          style={{ width: '100%' }}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {filters.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={filter === item.id ? 'primary' : 'outline'}
              accessibilityState={{ selected: filter === item.id }}
              onPress={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </ScrollView>

        {search.trim().length >= 2 ? (
          <SocialSection title="Search results" count={searchResults.length}>
            {results === undefined ? (
              <Text style={{ color: tokens.foregroundMuted }}>Searching people…</Text>
            ) : searchResults.length ? (
              searchResults
                .filter((profile) => profile.username)
                .map((profile) => personRow(profile))
            ) : (
              <FinanceEmptyState
                kind="search"
                title="No matching people."
                description="Try another username."
                compact
              />
            )}
          </SocialSection>
        ) : filter === 'nearby' ? (
          <FinanceEmptyState
            kind="people"
            title="Nearby discovery is not available yet."
            description="Location details are not part of profiles yet."
            compact
          />
        ) : (
          <SocialSection
            title={filter === 'mutuals' ? 'People with mutual friends' : 'People you may know'}
            count={filteredPeople.length}
          >
            {loading ? (
              <Text style={{ color: tokens.foregroundMuted }}>
                Finding people from your mutual connections…
              </Text>
            ) : filteredPeople.length ? (
              filteredPeople.map((profile) =>
                personRow(
                  profile,
                  `${profile.mutualFriendCount} mutual ${profile.mutualFriendCount === 1 ? 'friend' : 'friends'}`,
                ),
              )
            ) : (
              <FinanceEmptyState
                kind="people"
                title={filter === 'mutuals' ? 'No mutuals to show yet.' : 'No suggestions yet.'}
                description="Add friends to build your network and discover mutual connections."
                compact
              />
            )}
          </SocialSection>
        )}

        <SocialSection title="Friends" count={friends?.length ?? 0}>
          {friends === undefined && userId && isConnected ? (
            <Text style={{ color: tokens.foregroundMuted }}>Loading friends…</Text>
          ) : friends?.length ? (
            friends.map((profile) => personRow(profile, 'Friend'))
          ) : (
            <FinanceEmptyState
              kind="people"
              title="Your circle starts here."
              description="Find someone you know and send a friend request to start sharing."
              compact
            />
          )}
        </SocialSection>

        <SocialSection title="Recent conversations" count={conversations?.length ?? 0}>
          {conversations === undefined && userId && isConnected ? (
            <Text style={{ color: tokens.foregroundMuted }}>Loading conversations…</Text>
          ) : conversations?.length ? (
            conversations.slice(0, 4).map((conversation) => (
              <SocialPersonRow
                key={String(conversation.id)}
                profile={{
                  id: conversation.userId,
                  username: conversation.username,
                  displayName: conversation.displayName ?? 'Finapp user',
                  avatarId: conversation.avatarId,
                  avatarUrl: conversation.avatarUrl,
                }}
                detail={conversation.lastMessage?.text ?? 'Start the conversation'}
                onPress={() =>
                  router.push(`/messages/${encodeURIComponent(String(conversation.id))}` as never)
                }
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      router.push(
                        `/messages/${encodeURIComponent(String(conversation.id))}` as never,
                      )
                    }
                  >
                    Chat
                  </Button>
                }
              />
            ))
          ) : (
            <FinanceEmptyState
              kind="message"
              title="No conversations yet."
              description="Open a friend’s profile and send a message to start a private conversation."
              compact
            />
          )}
        </SocialSection>
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
