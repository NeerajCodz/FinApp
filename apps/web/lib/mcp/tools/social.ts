import { api } from '@convex/_generated/api';
import { z } from 'zod';
import {
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
    description: 'People you split with most often.',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ items: await client.query(api.dashboard.queries.frequentPeople, {}) }),
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
    name: 'finapp.social.direct_messages.conversations.list',
    title: 'List conversations',
    description: 'Your direct conversations, most recent first, with the last message preview.',
    scope: 'finapp:read',
    input: {},
    run: async () => ({
      items: await client.query(api.directMessages.queries.listConversations, {}),
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
];
