import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Avatar, Button, Input, Separator, Text, Typography, useTheme } from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '@/lib/toast';
import GroupsScreen from './groups';

type Profile = { id: Id<'users'>; username?: string; displayName: string; avatarId?: string };

function PersonRow({
  profile,
  action,
  onPress,
}: {
  profile: Profile;
  action?: React.ReactNode;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Avatar
        label={profile.displayName}
        initials={profile.displayName.slice(0, 2).toUpperCase()}
        size={42}
        avatarId={profile.avatarId}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: tokens.foreground, fontFamily: 'SpaceGrotesk_600SemiBold' }}
          onPress={onPress}
        >
          {profile.displayName}
        </Text>
        {profile.username ? (
          <Text style={{ color: tokens.foregroundMuted, fontSize: 13 }} onPress={onPress}>
            @{profile.username}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export default function PeopleScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const friends = useQuery(api.social.queries.friends, {});
  const requests = useQuery(api.social.queries.requests, {});
  const conversations = useQuery(api.directMessages.queries.listConversations, {});
  const results = useQuery(
    api.users.queries.search,
    search.trim().length ? { query: search.trim() } : 'skip',
  );
  const sendRequest = useMutation(api.social.mutations.sendRequest);
  const respond = useMutation(api.social.mutations.respondToRequest);
  const cancel = useMutation(api.social.mutations.cancelRequest);
  const startConversation = useMutation(api.directMessages.mutations.startConversation);
  const friendIds = useMemo(
    () => new Set((friends ?? []).map((item) => String(item.id))),
    [friends],
  );
  const incomingIds = useMemo(
    () => new Set((requests?.incoming ?? []).map((item) => String(item.user.id))),
    [requests],
  );
  const outgoingIds = useMemo(
    () => new Set((requests?.outgoing ?? []).map((item) => String(item.user.id))),
    [requests],
  );

  const openProfile = (username?: string) =>
    username && router.push(`/@${encodeURIComponent(username)}` as never);
  async function message(userId: Id<'users'>) {
    try {
      const id = await startConversation({ userId });
      router.push(`/messages/${encodeURIComponent(String(id))}` as never);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start conversation');
    }
  }
  const section = { gap: 4, marginTop: 18 } as const;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Typography variant="title">People</Typography>
      <View style={section}>
        <Typography variant="label">Find people</Typography>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by username"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {results?.map((person) => {
          const profile = person as Profile;
          const id = String(profile.id);
          const action = friendIds.has(id) ? (
            <Button size="sm" variant="outline" onPress={() => void message(profile.id)}>
              Message
            </Button>
          ) : incomingIds.has(id) ? (
            <Button
              size="sm"
              onPress={() => {
                const request = requests?.incoming.find((r) => String(r.user.id) === id);
                if (request)
                  void respond({ requestId: request.requestId, response: 'accept' }).catch((e) =>
                    toast.error(String(e)),
                  );
              }}
            >
              Accept
            </Button>
          ) : outgoingIds.has(id) ? (
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                const request = requests?.outgoing.find((r) => String(r.user.id) === id);
                if (request)
                  void cancel({ requestId: request.requestId }).catch((e) =>
                    toast.error(String(e)),
                  );
              }}
            >
              Sent
            </Button>
          ) : (
            <Button
              size="sm"
              onPress={() =>
                void sendRequest({ recipientId: profile.id }).catch((e) =>
                  toast.error(e instanceof Error ? e.message : 'Request failed'),
                )
              }
            >
              Add
            </Button>
          );
          return (
            <PersonRow
              key={id}
              profile={profile}
              onPress={() => openProfile(profile.username)}
              action={action}
            />
          );
        })}
      </View>
      {(requests?.incoming.length ?? 0) > 0 && (
        <View style={section}>
          <Typography variant="label">Friend requests</Typography>
          {requests?.incoming.map(({ requestId, user }) => (
            <PersonRow
              key={requestId}
              profile={user as Profile}
              onPress={() => openProfile(user.username)}
              action={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Button
                    size="sm"
                    onPress={() =>
                      void respond({ requestId, response: 'accept' }).catch((e) =>
                        toast.error(String(e)),
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      void respond({ requestId, response: 'decline' }).catch((e) =>
                        toast.error(String(e)),
                      )
                    }
                  >
                    Decline
                  </Button>
                </View>
              }
            />
          ))}
        </View>
      )}
      {(requests?.outgoing.length ?? 0) > 0 && (
        <View style={section}>
          <Typography variant="label">Sent requests</Typography>
          {requests?.outgoing.map(({ requestId, user }) => (
            <PersonRow
              key={requestId}
              profile={user as Profile}
              onPress={() => openProfile(user.username)}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => void cancel({ requestId }).catch((e) => toast.error(String(e)))}
                >
                  Cancel
                </Button>
              }
            />
          ))}
        </View>
      )}
      <View style={section}>
        <Typography variant="label">Friends</Typography>
        {friends?.map((friend) => (
          <PersonRow
            key={String(friend.id)}
            profile={friend as Profile}
            onPress={() => openProfile(friend.username)}
            action={
              <Button size="sm" variant="outline" onPress={() => void message(friend.id)}>
                Message
              </Button>
            }
          />
        ))}
        {friends?.length === 0 && (
          <Text style={{ color: tokens.foregroundMuted }}>
            Your accepted friends will appear here.
          </Text>
        )}
      </View>
      <View style={section}>
        <Typography variant="label">Messages</Typography>
        {conversations?.map((conversation) => {
          const user = conversation as typeof conversation & {
            displayName?: string;
            avatarId?: string;
            username?: string;
          };
          const profile: Profile = {
            id: user.userId,
            username: user.username,
            displayName: user.displayName ?? 'Finapp user',
            avatarId: user.avatarId,
          };
          return (
            <PersonRow
              key={String(user.id)}
              profile={profile}
              onPress={() => openProfile(profile.username)}
              action={
                <Button
                  size="sm"
                  onPress={() =>
                    router.push(`/messages/${encodeURIComponent(String(user.id))}` as never)
                  }
                >
                  Open
                </Button>
              }
            />
          );
        })}
        {conversations?.length === 0 && (
          <Text style={{ color: tokens.foregroundMuted }}>Start a conversation with a friend.</Text>
        )}
      </View>
      <Separator />
      <View style={{ marginTop: 16 }}>
        <Typography variant="heading">Groups</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          Your groups, invitations, and shared spending.
        </Text>
      </View>
      <GroupsScreen />
    </ScrollView>
  );
}
