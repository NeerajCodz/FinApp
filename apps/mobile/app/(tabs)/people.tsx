import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Button, Input, Text, Typography, useTheme } from '@finapp/ui/native';
import {
  FinanceEmptyState,
  SocialPersonRow,
  SocialSection,
  type SocialProfileSummary,
} from '@finapp/ui/finance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '@/lib/toast';

type Profile = SocialProfileSummary & { id: Id<'users'> };
type SuggestedProfile = Profile & { mutualFriendCount: number };
type RequestRow = { requestId: Id<'friendRequests'>; user: Profile; createdAt: number };
type Requests = { incoming: RequestRow[]; outgoing: RequestRow[] };
type Conversation = Profile & {
  id: Id<'directConversations'>;
  userId: Id<'users'>;
  updatedAt: number;
  lastMessage: null | {
    kind: 'text' | 'image';
    text: string;
    createdAt: number;
    mine: boolean;
    seen: boolean;
  };
};
type PeopleFilter = 'all' | 'friends' | 'requests' | 'messages';

const filters: { id: PeopleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'messages', label: 'Messages' },
];

export default function PeopleScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const friends = useQuery(api.social.queries.friends, {}) as Profile[] | undefined;
  const requests = useQuery(api.social.queries.requests, {}) as Requests | undefined;
  const suggestions = useQuery(api.social.queries.suggestions, {}) as
    SuggestedProfile[] | undefined;
  const conversations = useQuery(api.directMessages.queries.listConversations, {}) as
    Conversation[] | undefined;
  const results = useQuery(
    api.users.queries.search,
    search.trim().length >= 2 ? { query: search.trim() } : 'skip',
  ) as Profile[] | undefined;
  const sendRequest = useMutation(api.social.mutations.sendRequest);
  const respondToRequest = useMutation(api.social.mutations.respondToRequest);
  const cancelRequest = useMutation(api.social.mutations.cancelRequest);
  const startConversation = useMutation(api.directMessages.mutations.startConversation);
  const friendIds = useMemo(
    () => new Set((friends ?? []).map((person) => String(person.id))),
    [friends],
  );

  function openProfile(profile: Profile) {
    if (profile.username)
      router.push(`/@${encodeURIComponent(profile.username.replace(/^@+/, ''))}` as never);
  }

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That action could not be completed.');
    }
  }

  async function openConversation(userId: Id<'users'>) {
    await runAction(async () => {
      const conversationId = await startConversation({ userId });
      router.push(`/messages/${encodeURIComponent(String(conversationId))}` as never);
    });
  }

  function requestFor(profile: Profile) {
    return {
      incoming: requests?.incoming.find((row) => row.user.id === profile.id),
      outgoing: requests?.outgoing.find((row) => row.user.id === profile.id),
    };
  }

  function actionFor(profile: Profile, incoming?: RequestRow, outgoing?: RequestRow) {
    if (friendIds.has(String(profile.id)))
      return (
        <Button size="sm" variant="outline" onPress={() => void openConversation(profile.id)}>
          Message
        </Button>
      );
    if (incoming)
      return (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button
            size="sm"
            onPress={() =>
              void runAction(() =>
                respondToRequest({ requestId: incoming.requestId, response: 'accept' }),
              )
            }
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={() =>
              void runAction(() =>
                respondToRequest({ requestId: incoming.requestId, response: 'decline' }),
              )
            }
          >
            Decline
          </Button>
        </View>
      );
    if (outgoing)
      return (
        <Button
          size="sm"
          variant="outline"
          onPress={() => void runAction(() => cancelRequest({ requestId: outgoing.requestId }))}
        >
          Cancel
        </Button>
      );
    return (
      <Button
        size="sm"
        variant="outline"
        onPress={() => void runAction(() => sendRequest({ recipientId: profile.id }))}
      >
        Add friend
      </Button>
    );
  }

  function personRow(
    profile: Profile,
    detail?: string,
    incoming?: RequestRow,
    outgoing?: RequestRow,
  ) {
    return (
      <SocialPersonRow
        key={String(incoming?.requestId ?? outgoing?.requestId ?? profile.id)}
        profile={profile}
        detail={detail}
        onPress={() => openProfile(profile)}
        action={actionFor(profile, incoming, outgoing)}
      />
    );
  }

  const show = (section: PeopleFilter) => filter === 'all' || filter === section;
  const requestCount = requests ? requests.incoming.length + requests.outgoing.length : undefined;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 14,
        paddingBottom: insets.bottom + 26,
        gap: 20,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 6 }}>
        <Text
          style={{ color: tokens.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}
        >
          YOUR NETWORK
        </Text>
        <Typography variant="title">People</Typography>
        <Text style={{ color: tokens.foregroundMuted, lineHeight: 21 }}>
          Find friends, manage requests, and keep conversations together.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by username"
          accessibilityLabel="Search people by username"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ScrollView
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
              {item.id === 'requests' && requestCount !== undefined ? ` ${requestCount}` : ''}
            </Button>
          ))}
        </ScrollView>
      </View>

      {search.trim().length >= 2 && (
        <SocialSection
          title="Search results"
          count={results?.filter((item) => item.username).length ?? 0}
        >
          {results === undefined ? (
            <Text style={{ color: tokens.foregroundMuted }}>Searching people…</Text>
          ) : results.filter((item) => item.username).length ? (
            results
              .filter((person) => person.username)
              .map((profile) => {
                const { incoming, outgoing } = requestFor(profile);
                return personRow(
                  profile,
                  incoming ? 'Wants to connect' : outgoing ? 'Request pending' : undefined,
                  incoming,
                  outgoing,
                );
              })
          ) : (
            <FinanceEmptyState
              kind="search"
              title="No matching people."
              description="Try another username."
              compact
            />
          )}
        </SocialSection>
      )}

      {show('requests') && (
        <>
          <SocialSection title="Pending requests" count={requests?.incoming.length ?? 0}>
            {requests === undefined ? (
              <Text style={{ color: tokens.foregroundMuted }}>Loading requests…</Text>
            ) : requests.incoming.length ? (
              requests.incoming.map(({ requestId, user, createdAt }) =>
                personRow(user, `Requested ${new Date(createdAt).toLocaleDateString()}`, {
                  requestId,
                  user,
                  createdAt,
                }),
              )
            ) : (
              <FinanceEmptyState
                kind="people"
                title="No requests waiting."
                description="New friend requests will appear here."
                compact
              />
            )}
          </SocialSection>
          <SocialSection title="Sent requests" count={requests?.outgoing.length ?? 0}>
            {requests === undefined ? (
              <Text style={{ color: tokens.foregroundMuted }}>Loading sent requests…</Text>
            ) : requests.outgoing.length ? (
              requests.outgoing.map(({ requestId, user, createdAt }) =>
                personRow(user, `Sent ${new Date(createdAt).toLocaleDateString()}`, undefined, {
                  requestId,
                  user,
                  createdAt,
                }),
              )
            ) : (
              <FinanceEmptyState
                kind="people"
                title="No sent requests."
                description="Friend requests you send will stay here until they respond."
                compact
              />
            )}
          </SocialSection>
        </>
      )}

      {show('friends') && (
        <SocialSection title="Friends" count={friends?.length ?? 0}>
          {friends === undefined ? (
            <Text style={{ color: tokens.foregroundMuted }}>Loading friends…</Text>
          ) : friends.length ? (
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
      )}

      {show('friends') && (
        <SocialSection title="People you may know" count={suggestions?.length ?? 0}>
          {suggestions === undefined ? (
            <Text style={{ color: tokens.foregroundMuted }}>
              Finding people from your mutual connections…
            </Text>
          ) : suggestions.length ? (
            suggestions.map((profile) => {
              const { incoming, outgoing } = requestFor(profile);
              return personRow(
                profile,
                `${profile.mutualFriendCount} mutual ${profile.mutualFriendCount === 1 ? 'friend' : 'friends'}`,
                incoming,
                outgoing,
              );
            })
          ) : (
            <FinanceEmptyState
              kind="people"
              title="No suggestions yet."
              description="Add friends to build your network and discover mutual connections."
              compact
            />
          )}
        </SocialSection>
      )}

      {show('messages') && (
        <SocialSection title="Recent conversations" count={conversations?.length ?? 0}>
          {conversations === undefined ? (
            <Text style={{ color: tokens.foregroundMuted }}>Loading conversations…</Text>
          ) : conversations.length ? (
            conversations.map((conversation) => (
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
                    Open
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
      )}

      {show('friends') && (
        <SocialSection title="Groups">
          <View style={{ gap: 12 }}>
            <Text style={{ color: tokens.foregroundMuted, lineHeight: 20 }}>
              Create a group to split expenses with friends or family.
            </Text>
            <Button variant="outline" onPress={() => router.push('/groups/new' as never)}>
              Create a group
            </Button>
          </View>
        </SocialSection>
      )}
    </ScrollView>
  );
}
