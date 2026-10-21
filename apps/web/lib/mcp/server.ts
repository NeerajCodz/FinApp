
import { api } from '@convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const readScope = 'finapp:read';
const pageShape = {
  limit: z.number().int().min(1).max(100).default(25).describe('Maximum results to return; hard limit 100.'),
  cursor: z.string().nullable().optional().describe('Cursor from the previous page; omit for the first page.'),
  startAt: z.number().optional().describe('Inclusive Unix timestamp in milliseconds.'),
  endAt: z.number().optional().describe('Exclusive Unix timestamp in milliseconds.'),
};

type ToolArgs = Record<string, unknown>;
type ToolExecutor = (args: ToolArgs) => Promise<unknown>;

function mcpResult(data: unknown) {
  const structuredContent = JSON.parse(
    JSON.stringify(data, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value)),
  ) as unknown;
  const json = JSON.stringify(structuredContent);
  return {
    structuredContent: { data: structuredContent },
    content: [{ type: 'text' as const, text: json }],
  };
}

export function createMcpServer(client: ConvexHttpClient, scopes: readonly string[], grantId: string) {
  const server = new McpServer(
    { name: 'finapp', version: '1.3.0' },
    {
      instructions:
        'Start with finapp.catalog to discover domain parents. Use domain-specific tools with explicit time ranges, filters, cursors, and limits; fetch one bounded page at a time. Never request an unbounded history. Write actions require the matching granted scope.',
    },
  );
  const recordActivity = async (toolName: string, succeeded: boolean) => {
    try {
      await client.mutation(api.mcpOAuth.recordToolInvocation, {
        grantId: grantId as never,
        toolName,
        succeeded,
      });
    } catch {
      // Activity failures must not change the tool result.
    }
  };

  const registerReadTool = (
    name: string,
    title: string,
    description: string,
    inputSchema: Record<string, z.ZodType>,
    execute: ToolExecutor,
  ) => {
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args) => {
        if (!scopes.includes(readScope)) {
          await recordActivity(name, false);
          return { isError: true, content: [{ type: 'text', text: 'Missing required scope: finapp:read.' }] };
        }
        try {
          const result = await execute(args as ToolArgs);
          await recordActivity(name, true);
          return mcpResult(result);
        } catch (error) {
          await recordActivity(name, false);
          const message = error instanceof Error ? error.message : 'The request failed.';
          return { isError: true, content: [{ type: 'text', text: message }] };
        }
      },
    );
  };
  const registerWriteTool = (
    name: string,
    title: string,
    description: string,
    scope: 'finapp:write:finance' | 'finapp:write:social' | 'finapp:write:groups' | 'finapp:write:personal',
    inputSchema: Record<string, z.ZodType>,
    execute: ToolExecutor,
    destructive = false,
  ) => {
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: destructive,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (args) => {
        if (!scopes.includes(scope)) {
          await recordActivity(name, false);
          return { isError: true, content: [{ type: 'text', text: `Missing required scope: ${scope}.` }] };
        }
        try {
          const result = await execute(args as ToolArgs);
          await recordActivity(name, true);
          return mcpResult(result);
        } catch (error) {
          await recordActivity(name, false);
          const message = error instanceof Error ? error.message : 'The request failed.';
          return { isError: true, content: [{ type: 'text', text: message }] };
        }
      },
    );
  };

  const minorUnits = z
    .string()
    .regex(/^\d{1,19}$/, 'Use a non-negative integer string in minor currency units.')
    .transform((value) => BigInt(value))
    .refine((value) => value <= 9_223_372_036_854_775_807n, 'Amount exceeds signed 64-bit range.');
  const mutationId = z.string().uuid();
  const idempotencyKey = (value: unknown) =>
    typeof value === 'string' && value.length > 0 ? value : crypto.randomUUID();

  server.registerTool(
    'finapp.catalog',
    {
      title: 'Discover Finapp domains',
      description: 'Parent discovery tool. Call first to inspect feature domains, their child tools, and filter/pagination expectations.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const data = {
        domains: Object.entries(domainParents).map(([domain, manifest]) => ({
          parent: `finapp.${domain}.parent`,
          children: manifest.children,
          filters: manifest.filters,
        })),
        pagination: { defaultLimit: 25, maximumLimit: 100, cursor: 'Pass nextCursor from a previous result.' },
        timestamps: 'All time filters are Unix epoch milliseconds; startAt is inclusive and endAt is exclusive. Time-filtered query windows are at most 366 days.',
      };
      await recordActivity('finapp.catalog', true);
      return mcpResult(data);
    },
  );

  server.registerResource(
    'Finapp capability catalog',
    'finapp://catalog',
    { mimeType: 'application/json', description: 'Domain parent tool names, available child tools, filters, and pagination contract.' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            domains: Object.entries(domainParents).map(([domain, manifest]) => ({
              parent: `finapp.${domain}.parent`,
              children: manifest.children,
              filters: manifest.filters,
            })),
            paging: { defaultLimit: 25, maximumLimit: 100 },
            time: { unit: 'milliseconds', startAt: 'inclusive', endAt: 'exclusive', maxRangeDays: 366 },
          }),
        },
      ],
    }),
  );

  const domainParents = {
    finance: {
      children: [
        'finapp.finance.transactions.list',
        'finapp.finance.transactions.create',
        'finapp.finance.transactions.update',
        'finapp.finance.transactions.delete',
        'finapp.finance.accounts.rename',
        'finapp.finance.accounts.archive',
        'finapp.finance.accounts.list',
        'finapp.finance.accounts.create',
        'finapp.finance.categories.rename',
        'finapp.finance.categories.archive',
        'finapp.finance.categories.list',
        'finapp.finance.categories.create',
        'finapp.finance.budgets.update',
        'finapp.finance.budgets.archive',
        'finapp.finance.budgets.list',
        'finapp.finance.budgets.create',
        'finapp.finance.goals.update',
        'finapp.finance.goals.archive',
        'finapp.finance.goals.list',
        'finapp.finance.goals.create',
        'finapp.finance.goals.contribute',
        'finapp.finance.goal_contributions.list',
        'finapp.finance.recurring.list',
        'finapp.finance.recurring.create',
        'finapp.finance.recurring.set_enabled',
        'finapp.finance.dashboard.summary',
        'finapp.finance.analytics.summary',
      ],
      filters: ['startAt', 'endAt', 'accountId', 'categoryId', 'type', 'search', 'limit', 'cursor'],
    },
    social: {
      children: [
        'finapp.social.friends.list',
        'finapp.social.requests.list',
        'finapp.social.people.search',
        'finapp.social.requests.send',
        'finapp.social.requests.respond',
        'finapp.social.requests.cancel',
        'finapp.social.direct_messages.start',
        'finapp.social.direct_messages.conversations.list',
        'finapp.social.direct_messages.list',
        'finapp.social.direct_messages.send',
      ],
      filters: ['direction', 'side', 'limit', 'cursor'],
    },
    groups: {
      children: [
        'finapp.groups.create',
        'finapp.groups.list',
        'finapp.groups.detail.get',
        'finapp.groups.members.list',
        'finapp.groups.members.invite',
        'finapp.groups.invitations.list',
        'finapp.groups.invitations.respond',
        'finapp.groups.expenses.list',
        'finapp.groups.expenses.create',
        'finapp.groups.settlements.list',
        'finapp.groups.settlements.create',
        'finapp.groups.messages.list',
        'finapp.groups.messages.send',
      ],
      filters: ['groupId', 'startAt', 'endAt', 'limit', 'cursor'],
    },
    personal: {
      children: [
        'finapp.personal.profile.get',
        'finapp.personal.profile.update',
        'finapp.personal.default_account.set',
        'finapp.personal.notifications.list',
        'finapp.personal.notifications.mark_read',
        'finapp.personal.notifications.preferences.update',
        'finapp.personal.privacy.get',
        'finapp.personal.privacy.update',
      ],
      filters: ['startAt', 'endAt', 'limit', 'cursor'],
    },
  } as const;
  for (const [domain, manifest] of Object.entries(domainParents)) {
    registerReadTool(
      `finapp.${domain}.parent`,
      `Discover ${domain} tools`,
      `Parent discovery for ${domain}. Returns child tool names and available filters without reading personal records.`,
      {},
      async () => ({
        domain,
        children: manifest.children,
        filters: manifest.filters,
        pagination: { defaultLimit: 25, maximumLimit: 100 },
        timestamps: 'Unix epoch milliseconds; startAt inclusive and endAt exclusive; max range 366 days.',
      }),
    );
  }

  registerReadTool(
    'finapp.personal.profile.get',
    'Get my profile',
    'Read the authenticated user profile. Returns only the profile associated with this authorized MCP connection.',
    {},
    async () => {
      const profile = await client.query(api.users.queries.current, {});
      if (!profile) return null;
      return {
        id: profile._id,
        displayName: profile.displayName,
        username: profile.username,
        defaultCurrency: profile.defaultCurrency,
        timezone: profile.timezone,
        avatarId: profile.avatarId,
      };
    },
  );

  registerReadTool(
    'finapp.finance.transactions.list',
    'List transactions',
    'Finance parent: fetch a bounded transaction page for a time range, optionally filtered by account, category, type, or title/merchant search. Time range is at most 366 days.',
    {
      ...pageShape,
      startAt: z.number().describe('Required inclusive Unix timestamp in milliseconds.'),
      endAt: z.number().describe('Required exclusive Unix timestamp in milliseconds.'),
      accountId: z.string().optional(),
      categoryId: z.string().optional(),
      type: z.enum(['expense', 'income', 'transfer', 'refund', 'adjustment']).optional(),
      search: z.string().max(120).optional(),
    },
    async (args) =>
      client.query(api.mcp.listTransactions, {
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        accountId: args.accountId as string | undefined,
        categoryId: args.categoryId as string | undefined,
        type: args.type as 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment' | undefined,
        search: args.search as string | undefined,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );

  const recordDescriptions = {
    accounts: 'List my active accounts. Parent: finance.accounts. Returns a bounded page.',
    categories: 'List my active categories. Parent: finance.categories. Returns a bounded page.',
    budgets: 'List my active budgets. Parent: finance.budgets. Returns a bounded page.',
    goals: 'List my active goals. Parent: finance.goals. Returns a bounded page.',
    goalContributions: 'List my goal contributions. Parent: finance.goal_contributions. Filter by time and page.',
    recurringRules: 'List my recurring items. Parent: finance.recurring. Returns a bounded page.',
    notifications: 'List my notifications. Parent: personal.notifications. Filter by time and page.',
  } as const;
  const recordNames = {
    accounts: 'finapp.finance.accounts.list',
    categories: 'finapp.finance.categories.list',
    budgets: 'finapp.finance.budgets.list',
    goals: 'finapp.finance.goals.list',
    goalContributions: 'finapp.finance.goal_contributions.list',
    recurringRules: 'finapp.finance.recurring.list',
    notifications: 'finapp.personal.notifications.list',
  } as const;
  for (const resource of Object.keys(recordNames) as Array<keyof typeof recordNames>) {
    registerReadTool(recordNames[resource], `List ${resource}`, recordDescriptions[resource], pageShape, async (args) =>
      client.query(api.mcp.listOwnedRecords, {
        resource,
        startAt: args.startAt as number | undefined,
        endAt: args.endAt as number | undefined,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
    );
  }

  registerReadTool(
    'finapp.finance.dashboard.summary',
    'Summarize a bounded dashboard page',
    'Finance parent: aggregate only one bounded page of transactions from an explicit date range (up to 366 days). Combine page totals yourself when isDone is false; use nextCursor to continue.',
    {
      startAt: z.number().describe('Inclusive Unix timestamp in milliseconds.'),
      endAt: z.number().describe('Exclusive Unix timestamp in milliseconds.'),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.dashboardPreview, {
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );

  registerReadTool(
    'finapp.finance.analytics.summary',
    'Compare bounded analytics pages',
    'Finance parent: compare one page of transactions in a current date range with its preceding range. Results are page-level until isDone is true; continue using nextCursor.',
    {
      period: z.enum(['week', 'month', 'year']),
      startAt: z.number(),
      endAt: z.number(),
      previousStartAt: z.number(),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.analyticsPreview, {
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        previousStartAt: args.previousStartAt as number,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );

  registerReadTool(
    'finapp.social.friends.list',
    'List my friends',
    'Social parent: fetch one page of friends on the selected relationship side.',
    {
      side: z.enum(['low', 'high']),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listFriends, {
        side: args.side as 'low' | 'high',
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.social.direct_messages.conversations.list',
    'List direct conversations',
    'Social parent: fetch one page of conversations from the selected relationship side. Call for both low and high to inspect both indexed halves.',
    {
      side: z.enum(['low', 'high']),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listDirectConversations, {
        side: args.side as 'low' | 'high',
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.social.direct_messages.list',
    'List direct messages',
    'Social parent: fetch a date-bounded page of text and attachment metadata from a conversation where the user participates.',
    {
      conversationId: z.string(),
      startAt: z.number(),
      endAt: z.number(),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listDirectMessages, {
        conversationId: args.conversationId as never,
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.social.requests.list',
    'List my friend requests',
    'Social parent: fetch one page of incoming or outgoing pending requests.',
    {
      direction: z.enum(['incoming', 'outgoing']),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listFriendRequests, {
        direction: args.direction as 'incoming' | 'outgoing',
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.social.people.search',
    'Search people',
    'Social parent: search public Finapp usernames by prefix. Returns at most 20 bounded results; requires at least two username characters.',
    { query: z.string().min(2).max(32) },
    (args) => client.query(api.mcp.searchPeople, { query: args.query as string }),
  );
  registerReadTool(
    'finapp.groups.list',
    'List my groups',
    'Groups parent: fetch one page of groups the authorized user belongs to.',
    { limit: z.number().int().min(1).max(100).default(25), cursor: z.string().nullable().optional() },
    (args) =>
      client.query(api.mcp.listGroups, {
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.groups.detail.get',
    'Get group details',
    'Groups parent: fetch safe metadata for one group where the authorized user is a current member. Use separate paginated child tools for members, expenses, settlements, and messages.',
    { groupId: z.string() },
    (args) => client.query(api.mcp.groupSummary, { groupId: args.groupId as never }),
  );
  registerReadTool(
    'finapp.groups.expenses.list',
    'List group expenses',
    'Groups parent: fetch one date-bounded page of a group expense ledger. Start is inclusive, end exclusive, and the window is at most 366 days.',
    {
      groupId: z.string(),
      startAt: z.number(),
      endAt: z.number(),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listGroupExpenses, {
        groupId: args.groupId as never,
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.groups.members.list',
    'List group members',
    'Groups parent: fetch one page of member identities for a group where the user is a current member.',
    {
      groupId: z.string(),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listGroupMembers, {
        groupId: args.groupId as never,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.groups.invitations.list',
    'List group invitations',
    'Groups parent: fetch one page of pending invitations matched to the authenticated account. Call with each supported lookup mode: user, username, and email.',
    {
      lookup: z.enum(['user', 'username', 'email']),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listGroupInvitations, {
        lookup: args.lookup as 'user' | 'username' | 'email',
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.groups.settlements.list',
    'List group settlements',
    'Groups parent: fetch one date-bounded page of settlement records. Start is inclusive, end exclusive, and the window is at most 366 days.',
    {
      groupId: z.string(),
      startAt: z.number(),
      endAt: z.number(),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listGroupSettlements, {
        groupId: args.groupId as never,
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );
  registerReadTool(
    'finapp.groups.messages.list',
    'List group messages',
    'Groups parent: fetch a bounded, date-filtered page of messages from a group where the user is a current member.',
    {
      groupId: z.string(),
      startAt: z.number(),
      endAt: z.number(),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().nullable().optional(),
    },
    (args) =>
      client.query(api.mcp.listGroupMessages, {
        groupId: args.groupId as never,
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        paginationOpts: {
          numItems: args.limit as number,
          cursor: (args.cursor as string | null | undefined) ?? null,
        },
      }),
  );

  registerReadTool(
    'finapp.personal.privacy.get',
    'Get privacy settings',
    'Read the authenticated user’s presence and last-seen privacy preferences.',
    {},
    () => client.query(api.presence.queries.privacySettings, {}),
  );
  registerWriteTool(
    'finapp.personal.profile.update',
    'Update profile',
    'Update supported profile fields for the authenticated Finapp user. Phone number and authentication security settings are intentionally excluded.',
    'finapp:write:personal',
    {
      displayName: z.string().min(1).max(80).optional(),
      username: z.string().min(3).max(32).optional(),
      defaultCurrency: z.string().length(3).optional(),
      timezone: z.string().max(80).optional(),
      accent: z.string().max(32).optional(),
      avatarId: z.string().max(32).optional(),
      gender: z.enum(['neutral', 'male', 'female']).optional(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.users.mutations.update, {
        displayName: args.displayName as string | undefined,
        username: args.username as string | undefined,
        defaultCurrency: args.defaultCurrency as string | undefined,
        timezone: args.timezone as string | undefined,
        accent: args.accent as 'volt' | 'white' | 'blue' | `#${string}` | undefined,
        avatarId: args.avatarId as string | undefined,
        gender: args.gender as 'neutral' | 'male' | 'female' | undefined,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.personal.default_account.set',
    'Set default account',
    'Choose an owned account as the default or clear the current default.',
    'finapp:write:personal',
    { accountId: z.string().nullable(), clientMutationId: mutationId },
    (args) =>
      client.mutation(api.users.mutations.setDefaultAccount, {
        accountId: args.accountId as never,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.personal.privacy.update',
    'Update privacy preferences',
    'Set whether Finapp shows the authenticated user’s active status and last-seen time.',
    'finapp:write:personal',
    { showActive: z.boolean(), showLastSeen: z.boolean() },
    (args) =>
      client.mutation(api.presence.mutations.setPrivacy, {
        showActive: args.showActive as boolean,
        showLastSeen: args.showLastSeen as boolean,
      }),
  );
  registerWriteTool(
    'finapp.personal.notifications.preferences.update',
    'Update notification preferences',
    'Set personal notification categories for the authenticated Finapp account.',
    'finapp:write:personal',
    {
      preferences: z.object({
        transaction: z.boolean(),
        budget: z.boolean(),
        goal: z.boolean(),
        recurring: z.boolean(),
        group: z.boolean(),
        settlement: z.boolean(),
        security: z.boolean(),
        sync: z.boolean(),
      }),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.notifications.mutations.setPreferences, {
        preferences: args.preferences as {
          transaction: boolean;
          budget: boolean;
          goal: boolean;
          recurring: boolean;
          group: boolean;
          settlement: boolean;
          security: boolean;
          sync: boolean;
        },
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );

  registerWriteTool(
    'finapp.finance.transactions.create',
    'Create transaction',
    'Record one transaction for an owned account. Amount is an integer string in minor currency units; use the account, category, and currency returned by finance parent tools.',
    'finapp:write:finance',
    {
      accountId: z.string(),
      type: z.enum(['expense', 'income', 'transfer', 'refund', 'adjustment']),
      amountMinor: minorUnits,
      currency: z.string().length(3),
      categoryId: z.string().optional(),
      title: z.string().min(1).max(200),
      merchant: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
      transferAccountId: z.string().optional(),
      occurredAt: z.number().finite(),
      hasTime: z.boolean().optional(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.transactions.mutations.create, {
        accountId: args.accountId as never,
        type: args.type as 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment',
        amountMinor: args.amountMinor as bigint,
        currency: args.currency as string,
        categoryId: args.categoryId as never,
        title: args.title as string,
        merchant: args.merchant as string | undefined,
        note: args.note as string | undefined,
        transferAccountId: args.transferAccountId as never,
        occurredAt: args.occurredAt as number,
        hasTime: args.hasTime as boolean | undefined,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.transactions.update',
    'Update transaction',
    'Replace editable fields on one personal transaction owned by the authenticated user.',
    'finapp:write:finance',
    {
      transactionId: z.string(),
      accountId: z.string(),
      type: z.enum(['expense', 'income', 'transfer']),
      amountMinor: minorUnits,
      currency: z.string().length(3),
      categoryId: z.string().optional(),
      title: z.string().min(1).max(200),
      merchant: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
      transferAccountId: z.string().optional(),
      occurredAt: z.number().finite(),
      hasTime: z.boolean().optional(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.transactions.mutations.update, {
        transactionId: args.transactionId as never,
        accountId: args.accountId as never,
        type: args.type as 'expense' | 'income' | 'transfer',
        amountMinor: args.amountMinor as bigint,
        currency: args.currency as string,
        categoryId: args.categoryId as never,
        title: args.title as string,
        merchant: args.merchant as string | undefined,
        note: args.note as string | undefined,
        transferAccountId: args.transferAccountId as never,
        occurredAt: args.occurredAt as number,
        hasTime: args.hasTime as boolean | undefined,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.transactions.delete',
    'Delete transaction',
    'Soft-delete one personal transaction. Requires explicit confirmation; group ledger entries cannot be deleted with this tool.',
    'finapp:write:finance',
    {
      transactionId: z.string(),
      confirm: z.literal(true).describe('Set true only after the user explicitly confirms this deletion.'),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.transactions.mutations.softDelete, {
        transactionId: args.transactionId as never,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
    true,
  );
  registerWriteTool(
    'finapp.finance.accounts.create',
    'Create account',
    'Create an account owned by the authenticated user.',
    'finapp:write:finance',
    {
      name: z.string().min(1).max(120),
      type: z.enum(['cash', 'bank', 'card', 'wallet', 'loan', 'other']),
      currency: z.string().length(3),
      openingBalanceMinor: minorUnits,
      isIncludedInTotal: z.boolean(),
      includeInAnalytics: z.boolean().optional(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.accounts.mutations.create, {
        name: args.name as string,
        type: args.type as 'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other',
        currency: args.currency as string,
        openingBalanceMinor: args.openingBalanceMinor as bigint,
        isIncludedInTotal: args.isIncludedInTotal as boolean,
        includeInAnalytics: args.includeInAnalytics as boolean | undefined,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.categories.create',
    'Create category',
    'Create an expense or income category owned by the authenticated user.',
    'finapp:write:finance',
    {
      name: z.string().min(1).max(120),
      kind: z.enum(['expense', 'income']).optional(),
      icon: z.string().max(80).optional(),
      color: z.string().max(32).optional(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.categories.mutations.create, {
        name: args.name as string,
        kind: args.kind as 'expense' | 'income' | undefined,
        icon: args.icon as string | undefined,
        color: args.color as string | undefined,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.budgets.create',
    'Create budget',
    'Create a budget for the selected date interval and optional category or account.',
    'finapp:write:finance',
    {
      name: z.string().min(1).max(120),
      amountMinor: minorUnits,
      currency: z.string().length(3),
      period: z.enum(['monthly', 'category', 'account', 'custom']),
      categoryId: z.string().optional(),
      accountId: z.string().optional(),
      startAt: z.number().finite(),
      endAt: z.number().finite(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.budgets.mutations.create, {
        name: args.name as string,
        amountMinor: args.amountMinor as bigint,
        currency: args.currency as string,
        period: args.period as 'monthly' | 'category' | 'account' | 'custom',
        categoryId: args.categoryId as never,
        accountId: args.accountId as never,
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.goals.create',
    'Create savings goal',
    'Create a financial goal with a positive target amount.',
    'finapp:write:finance',
    {
      name: z.string().min(1).max(120),
      targetAmountMinor: minorUnits,
      currency: z.string().length(3),
      targetDate: z.number().finite().optional(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.goals.mutations.create, {
        name: args.name as string,
        targetAmountMinor: args.targetAmountMinor as bigint,
        currency: args.currency as string,
        targetDate: args.targetDate as number | undefined,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.goals.contribute',
    'Contribute to goal',
    'Add a contribution to a goal owned by the authenticated user.',
    'finapp:write:finance',
    {
      goalId: z.string(),
      amountMinor: minorUnits,
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.goals.mutations.contribute, {
        goalId: args.goalId as never,
        amountMinor: args.amountMinor as bigint,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.social.requests.send',
    'Send friend request',
    'Send a friend request to the selected public Finapp user.',
    'finapp:write:social',
    { recipientId: z.string() },
    (args) => client.mutation(api.social.mutations.sendRequest, { recipientId: args.recipientId as never }),
  );
  registerWriteTool(
    'finapp.social.requests.respond',
    'Respond to friend request',
    'Accept or decline an incoming friend request.',
    'finapp:write:social',
    { requestId: z.string(), response: z.enum(['accept', 'decline']) },
    (args) =>
      client.mutation(api.social.mutations.respondToRequest, {
        requestId: args.requestId as never,
        response: args.response as 'accept' | 'decline',
      }),
  );
  registerWriteTool(
    'finapp.groups.create',
    'Create group',
    'Create a shared group. Invite participants by exact Finapp usernames; do not include private contact data.',
    'finapp:write:groups',
    {
      name: z.string().min(1).max(120),
      currency: z.string().length(3),
      memberUsernames: z.array(z.string().min(3).max(32)).max(50).default([]),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.groups.mutations.create, {
        name: args.name as string,
        currency: args.currency as string,
        memberUsernames: args.memberUsernames as string[],
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.groups.messages.send',
    'Send group message',
    'Send a text-only message to a group where the authenticated user is a current member.',
    'finapp:write:groups',
    { groupId: z.string(), text: z.string().min(1).max(4000) },
    (args) =>
      client.mutation(api.groups.mutations.sendChatText, {
        groupId: args.groupId as never,
        text: args.text as string,
      }),
  );
  registerWriteTool(
    'finapp.social.direct_messages.send',
    'Send direct message',
    'Send a text-only direct message to an existing conversation where the authenticated user participates.',
    'finapp:write:social',
    { conversationId: z.string(), text: z.string().min(1).max(4000) },
    (args) =>
      client.mutation(api.directMessages.mutations.sendText, {
        conversationId: args.conversationId as never,
        text: args.text as string,
      }),
  );
  registerWriteTool(
    'finapp.personal.notifications.mark_read',
    'Mark notification as read',
    'Mark one notification belonging to the authenticated user as read.',
    'finapp:write:personal',
    { notificationId: z.string(), clientMutationId: mutationId },
    (args) =>
      client.mutation(api.notifications.mutations.markRead, {
        notificationId: args.notificationId as never,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );

  registerWriteTool(
    'finapp.groups.expenses.create',
    'Add group expense',
    'Record a shared expense for a group and provide each participant split in integer minor units.',
    'finapp:write:groups',
    {
      groupId: z.string(),
      accountId: z.string(),
      title: z.string().min(1).max(200),
      amountMinor: minorUnits,
      currency: z.string().length(3),
      occurredAt: z.number().finite(),
      categoryId: z.string().optional(),
      participants: z.array(
        z.object({
          userId: z.string(),
          amountMinor: minorUnits,
          method: z.enum(['equal', 'exact', 'percentage', 'shares']),
          basisValue: z.string().optional(),
        }),
      ).min(1).max(100),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.groups.mutations.addExpense, {
        groupId: args.groupId as never,
        accountId: args.accountId as never,
        title: args.title as string,
        amountMinor: args.amountMinor as bigint,
        currency: args.currency as string,
        occurredAt: args.occurredAt as number,
        categoryId: args.categoryId as never,
        participants: args.participants as Array<{
          userId: never;
          amountMinor: bigint;
          method: 'equal' | 'exact' | 'percentage' | 'shares';
          basisValue?: string;
        }>,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.groups.settlements.create',
    'Record group settlement',
    'Record a settlement between current group members from the authenticated user’s account.',
    'finapp:write:groups',
    {
      groupId: z.string(),
      fromUserId: z.string(),
      toUserId: z.string(),
      accountId: z.string(),
      amountMinor: minorUnits,
      currency: z.string().length(3),
      occurredAt: z.number().finite(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.settlements.mutations.create, {
        groupId: args.groupId as never,
        fromUserId: args.fromUserId as never,
        toUserId: args.toUserId as never,
        accountId: args.accountId as never,
        amountMinor: args.amountMinor as bigint,
        currency: args.currency as string,
        occurredAt: args.occurredAt as number,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.recurring.create',
    'Create recurring rule',
    'Schedule a recurring expense reminder for an owned account.',
    'finapp:write:finance',
    {
      name: z.string().min(1).max(120),
      amountMinor: minorUnits,
      currency: z.string().length(3),
      accountId: z.string(),
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      nextOccurrence: z.number().finite(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.recurring.mutations.create, {
        name: args.name as string,
        amountMinor: args.amountMinor as bigint,
        currency: args.currency as string,
        accountId: args.accountId as never,
        frequency: args.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
        nextOccurrence: args.nextOccurrence as number,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.recurring.set_enabled',
    'Enable or pause recurring rule',
    'Enable or pause a recurring rule owned by the authenticated user.',
    'finapp:write:finance',
    {
      ruleId: z.string(),
      enabled: z.boolean(),
      clientMutationId: z.string().uuid(),
    },
    (args) =>
      client.mutation(api.recurring.mutations.setEnabled, {
        ruleId: args.ruleId as never,
        enabled: args.enabled as boolean,
        clientMutationId: args.clientMutationId as string,
      }),
  );
  registerWriteTool(
    'finapp.social.direct_messages.start',
    'Start direct conversation',
    'Start or retrieve a direct conversation with an accepted friend.',
    'finapp:write:social',
    { userId: z.string() },
    (args) => client.mutation(api.directMessages.mutations.startConversation, { userId: args.userId as never }),
  );

  registerWriteTool(
    'finapp.groups.invitations.respond',
    'Respond to group invitation',
    'Accept or decline a group invitation addressed to the authenticated user.',
    'finapp:write:groups',
    {
      inviteId: z.string(),
      response: z.enum(['accept', 'decline']),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.groups.mutations.respondToInvitation, {
        inviteId: args.inviteId as never,
        response: args.response as 'accept' | 'decline',
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.groups.members.invite',
    'Invite group member',
    'Invite a Finapp username to a group where the authenticated user is an administrator.',
    'finapp:write:groups',
    { groupId: z.string(), username: z.string().min(3).max(32) },
    (args) =>
      client.mutation(api.groups.mutations.addMember, {
        groupId: args.groupId as never,
        username: args.username as string,
      }),
  );
  registerWriteTool(
    'finapp.social.requests.cancel',
    'Cancel friend request',
    'Cancel an outgoing pending friend request owned by the authenticated user.',
    'finapp:write:social',
    { requestId: z.string() },
    (args) => client.mutation(api.social.mutations.cancelRequest, { requestId: args.requestId as never }),
  );

  registerWriteTool(
    'finapp.finance.accounts.rename',
    'Rename account',
    'Rename an account owned by the authenticated user.',
    'finapp:write:finance',
    { accountId: z.string(), name: z.string().min(1).max(120), clientMutationId: mutationId },
    (args) =>
      client.mutation(api.accounts.mutations.rename, {
        accountId: args.accountId as never,
        name: args.name as string,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.accounts.archive',
    'Archive account',
    'Archive an owned account. Requires explicit user confirmation.',
    'finapp:write:finance',
    {
      accountId: z.string(),
      confirm: z.literal(true).describe('Set true only after the user explicitly confirms this archive.'),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.accounts.mutations.archive, {
        accountId: args.accountId as never,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
    true,
  );
  registerWriteTool(
    'finapp.finance.categories.rename',
    'Rename category',
    'Rename a user-owned category.',
    'finapp:write:finance',
    { categoryId: z.string(), name: z.string().min(1).max(120), clientMutationId: mutationId },
    (args) =>
      client.mutation(api.categories.mutations.rename, {
        categoryId: args.categoryId as never,
        name: args.name as string,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.categories.archive',
    'Archive category',
    'Archive a user-owned category. Requires explicit user confirmation.',
    'finapp:write:finance',
    {
      categoryId: z.string(),
      confirm: z.literal(true).describe('Set true only after the user explicitly confirms this archive.'),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.categories.mutations.archive, {
        categoryId: args.categoryId as never,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
    true,
  );
  registerWriteTool(
    'finapp.finance.budgets.update',
    'Update budget',
    'Update a category budget owned by the authenticated user.',
    'finapp:write:finance',
    {
      budgetId: z.string(),
      name: z.string().min(1).max(120),
      amountMinor: minorUnits,
      currency: z.string().length(3),
      categoryId: z.string(),
      startAt: z.number().finite(),
      endAt: z.number().finite(),
      alertThreshold: z.number().min(0).max(100).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.budgets.mutations.update, {
        budgetId: args.budgetId as never,
        name: args.name as string,
        amountMinor: args.amountMinor as bigint,
        currency: args.currency as string,
        categoryId: args.categoryId as never,
        startAt: args.startAt as number,
        endAt: args.endAt as number,
        alertThreshold: args.alertThreshold as number | null | undefined,
        notes: args.notes as string | null | undefined,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.budgets.archive',
    'Archive budget',
    'Archive a budget owned by the authenticated user. Requires explicit user confirmation.',
    'finapp:write:finance',
    {
      budgetId: z.string(),
      confirm: z.literal(true).describe('Set true only after the user explicitly confirms this archive.'),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.budgets.mutations.archive, {
        budgetId: args.budgetId as never,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
    true,
  );
  registerWriteTool(
    'finapp.finance.goals.update',
    'Update savings goal',
    'Update a goal owned by the authenticated user.',
    'finapp:write:finance',
    {
      goalId: z.string(),
      name: z.string().min(1).max(120),
      targetAmountMinor: minorUnits,
      targetDate: z.number().finite().nullable().optional(),
      monthlyContributionMinor: minorUnits.nullable().optional(),
      accountId: z.string().nullable().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      reminderFrequency: z.enum(['none', 'weekly', 'monthly']).optional(),
      notes: z.string().max(2000).nullable().optional(),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.goals.mutations.update, {
        goalId: args.goalId as never,
        name: args.name as string,
        targetAmountMinor: args.targetAmountMinor as bigint,
        targetDate: args.targetDate as number | null | undefined,
        monthlyContributionMinor: args.monthlyContributionMinor as bigint | null | undefined,
        accountId: args.accountId as never,
        priority: args.priority as 'low' | 'medium' | 'high' | undefined,
        reminderFrequency: args.reminderFrequency as 'none' | 'weekly' | 'monthly' | undefined,
        notes: args.notes as string | null | undefined,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  );
  registerWriteTool(
    'finapp.finance.goals.archive',
    'Archive savings goal',
    'Archive a goal owned by the authenticated user. Requires explicit user confirmation.',
    'finapp:write:finance',
    {
      goalId: z.string(),
      confirm: z.literal(true).describe('Set true only after the user explicitly confirms this archive.'),
      clientMutationId: mutationId,
    },
    (args) =>
      client.mutation(api.goals.mutations.archive, {
        goalId: args.goalId as never,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
    true,
  );
  return server;
}
