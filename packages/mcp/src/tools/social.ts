import { api } from '../../../../convex/_generated/api';
import { z } from 'zod';
import {
  confirm,
  cursor,
  defineTool,
  docId,
  id,
  limit,
  page,
  timestamp,
  type ToolFactory,
} from '../toolkit';

const DAY = 86_400_000;

export const socialTools: ToolFactory = (client) => [
  defineTool({
    name: 'finapp.social.friends.list',
    title: 'List friends',
    description: 'All accepted friends with their usernames.',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ items: await client.query(api.social.queries.friends, {}) }),
  }),
  defineTool({
    name: 'finapp.social.requests.list',
    title: 'List friend requests',
    description: 'One page of pending incoming or outgoing friend requests.',
    scope: 'finapp:read',
    input: { direction: z.enum(['incoming', 'outgoing']).default('incoming'), limit, cursor },
    run: (args) =>
      client.query(api.mcp.listFriendRequests, {
        direction: args.direction,
        paginationOpts: page(args),
      }),
  }),
  defineTool({
    name: 'finapp.social.people.search',
    title: 'Search people',
    description:
      'Find Finapp users by username prefix (at least 2 characters, "@" optional). Returns at most 20.',
    scope: 'finapp:read',
    input: { query: z.string().min(2).max(33).describe('Username prefix, e.g. "neer".') },
    run: async (args) => ({
      items: await client.query(api.mcp.searchPeople, { query: args.query }),
    }),
  }),
  defineTool({
    name: 'finapp.social.people.get',
    title: 'Get person',
    description:
      'Public profile for a username plus your relationship (friends, request pending, none).',
    scope: 'finapp:read',
    input: { username: z.string().min(3).max(33) },
    run: async (args) => {
      const profile = await client.query(api.users.queries.publicProfile, {
        username: args.username.replace(/^@+/, ''),
      });
      if (!profile) return null;
      const match = (
        await client.query(api.mcp.searchPeople, { query: profile.username ?? args.username })
      ).find((person) => person.username === profile.username);
      const relationship = match
        ? await client.query(api.social.queries.relationship, { userId: match.id })
        : null;
      return { ...profile, id: match?.id, relationship };
    },
  }),
  defineTool({
    name: 'finapp.social.people.suggestions',
    title: 'Friend suggestions',
    description: 'People you may know (from shared groups).',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ items: await client.query(api.social.queries.suggestions, {}) }),
  }),
  defineTool({
    name: 'finapp.social.people.frequent',
    title: 'Frequent people',
    description:
      'People you split with most often; amounts are in your default currency (`currency`).',
    scope: 'finapp:read',
    input: {},
    run: async () => {
      const [items, profile] = await Promise.all([
        client.query(api.dashboard.queries.frequentPeople, {}),
        client.query(api.users.queries.current, {}),
      ]);
      // frequentPeople totals only expenses in the default currency.
      return { currency: profile?.defaultCurrency ?? 'INR', items };
    },
  }),
  defineTool({
    name: 'finapp.social.requests.send',
    title: 'Send friend request',
    description: 'Send a friend request to a user id from people.search.',
    scope: 'finapp:write:social',
    input: { recipientId: docId('User') },
    run: (args) =>
      client.mutation(api.social.mutations.sendRequest, {
        recipientId: id<'users'>(args.recipientId),
      }),
  }),
  defineTool({
    name: 'finapp.social.requests.respond',
    title: 'Respond to friend request',
    description: 'Accept or decline an incoming friend request.',
    scope: 'finapp:write:social',
    input: { requestId: docId('Friend request'), response: z.enum(['accept', 'decline']) },
    run: (args) =>
      client.mutation(api.social.mutations.respondToRequest, {
        requestId: id<'friendRequests'>(args.requestId),
        response: args.response,
      }),
  }),
  defineTool({
    name: 'finapp.social.requests.cancel',
    title: 'Cancel friend request',
    description: 'Cancel an outgoing pending friend request.',
    scope: 'finapp:write:social',
    input: { requestId: docId('Friend request') },
    run: (args) =>
      client.mutation(api.social.mutations.cancelRequest, {
        requestId: id<'friendRequests'>(args.requestId),
      }),
  }),
  defineTool({
    name: 'finapp.social.friends.remove',
    title: 'Remove friend',
    description:
      'Unfriend someone after explicit user confirmation. Shared groups, balances and your direct message history stay; either of you can send a new friend request later.',
    scope: 'finapp:write:social',
    destructive: true,
    input: {
      userId: docId('Friend user'),
      confirm: confirm('remove this person from your friends'),
    },
    run: (args) =>
      client.mutation(api.social.mutations.removeFriend, { userId: id<'users'>(args.userId) }),
  }),
  defineTool({
    name: 'finapp.social.inbox',
    title: 'People inbox',
    description:
      'Your friends and people you message, each with their direct conversationId (null if none yet), last message time, unread count and presence (when they share it). Unread conversations come first. Use this to see who messaged you, then read with finapp.social.direct_messages.list.',
    scope: 'finapp:read',
    input: {},
    run: async () => {
      const result = await client.query(api.social.queries.peopleHub, {});
      return { items: result.people, truncated: result.truncated };
    },
    summarize: (data) => {
      const result = data as {
        items?: Array<{ unreadCount?: number }>;
        truncated?: boolean;
      } | null;
      const items = result?.items;
      if (!Array.isArray(items)) return undefined;
      const unread = items.filter((item) => (item.unreadCount ?? 0) > 0).length;
      return `${items.length}${result?.truncated ? '+' : ''} people; ${unread} with unread messages.`;
    },
  }),
  defineTool({
    name: 'finapp.social.people.analytics',
    title: 'Activity with a person',
    description:
      'Your last 30 days with one person: direct messages per day (sent and received), message mix, shared groups and friendship status. Only for people you share a conversation, friendship or group with; returns null otherwise.',
    scope: 'finapp:read',
    input: {
      userId: docId('User'),
      tzOffsetMinutes: z
        .number()
        .int()
        .min(-840)
        .max(840)
        .optional()
        .describe('Minutes east of UTC used for day buckets, e.g. 330 for India. Default 0.'),
    },
    run: (args) =>
      client.query(api.social.queries.personAnalytics, {
        userId: id<'users'>(args.userId),
        tzOffsetMinutes: args.tzOffsetMinutes,
      }),
  }),
  defineTool({
    name: 'finapp.social.direct_messages.conversations.list',
    title: 'List conversations',
    description:
      'One page of your direct conversations with the other person. Conversations are stored on two sides: list `side: "low"` until isDone, then `side: "high"`.',
    scope: 'finapp:read',
    input: { side: z.enum(['low', 'high']).default('low'), limit, cursor },
    run: (args) =>
      client.query(api.mcp.listDirectConversations, {
        side: args.side,
        paginationOpts: page(args),
      }),
  }),
  defineTool({
    name: 'finapp.social.direct_messages.list',
    title: 'List direct messages',
    description:
      'One page of messages from a conversation in a date window (default last 30 days).',
    scope: 'finapp:read',
    input: {
      conversationId: docId('Conversation'),
      startAt: timestamp.optional(),
      endAt: timestamp.optional(),
      limit,
      cursor,
    },
    run: (args) => {
      const endAt = args.endAt ?? Date.now();
      return client.query(api.mcp.listDirectMessages, {
        conversationId: id<'directConversations'>(args.conversationId),
        startAt: args.startAt ?? endAt - 30 * DAY,
        endAt,
        paginationOpts: page(args),
      });
    },
  }),
  defineTool({
    name: 'finapp.social.direct_messages.start',
    title: 'Start conversation',
    description: 'Open (or reuse) a direct conversation with an accepted friend.',
    scope: 'finapp:write:social',
    input: { userId: docId('Friend user') },
    run: async (args) => ({
      conversationId: await client.mutation(api.directMessages.mutations.startConversation, {
        userId: id<'users'>(args.userId),
      }),
    }),
  }),
  defineTool({
    name: 'finapp.social.direct_messages.send',
    title: 'Send direct message',
    description: 'Send a text message in a direct conversation.',
    scope: 'finapp:write:social',
    input: { conversationId: docId('Conversation'), text: z.string().min(1).max(4000) },
    run: (args) =>
      client.mutation(api.directMessages.mutations.sendText, {
        conversationId: id<'directConversations'>(args.conversationId),
        text: args.text,
      }),
  }),
  defineTool({
    name: 'finapp.social.direct_messages.react',
    title: 'React to message',
    description: 'Toggle an emoji reaction on a direct message.',
    scope: 'finapp:write:social',
    input: {
      messageId: docId('Direct message'),
      emoji: z.enum(['❤️', '👍', '😂', '😮']),
    },
    run: (args) =>
      client.mutation(api.directMessages.mutations.toggleReaction, {
        messageId: id<'directMessages'>(args.messageId),
        emoji: args.emoji,
      }),
  }),
  defineTool({
    name: 'finapp.social.direct_messages.pinned',
    title: 'Pinned direct messages',
    description:
      'Pinned messages in a direct conversation plus your unread count and both read positions (epoch ms).',
    scope: 'finapp:read',
    input: { conversationId: docId('Conversation') },
    run: async (args) => {
      const meta = await client.query(api.directMessages.queries.conversationMeta, {
        conversationId: args.conversationId,
      });
      if (!meta) throw new Error('CONVERSATION_UNAVAILABLE');
      return meta;
    },
  }),
  defineTool({
    name: 'finapp.social.direct_messages.pin',
    title: 'Pin or unpin direct message',
    description: 'Pin (or unpin) a message in a direct conversation.',
    scope: 'finapp:write:social',
    input: { messageId: docId('Direct message'), pinned: z.boolean() },
    run: (args) =>
      client.mutation(api.directMessages.mutations.setPinned, {
        messageId: id<'directMessages'>(args.messageId),
        pinned: args.pinned,
      }),
  }),
  defineTool({
    name: 'finapp.social.direct_messages.mark_read',
    title: 'Mark conversation read',
    description:
      'Mark a direct conversation read up to readAt (default now), clearing its unread count. Use after showing the user messages they asked about.',
    scope: 'finapp:write:social',
    idempotent: true,
    input: {
      conversationId: docId('Conversation'),
      readAt: timestamp.optional().describe('Mark messages up to this time read. Default: now.'),
    },
    run: (args) =>
      client.mutation(api.presence.mutations.markRead, {
        scopeType: 'direct',
        scopeId: args.conversationId,
        readAt: args.readAt ?? Date.now(),
      }),
  }),
];
