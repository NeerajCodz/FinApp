import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';

type Call = { kind: 'query' | 'mutation'; name: string; args: Record<string, unknown> };

const backend = vi.hoisted(() => ({
  scopes: ['finapp:read'] as string[],
  access: { enabled: true, readOnly: false, allowDestructive: true, blockedTools: [] as string[] },
  calls: [] as Call[],
  queries: {} as Record<string, (args: Record<string, unknown>) => unknown>,
  mutations: {} as Record<string, (args: Record<string, unknown>) => unknown>,
}));

vi.mock('@finapp/mcp/oauth', () => ({
  mcpResourceUrl: () => 'https://finapp.test/mcp',
  mcpIssuer: () => 'https://finapp.test',
  mcpConvexUrl: () => 'https://convex.invalid',
  prepareMcpAccessTokenSigner: async () => {
    throw new Error('MCP_SIGNING_PRIVATE_KEY and MCP_SIGNING_KEY_ID are required');
  },
  verifyMcpAccessToken: async () => ({
    userId: 'user-one',
    grantId: 'grant-one',
    scopes: backend.scopes,
  }),
  mcpBackendClient: async () => ({
    query: async (
      reference: Parameters<typeof getFunctionName>[0],
      args: Record<string, unknown>,
    ) => {
      const name = getFunctionName(reference);
      if (name === 'mcpOAuth:currentUser') return { id: 'user-one', displayName: 'Test account' };
      if (name === 'mcpOAuth:accessPolicy')
        return { scopes: backend.scopes, settings: backend.access };
      backend.calls.push({ kind: 'query', name, args });
      const handler = backend.queries[name];
      if (!handler) throw new Error(`Unexpected database read: ${name}`);
      return handler(args);
    },
    mutation: async (
      reference: Parameters<typeof getFunctionName>[0],
      args: Record<string, unknown>,
    ) => {
      const name = getFunctionName(reference);
      if (name === 'mcpOAuth:recordToolInvocation') return null;
      backend.calls.push({ kind: 'mutation', name, args });
      const handler = backend.mutations[name];
      if (!handler) throw new Error(`Unexpected write: ${name}`);
      return handler(args);
    },
  }),
}));

import { GET, POST } from '../../apps/web/app/mcp/route';
import { GET as statusGet } from '../../apps/web/app/mcp/status/route';
import { formatMinor, presentMoney } from '@finapp/mcp/money';
import { toolCatalog } from '@finapp/mcp/server';
import { listWidgets } from '@finapp/widgets';

async function connect() {
  const client = new Client({ name: 'plugin-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://finapp.test/mcp'), {
    requestInit: { headers: { Authorization: 'Bearer fixture-token' } },
    fetch: async (input, init) => POST(new Request(input, init)),
  });
  await client.connect(transport);
  return client;
}

function data(result: Awaited<ReturnType<Client['callTool']>>) {
  return (result.structuredContent as { data: Record<string, unknown> }).data;
}
function text(result: Awaited<ReturnType<Client['callTool']>>) {
  return (result.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
}

const expenseArgs = {
  expenseId: 'expense-1',
  accountId: 'account-1',
  title: 'Dinner',
  amountMinor: '3000',
  currency: 'inr',
  occurredAt: 1_767_225_600_000,
  participants: [
    { userId: 'user-one', amountMinor: '1500', method: 'equal' },
    { userId: 'user-two', amountMinor: '1500', method: 'equal' },
  ],
  expectedVersion: 1,
};

beforeEach(() => {
  backend.scopes = ['finapp:read'];
  backend.access = { enabled: true, readOnly: false, allowDestructive: true, blockedTools: [] };
  backend.calls = [];
  backend.queries = {};
  backend.mutations = {};
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('money presentation', () => {
  it('formats minor units exactly and per-currency', () => {
    expect(formatMinor(12_345n, 'INR')).toBe('₹123.45');
    expect(formatMinor('-500', 'USD')).toBe('-$5.00');
    expect(formatMinor(1500n, 'JPY')).toBe('¥1,500');
    expect(formatMinor(9_007_199_254_740_993n, 'USD')).toBe('$90,071,992,547,409.93');
  });

  it('adds *Formatted siblings using the nearest currency and stringifies bigints', () => {
    expect(
      presentMoney({ currency: 'INR', amountMinor: 1000n, payers: [{ amountMinor: 250n }] }),
    ).toEqual({
      currency: 'INR',
      amountMinor: '1000',
      amountFormatted: '₹10.00',
      payers: [{ amountMinor: '250', amountFormatted: '₹2.50' }],
    });
  });
});

describe('MCP plugin tools', () => {
  it('lists the full tool set with schemas, annotations and an accurate catalog', async () => {
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'finapp.finance.overview',
          'finapp.finance.transactions.get',
          'finapp.groups.balances',
          'finapp.groups.settle_up.prepare',
          'finapp.groups.expenses.update',
          'finapp.groups.expenses.delete',
          'finapp.groups.expenses.history',
          'finapp.groups.expenses.add_members',
          'finapp.groups.settlements.delete',
          'finapp.groups.leave',
          'finapp.groups.members.remove',
          'finapp.groups.nudge',
          'finapp.personal.notifications.mark_all_read',
          'finapp.groups.messages.pin',
          'finapp.social.direct_messages.pinned',
        ]),
      );
      expect(new Set(names).size).toBe(names.length);
      for (const tool of tools) {
        expect(tool.description?.length ?? 0).toBeGreaterThan(10);
        expect(tool.inputSchema.type).toBe('object');
        expect(typeof tool.annotations?.readOnlyHint).toBe('boolean');
      }
      const catalog = await client.callTool({ name: 'finapp.catalog', arguments: {} });
      const listed = (data(catalog).domains as Array<{ children: string[] }>).flatMap(
        (domain) => domain.children,
      );
      const parents = names.filter((name) => name.endsWith('.parent'));
      expect(listed.sort()).toEqual(
        names.filter((name) => name !== 'finapp.catalog' && !parents.includes(name)).sort(),
      );
      expect(toolCatalog()).toHaveLength(listed.length);
    } finally {
      await client.close();
    }
  });

  it('marks destructive tools and requires explicit confirmation', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:groups'];
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      const leave = tools.find((tool) => tool.name === 'finapp.groups.leave');
      expect(leave?.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
      const result = await client.callTool({
        name: 'finapp.groups.leave',
        arguments: { groupId: 'group-1' },
      });
      expect(result.isError).toBe(true);
      expect(backend.calls).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('hides tools the user turned off in access-control settings', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:groups'];
    backend.access = {
      enabled: true,
      readOnly: false,
      allowDestructive: false,
      blockedTools: ['finapp.groups.balances'],
    };
    let client = await connect();
    try {
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).not.toContain('finapp.groups.leave');
      expect(names).not.toContain('finapp.groups.balances');
      expect(names).toContain('finapp.groups.list');
    } finally {
      await client.close();
    }

    backend.access = { enabled: true, readOnly: true, allowDestructive: true, blockedTools: [] };
    client = await connect();
    try {
      const { tools } = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every((tool) => tool.annotations?.readOnlyHint !== false)).toBe(true);
    } finally {
      await client.close();
    }

    backend.access = { enabled: false, readOnly: false, allowDestructive: true, blockedTools: [] };
    client = await connect();
    try {
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names.filter((name) => name !== 'finapp.catalog')).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('links widget tools to MCP Apps resources and serves self-contained HTML', async () => {
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      const balances = tools.find((tool) => tool.name === 'finapp.groups.balances');
      expect(balances?._meta).toMatchObject({
        ui: { resourceUri: 'ui://finapp/group-balances.v1.html' },
        'openai/outputTemplate': 'ui://finapp/group-balances.v1.html',
      });
      const { resources } = await client.listResources();
      const widgets = resources.filter((resource) => resource.uri.startsWith('ui://finapp/'));
      expect(widgets).toHaveLength(listWidgets().length);
      expect(widgets.length).toBeGreaterThanOrEqual(150);
      // The original widget URIs keep working.
      for (const uri of [
        'ui://finapp/overview.v1.html',
        'ui://finapp/transactions.v1.html',
        'ui://finapp/group-balances.v1.html',
        'ui://finapp/expense.v1.html',
        'ui://finapp/settle-up.v1.html',
      ])
        expect(widgets.map((widget) => widget.uri)).toContain(uri);
      for (const widget of widgets) expect(widget.mimeType).toBe('text/html;profile=mcp-app');
      const read = await client.readResource({ uri: 'ui://finapp/settle-up.v1.html' });
      const content = read.contents[0] as { text: string; mimeType: string; _meta: unknown };
      expect(content.mimeType).toBe('text/html;profile=mcp-app');
      expect(content._meta).toMatchObject({
        ui: { csp: { connectDomains: [], resourceDomains: [] } },
      });
      expect(content.text).toContain('data-widget="settleUp"');
      expect(content.text).toContain('ui/initialize');
      expect(content.text).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//i);
      expect(content.text).not.toMatch(/MCP_SIGNING|PRIVATE KEY|Bearer /);
    } finally {
      await client.close();
    }
  });

  it('returns balances with formatted money, suggested transfers and a text summary', async () => {
    backend.queries = {
      'groups/queries:balances': () => ({
        currency: 'INR',
        status: 'ready',
        members: [
          { userId: 'user-one', displayName: 'Me', current: true, amountMinor: 2500n },
          { userId: 'user-two', displayName: 'Sam', current: true, amountMinor: -2500n },
        ],
        transfers: [{ fromUserId: 'user-two', toUserId: 'user-one', amountMinor: 2500n }],
      }),
      'users/queries:current': () => ({ _id: 'user-one' }),
      'mcp:groupSummary': () => ({
        id: 'group-1',
        name: 'Trip',
        currency: 'INR',
        memberRole: 'member',
      }),
    };
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'finapp.groups.balances',
        arguments: { groupId: 'group-1' },
      });
      expect(result.isError).not.toBe(true);
      expect(data(result)).toMatchObject({
        myBalanceMinor: '2500',
        myBalanceFormatted: '₹25.00',
        transfers: [
          { fromName: 'Sam', toName: 'Me', amountFormatted: '₹25.00', direction: 'you_receive' },
        ],
      });
      expect(text(result)).toMatch(/^You are owed ₹25\.00 in Trip\./);
    } finally {
      await client.close();
    }
  });

  it('enforces write scopes before touching the backend', async () => {
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'finapp.groups.expenses.delete',
        arguments: { expenseId: 'expense-1', confirm: true },
      });
      expect(result.isError).toBe(true);
      expect(text(result)).toContain('MISSING_SCOPE');
      expect(text(result)).toContain('finapp:write:groups');
      expect(backend.calls).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('forwards payers, expectedVersion and line items when editing a group expense', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:groups'];
    backend.mutations = { 'groups/mutations:updateExpense': () => 'expense-1' };
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'finapp.groups.expenses.update',
        arguments: {
          ...expenseArgs,
          payers: [{ userId: 'user-two', amountMinor: '3000' }],
          expectedVersion: 4,
          items: [
            { title: 'Pizza', amountMinor: '2000', participantIds: ['user-one'] },
            { id: 'keep', title: 'Soda', amountMinor: '1000', quantity: 2 },
          ],
        },
      });
      expect(result.isError).not.toBe(true);
      const [call] = backend.calls;
      expect(call).toMatchObject({
        name: 'groups/mutations:updateExpense',
        args: {
          transactionId: 'expense-1',
          currency: 'INR',
          amountMinor: 3000n,
          payers: [{ userId: 'user-two', amountMinor: 3000n }],
          expectedVersion: 4,
        },
      });
      const items = call!.args.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        title: 'Pizza',
        amountMinor: 2000n,
        participantIds: ['user-one'],
      });
      expect(typeof items[0]!.id).toBe('string');
      expect(items[1]).toMatchObject({ id: 'keep', quantity: 2 });
      expect(typeof call!.args.clientMutationId).toBe('string');
    } finally {
      await client.close();
    }
  });

  it('requires expectedVersion so a concurrent edit is never overwritten', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:groups'];
    backend.mutations = { 'groups/mutations:updateExpense': () => 'expense-1' };
    const client = await connect();
    try {
      const { expectedVersion: _omitted, ...withoutVersion } = expenseArgs;
      void _omitted;
      const result = await client.callTool({
        name: 'finapp.groups.expenses.update',
        arguments: withoutVersion,
      });
      expect(result.isError).toBe(true);
      expect(backend.calls).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('omits items when not provided and rejects mismatched item totals locally', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:groups'];
    backend.mutations = { 'groups/mutations:updateExpense': () => 'expense-1' };
    const client = await connect();
    try {
      await client.callTool({ name: 'finapp.groups.expenses.update', arguments: expenseArgs });
      expect(backend.calls[0]!.args.items).toBeUndefined();
      backend.calls = [];
      const mismatch = await client.callTool({
        name: 'finapp.groups.expenses.update',
        arguments: { ...expenseArgs, items: [{ title: 'Only', amountMinor: '100' }] },
      });
      expect(mismatch.isError).toBe(true);
      expect(text(mismatch)).toContain('ITEMS_TOTAL_MISMATCH');
      expect(backend.calls).toEqual([]);
      await client.callTool({
        name: 'finapp.groups.expenses.update',
        arguments: {
          ...expenseArgs,
          items: [],
          participants: expenseArgs.participants.map((row) => ({ ...row, method: 'itemized' })),
        },
      });
      expect(backend.calls[0]!.args).toMatchObject({
        items: [],
        participants: [{ method: 'itemized' }, { method: 'itemized' }],
      });
    } finally {
      await client.close();
    }
  });

  it('validates input schemas (minor units must be integer strings)', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:finance'];
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'finapp.finance.transactions.create',
        arguments: {
          accountId: 'account-1',
          type: 'expense',
          amountMinor: '12.50',
          currency: 'INR',
          title: 'Lunch',
          occurredAt: 1,
        },
      });
      expect(result.isError).toBe(true);
      expect(backend.calls).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('maps ConvexError data such as OUTSTANDING_BALANCE to an actionable error', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:groups'];
    backend.mutations = {
      'groups/mutations:leaveGroup': () => {
        throw new ConvexError({
          code: 'OUTSTANDING_BALANCE',
          balanceMinor: '-4200',
          currency: 'INR',
        });
      },
    };
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'finapp.groups.leave',
        arguments: { groupId: 'group-1', confirm: true },
      });
      expect(result.isError).toBe(true);
      expect(text(result)).toContain('OUTSTANDING_BALANCE');
      expect(text(result)).toContain('-₹42.00');
      expect(result.structuredContent).toMatchObject({
        error: { code: 'OUTSTANDING_BALANCE', data: { balanceFormatted: '-₹42.00' } },
      });
    } finally {
      await client.close();
    }
  });

  it('maps plain backend error codes like TRANSACTION_CHANGED', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:groups'];
    backend.mutations = {
      'groups/mutations:deleteExpense': () => {
        throw new Error(
          '[CONVEX M(groups/mutations:deleteExpense)] Uncaught Error: TRANSACTION_CHANGED',
        );
      },
    };
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'finapp.groups.expenses.delete',
        arguments: { expenseId: 'expense-1', expectedVersion: 1, confirm: true },
      });
      expect(text(result)).toMatch(/^TRANSACTION_CHANGED: .*expenses\.get/);
    } finally {
      await client.close();
    }
  });

  it('passes amount filters through to transaction search with defaults for the window', async () => {
    backend.queries = {
      'mcp:listTransactions': () => ({
        items: [
          {
            id: 'tx-1',
            title: 'Groceries',
            amountMinor: 3000n,
            currency: 'INR',
            items: [{ id: 'a', title: 'Milk', amountMinor: 3000n }],
          },
        ],
        nextCursor: null,
        isDone: true,
      }),
    };
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'finapp.finance.transactions.list',
        arguments: { minAmountMinor: '100', search: 'milk' },
      });
      const args = backend.calls[0]!.args;
      expect(args).toMatchObject({ minAmountMinor: 100n, search: 'milk' });
      expect((args.endAt as number) - (args.startAt as number)).toBe(30 * 86_400_000);
      expect(data(result)).toMatchObject({
        items: [{ items: [{ title: 'Milk', amountFormatted: '₹30.00' }] }],
      });
    } finally {
      await client.close();
    }
  });
});

describe('MCP coverage tools', () => {
  const newTools = [
    'finapp.finance.accounts.set_appearance',
    'finapp.finance.trash.empty',
    'finapp.finance.trash.set_retention',
    'finapp.groups.transfer_ownership',
    'finapp.groups.messages.mark_read',
    'finapp.social.friends.remove',
    'finapp.social.inbox',
    'finapp.social.people.analytics',
    'finapp.social.direct_messages.mark_read',
    'finapp.personal.notifications.summary',
    'finapp.personal.sessions.list',
    'finapp.personal.finai_settings.get',
    'finapp.personal.avatars.list',
  ];

  it('registers every new tool with the right scope and destructive flag', () => {
    const catalog = new Map(toolCatalog().map((entry) => [entry.name, entry]));
    for (const name of newTools) expect(catalog.has(name), name).toBe(true);
    expect(catalog.get('finapp.social.friends.remove')).toMatchObject({
      scope: 'finapp:write:social',
      destructive: true,
    });
    expect(catalog.get('finapp.social.direct_messages.mark_read')).toMatchObject({
      scope: 'finapp:write:social',
      destructive: false,
    });
    expect(catalog.get('finapp.groups.transfer_ownership')).toMatchObject({
      scope: 'finapp:write:groups',
      destructive: true,
    });
    expect(catalog.get('finapp.groups.messages.mark_read')?.scope).toBe('finapp:write:groups');
    expect(catalog.get('finapp.finance.trash.empty')).toMatchObject({
      scope: 'finapp:write:finance',
      destructive: true,
    });
    expect(catalog.get('finapp.finance.trash.set_retention')?.destructive).toBe(false);
    for (const name of [
      'finapp.social.inbox',
      'finapp.social.people.analytics',
      'finapp.personal.notifications.summary',
      'finapp.personal.sessions.list',
      'finapp.personal.finai_settings.get',
      'finapp.personal.avatars.list',
    ])
      expect(catalog.get(name)?.readOnly, name).toBe(true);
  });

  it('removes a friend only with confirmation and the social write scope', async () => {
    backend.mutations = { 'social/mutations:removeFriend': () => null };
    let client = await connect();
    try {
      const missing = await client.callTool({
        name: 'finapp.social.friends.remove',
        arguments: { userId: 'user-two', confirm: true },
      });
      expect(text(missing)).toContain('finapp:write:social');
      expect(backend.calls).toEqual([]);
    } finally {
      await client.close();
    }

    backend.scopes = ['finapp:read', 'finapp:write:social'];
    client = await connect();
    try {
      const unconfirmed = await client.callTool({
        name: 'finapp.social.friends.remove',
        arguments: { userId: 'user-two' },
      });
      expect(unconfirmed.isError).toBe(true);
      expect(backend.calls).toEqual([]);
      const result = await client.callTool({
        name: 'finapp.social.friends.remove',
        arguments: { userId: 'user-two', confirm: true },
      });
      expect(result.isError).not.toBe(true);
      expect(backend.calls).toEqual([
        { kind: 'mutation', name: 'social/mutations:removeFriend', args: { userId: 'user-two' } },
      ]);
    } finally {
      await client.close();
    }
  });

  it('hides the new destructive tools when deletes are off and writes in read-only mode', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:social', 'finapp:write:groups'];
    backend.access = { enabled: true, readOnly: false, allowDestructive: false, blockedTools: [] };
    let client = await connect();
    try {
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).not.toContain('finapp.social.friends.remove');
      expect(names).not.toContain('finapp.groups.transfer_ownership');
      expect(names).not.toContain('finapp.finance.trash.empty');
      expect(names).toContain('finapp.social.direct_messages.mark_read');
    } finally {
      await client.close();
    }
    backend.access = { enabled: true, readOnly: true, allowDestructive: true, blockedTools: [] };
    client = await connect();
    try {
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).not.toContain('finapp.social.direct_messages.mark_read');
      expect(names).toContain('finapp.social.inbox');
    } finally {
      await client.close();
    }
  });

  it('marks direct and group chats read through presence.markRead', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:social', 'finapp:write:groups'];
    backend.mutations = { 'presence/mutations:markRead': () => ({ lastReadAt: 1234 }) };
    const client = await connect();
    try {
      await client.callTool({
        name: 'finapp.social.direct_messages.mark_read',
        arguments: { conversationId: 'conversation-1', readAt: 1234 },
      });
      await client.callTool({
        name: 'finapp.groups.messages.mark_read',
        arguments: { groupId: 'group-1' },
      });
      expect(backend.calls[0]).toEqual({
        kind: 'mutation',
        name: 'presence/mutations:markRead',
        args: { scopeType: 'direct', scopeId: 'conversation-1', readAt: 1234 },
      });
      expect(backend.calls[1]).toMatchObject({
        name: 'presence/mutations:markRead',
        args: { scopeType: 'group', scopeId: 'group-1' },
      });
      expect(typeof backend.calls[1]!.args.readAt).toBe('number');
    } finally {
      await client.close();
    }
  });

  it('transfers group ownership with confirmation and an idempotency key', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:groups'];
    backend.mutations = { 'groups/mutations:transferOwnership': () => 'group-1' };
    const client = await connect();
    try {
      const unconfirmed = await client.callTool({
        name: 'finapp.groups.transfer_ownership',
        arguments: { groupId: 'group-1', newOwnerId: 'user-two' },
      });
      expect(unconfirmed.isError).toBe(true);
      expect(backend.calls).toEqual([]);
      const key = '7d9f2b8e-4c1a-4f3e-9b2d-1a2b3c4d5e6f';
      const result = await client.callTool({
        name: 'finapp.groups.transfer_ownership',
        arguments: {
          groupId: 'group-1',
          newOwnerId: 'user-two',
          confirm: true,
          clientMutationId: key,
        },
      });
      expect(data(result)).toEqual({ groupId: 'group-1' });
      expect(backend.calls[0]).toEqual({
        kind: 'mutation',
        name: 'groups/mutations:transferOwnership',
        args: { groupId: 'group-1', newOwnerId: 'user-two', clientMutationId: key },
      });
    } finally {
      await client.close();
    }
  });

  it('empties Trash only when confirmed and validates the retention options', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:finance'];
    backend.mutations = {
      'trash:empty': () => ({ purged: 3, more: true }),
      'trash:setRetention': (args) => args.days,
    };
    const client = await connect();
    try {
      const unconfirmed = await client.callTool({
        name: 'finapp.finance.trash.empty',
        arguments: {},
      });
      expect(unconfirmed.isError).toBe(true);
      expect(backend.calls).toEqual([]);
      const emptied = await client.callTool({
        name: 'finapp.finance.trash.empty',
        arguments: { confirm: true },
      });
      expect(text(emptied)).toMatch(/^Deleted 3 item\(s\) for good; more remain in Trash\./);
      expect(backend.calls).toEqual([{ kind: 'mutation', name: 'trash:empty', args: {} }]);

      const invalid = await client.callTool({
        name: 'finapp.finance.trash.set_retention',
        arguments: { days: 5 },
      });
      expect(invalid.isError).toBe(true);
      expect(backend.calls).toHaveLength(1);
      const retention = await client.callTool({
        name: 'finapp.finance.trash.set_retention',
        arguments: { days: 0 },
      });
      expect(data(retention)).toEqual({ retentionDays: 0 });
    } finally {
      await client.close();
    }
  });

  it('sets account icon and colour with separate idempotency keys and rejects empty updates', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:finance'];
    backend.mutations = {
      'accounts/mutations:setIcon': () => 'account-1',
      'accounts/mutations:setColor': () => 'account-1',
    };
    const client = await connect();
    try {
      const empty = await client.callTool({
        name: 'finapp.finance.accounts.set_appearance',
        arguments: { accountId: 'account-1' },
      });
      expect(text(empty)).toContain('NOTHING_TO_UPDATE');
      expect(backend.calls).toEqual([]);
      await client.callTool({
        name: 'finapp.finance.accounts.set_appearance',
        arguments: { accountId: 'account-1', icon: 'wallet', color: null },
      });
      expect(backend.calls.map((call) => call.name)).toEqual([
        'accounts/mutations:setIcon',
        'accounts/mutations:setColor',
      ]);
      expect(backend.calls[0]!.args).toMatchObject({ accountId: 'account-1', icon: 'wallet' });
      expect(backend.calls[1]!.args).toMatchObject({ accountId: 'account-1', color: null });
      expect(backend.calls[0]!.args.clientMutationId).not.toBe(
        backend.calls[1]!.args.clientMutationId,
      );
    } finally {
      await client.close();
    }
  });

  it('reads the inbox, person analytics and notification status', async () => {
    backend.queries = {
      'social/queries:peopleHub': () => [
        { id: 'user-two', displayName: 'Sam', conversationId: 'c-1', unreadCount: 2 },
        { id: 'user-three', displayName: 'Ana', conversationId: null, unreadCount: 0 },
      ],
      'social/queries:personAnalytics': () => ({ messagesPerDay: [] }),
      'mcp:notificationState': () => ({
        unreadCount: 4,
        unreadCapped: false,
        preferences: { goal: true },
      }),
    };
    const client = await connect();
    try {
      const inbox = await client.callTool({ name: 'finapp.social.inbox', arguments: {} });
      expect(text(inbox)).toMatch(/^2 people; 1 with unread messages\./);
      await client.callTool({
        name: 'finapp.social.people.analytics',
        arguments: { userId: 'user-two', tzOffsetMinutes: 330 },
      });
      expect(backend.calls[1]).toEqual({
        kind: 'query',
        name: 'social/queries:personAnalytics',
        args: { userId: 'user-two', tzOffsetMinutes: 330 },
      });
      const status = await client.callTool({
        name: 'finapp.personal.notifications.summary',
        arguments: {},
      });
      expect(text(status)).toMatch(/^4 unread notification\(s\)\./);
      expect(data(status)).toMatchObject({ unreadCount: 4, preferences: { goal: true } });
    } finally {
      await client.close();
    }
  });

  it('reads and partially updates privacy settings through convex/security', async () => {
    backend.scopes = ['finapp:read', 'finapp:write:personal'];
    backend.queries = {
      'security:privacy': () => ({ showActive: true, discoverable: true }),
      'security:sessions': () => [{ id: 's-1', label: 'Chrome', platform: 'web' }],
      'users/queries:securityPreferences': () => ({ twoFactorEnabled: true }),
      'mfa:status': () => ({ totp: false, recoveryRemaining: 0 }),
    };
    backend.mutations = { 'security:updatePrivacy': () => ({ discoverable: false }) };
    const client = await connect();
    try {
      await client.callTool({ name: 'finapp.personal.privacy.get', arguments: {} });
      await client.callTool({
        name: 'finapp.personal.privacy.update',
        arguments: { discoverable: false, friendRequests: 'nobody' },
      });
      expect(backend.calls[1]).toEqual({
        kind: 'mutation',
        name: 'security:updatePrivacy',
        args: { discoverable: false, friendRequests: 'nobody' },
      });
      const invalid = await client.callTool({
        name: 'finapp.personal.privacy.update',
        arguments: { friendRequests: 'friends' },
      });
      expect(invalid.isError).toBe(true);
      const sessions = await client.callTool({
        name: 'finapp.personal.sessions.list',
        arguments: {},
      });
      expect(data(sessions)).toEqual({ items: [{ id: 's-1', label: 'Chrome', platform: 'web' }] });
      const security = await client.callTool({
        name: 'finapp.personal.security.get',
        arguments: {},
      });
      expect(data(security)).toEqual({
        twoFactorEnabled: true,
        authenticator: { totp: false, recoveryRemaining: 0 },
      });
    } finally {
      await client.close();
    }
  });

  it('pages direct messages with the cursor and a bounded default window', async () => {
    backend.queries = {
      'mcp:listDirectMessages': () => ({ items: [], nextCursor: 'next', isDone: false }),
    };
    const client = await connect();
    try {
      const result = await client.callTool({
        name: 'finapp.social.direct_messages.list',
        arguments: { conversationId: 'conversation-1', limit: 10, cursor: 'abc' },
      });
      expect(data(result)).toMatchObject({ nextCursor: 'next', isDone: false });
      const args = backend.calls[0]!.args;
      expect(args).toMatchObject({
        conversationId: 'conversation-1',
        paginationOpts: { numItems: 10, cursor: 'abc' },
      });
      expect((args.endAt as number) - (args.startAt as number)).toBe(30 * 86_400_000);
      const tooMany = await client.callTool({
        name: 'finapp.social.direct_messages.list',
        arguments: { conversationId: 'conversation-1', limit: 500 },
      });
      expect(tooMany.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});

describe('MCP endpoint browser UX', () => {
  it('redirects a browser opening /mcp to the dashboard', async () => {
    const response = await GET(
      new Request('https://finapp.test/mcp', {
        headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/mcp/dashboard');
  });

  it('keeps 405 for non-HTML GET requests (MCP clients)', async () => {
    const response = await GET(
      new Request('https://finapp.test/mcp', { headers: { Accept: 'text/event-stream' } }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST, OPTIONS');
  });

  it('reports a data-free server status', async () => {
    vi.stubEnv('MCP_ISSUER_URL', 'https://finapp.test');
    const response = await statusGet();
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({
      name: 'finapp',
      widgetCount: listWidgets().length,
      transport: 'streamable-http',
    });
    expect(body.toolCount).toBe(toolCatalog().length + 5);
    // No signing key in the test env: never advertised as online.
    expect(response.status).toBe(503);
    expect(body.status).not.toBe('ok');
    expect(body.checks).toMatchObject({ endpoint: 'ok', issuer: 'ok', signing: 'missing' });
  });
});
