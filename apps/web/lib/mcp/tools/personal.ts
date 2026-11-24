import { api } from '@convex/_generated/api';
import { z } from 'zod';
import {
  currency,
  cursor,
  defineTool,
  docId,
  id,
  idempotencyKey,
  limit,
  mutationId,
  page,
  timestamp,
  type ToolFactory,
} from '../toolkit';

export const personalTools: ToolFactory = (client) => [
  defineTool({
    name: 'finapp.personal.profile.get',
    title: 'Get my profile',
    description:
      'Your profile: id, display name, username, default currency, timezone, default account and categories.',
    scope: 'finapp:read',
    input: {},
    run: async () => {
      const profile = await client.query(api.users.queries.current, {});
      if (!profile) return null;
      return {
        id: profile._id,
        displayName: profile.displayName,
        username: profile.username,
        defaultCurrency: profile.defaultCurrency,
        timezone: profile.timezone,
        avatarId: profile.avatarId,
        accent: profile.accent,
      };
    },
  }),
  defineTool({
    name: 'finapp.personal.profile.update',
    title: 'Update profile',
    description:
      'Update display name, username, default currency, timezone, accent or avatar. Phone and sign-in security are intentionally excluded.',
    scope: 'finapp:write:personal',
    input: {
      displayName: z.string().min(1).max(80).optional(),
      username: z.string().min(3).max(32).optional(),
      defaultCurrency: currency.optional(),
      timezone: z.string().max(80).optional().describe('IANA zone, e.g. "Asia/Kolkata".'),
      accent: z.string().max(32).optional().describe('"volt", "white", "blue" or a hex colour.'),
      avatarId: z.string().max(32).optional(),
      gender: z.enum(['neutral', 'male', 'female']).optional(),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.users.mutations.update, {
        displayName: args.displayName,
        username: args.username,
        defaultCurrency: args.defaultCurrency,
        timezone: args.timezone,
        // Convex validates the accent (named accent or #RRGGBB) and rejects anything else.
        accent: args.accent as 'volt' | `#${string}` | undefined,
        avatarId: args.avatarId,
        gender: args.gender,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.personal.default_account.set',
    title: 'Set default account',
    description: 'Choose the default account for new transactions, or null to clear.',
    scope: 'finapp:write:personal',
    input: { accountId: docId('Account').nullable(), clientMutationId: mutationId },
    run: (args) =>
      client.mutation(api.users.mutations.setDefaultAccount, {
        accountId: id<'accounts'>(args.accountId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.personal.default_category.set',
    title: 'Set default category',
    description: 'Choose the default category for new expenses or income, or null to clear.',
    scope: 'finapp:write:personal',
    input: {
      transactionType: z.enum(['expense', 'income']),
      categoryId: docId('Category').nullable(),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.users.mutations.setDefaultCategory, {
        transactionType: args.transactionType,
        categoryId: id<'categories'>(args.categoryId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.personal.notifications.list',
    title: 'List notifications',
    description: 'One page of your notifications (newest first), optionally in a date window.',
    scope: 'finapp:read',
    input: { startAt: timestamp.optional(), endAt: timestamp.optional(), limit, cursor },
    run: (args) =>
      client.query(api.mcp.listOwnedRecords, {
        resource: 'notifications',
        startAt: args.startAt,
        endAt: args.endAt,
        paginationOpts: page(args),
      }),
  }),
  defineTool({
    name: 'finapp.personal.notifications.mark_read',
    title: 'Mark notification read',
    description: 'Mark one notification as read.',
    scope: 'finapp:write:personal',
    input: { notificationId: docId('Notification'), clientMutationId: mutationId },
    run: (args) =>
      client.mutation(api.notifications.mutations.markRead, {
        notificationId: id<'notifications'>(args.notificationId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.personal.notifications.mark_all_read',
    title: 'Mark all notifications read',
    description:
      'Mark every unread notification (up to 500 per call; `more` = call again) as read. `before` limits it to notifications created up to that time.',
    scope: 'finapp:write:personal',
    input: { before: timestamp.optional(), clientMutationId: mutationId },
    run: (args) =>
      client.mutation(api.notifications.mutations.markAllRead, {
        before: args.before,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.personal.notifications.preferences.update',
    title: 'Update notification preferences',
    description: 'Turn notification categories on or off.',
    scope: 'finapp:write:personal',
    input: {
      preferences: z.object({
        transaction: z.boolean(),
        budget: z.boolean(),
        goal: z.boolean(),
        recurring: z.boolean(),
        group: z.boolean(),
        split: z.boolean().optional(),
        settlement: z.boolean(),
        security: z.boolean(),
        sync: z.boolean(),
      }),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.notifications.mutations.setPreferences, {
        preferences: args.preferences,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.personal.privacy.get',
    title: 'Get privacy settings',
    description: 'Whether your active status and last-seen time are visible to others.',
    scope: 'finapp:read',
    input: {},
    run: () => client.query(api.presence.queries.privacySettings, {}),
  }),
  defineTool({
    name: 'finapp.personal.privacy.update',
    title: 'Update privacy settings',
    description: 'Show or hide your active status and last-seen time.',
    scope: 'finapp:write:personal',
    input: { showActive: z.boolean(), showLastSeen: z.boolean() },
    run: (args) => client.mutation(api.presence.mutations.setPrivacy, args),
  }),
  defineTool({
    name: 'finapp.personal.security.get',
    title: 'Get security status',
    description: 'Whether two-factor sign-in is enabled (read-only; change it in the app).',
    scope: 'finapp:read',
    input: {},
    run: () => client.query(api.users.queries.securityPreferences, {}),
  }),
];
