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
        defaultAccountId: profile.defaultAccountId ?? null,
        defaultExpenseCategoryId: profile.defaultExpenseCategoryId ?? null,
        defaultIncomeCategoryId: profile.defaultIncomeCategoryId ?? null,
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
    description:
      'Turn notification categories on or off. Read the current values with finapp.personal.notifications.summary first and send them all back with your changes.',
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
        social: z.boolean().optional().describe('Friend requests and direct messages.'),
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
    name: 'finapp.personal.notifications.summary',
    title: 'Notification status',
    description:
      'Your unread notification count and which notification categories are on. unreadCapped=true means only the newest 500 notifications were counted.',
    scope: 'finapp:read',
    input: {},
    run: () => client.query(api.mcp.notificationState, {}),
    summarize: (data) => {
      const state = data as { unreadCount?: number; unreadCapped?: boolean } | null;
      if (typeof state?.unreadCount !== 'number') return undefined;
      return `${state.unreadCount}${state.unreadCapped ? '+' : ''} unread notification(s).`;
    },
  }),
  defineTool({
    name: 'finapp.personal.privacy.get',
    title: 'Get privacy settings',
    description:
      'Your privacy settings: whether others see your active status and last-seen time, whether you appear in people search (discoverable), who can send you friend requests, and new-device sign-in alerts. deletionRequestedAt is set when account deletion is pending.',
    scope: 'finapp:read',
    input: {},
    run: () => client.query(api.security.privacy, {}),
  }),
  defineTool({
    name: 'finapp.personal.privacy.update',
    title: 'Update privacy settings',
    description:
      'Change any of your privacy settings; omitted fields keep their current value. Returns the full updated settings.',
    scope: 'finapp:write:personal',
    idempotent: true,
    input: {
      showActive: z.boolean().optional().describe('Show when you are active.'),
      showLastSeen: z.boolean().optional().describe('Show your last-seen time.'),
      discoverable: z
        .boolean()
        .optional()
        .describe('Appear in people search (an exact username or email still finds you).'),
      friendRequests: z
        .enum(['everyone', 'nobody'])
        .optional()
        .describe('Who can send you friend requests.'),
      signInAlerts: z.boolean().optional().describe('Notify you when a new device signs in.'),
    },
    run: (args) => client.mutation(api.security.updatePrivacy, args),
  }),
  defineTool({
    name: 'finapp.personal.security.get',
    title: 'Get security status',
    description:
      'Whether two-factor sign-in is enabled, plus authenticator-app (TOTP) status and how many recovery codes remain. Read-only: security changes need the app.',
    scope: 'finapp:read',
    input: {},
    run: async () => {
      const [preferences, factors] = await Promise.all([
        client.query(api.users.queries.securityPreferences, {}),
        client.query(api.mfa.status, {}),
      ]);
      return { ...(preferences ?? {}), authenticator: factors };
    },
  }),
  defineTool({
    name: 'finapp.personal.sessions.list',
    title: 'List signed-in devices',
    description:
      'Devices currently signed in to your account (label, platform, sign-in and last-seen time), most recent first. Read-only: sign devices out from the app.',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ items: await client.query(api.security.sessions, {}) }),
  }),
  defineTool({
    name: 'finapp.personal.finai_settings.get',
    title: 'Get FinAI settings',
    description:
      'Your in-app FinAI assistant preferences (tone, length, language, data scopes, whether it may take actions, attachment retention). Read-only.',
    scope: 'finapp:read',
    input: {},
    run: () => client.query(api.ai.settings.get, {}),
  }),
  defineTool({
    name: 'finapp.personal.avatars.list',
    title: 'List avatars',
    description:
      'The built-in avatars you can choose from; pass an avatarId to finapp.personal.profile.update.',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ items: await client.query(api.avatars.queries.list, {}) }),
  }),
];
