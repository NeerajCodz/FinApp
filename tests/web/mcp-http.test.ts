import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getFunctionName } from 'convex/server';

const authorization = vi.hoisted(() => ({ active: true }));
vi.mock('@/lib/mcp/oauth', () => ({
  mcpResourceUrl: () => 'https://finapp.test/mcp',
  verifyMcpAccessToken: async () => ({
    userId: 'user-one',
    grantId: 'grant-one',
    scopes: ['finapp:read'],
  }),
  convexClient: () => ({
    query: async (reference: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(reference);
      if (name === 'mcpOAuth:currentUser') return { id: 'user-one', displayName: 'Test account' };
      if (name === 'mcpOAuth:activeGrant') return authorization.active;
      throw new Error(`Unexpected database read: ${name}`);
    },
    mutation: async () => undefined,
  }),
}));

import { POST } from '../../apps/web/app/mcp/route';

beforeEach(() => {
  authorization.active = true;
});

describe('MCP HTTP endpoint', () => {
  it('initializes and discovers domain tools over the stateless HTTP endpoint', async () => {
    const client = new Client({ name: 'http-regression', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://finapp.test/mcp'), {
      requestInit: { headers: { Authorization: 'Bearer fixture-token' } },
      fetch: async (input, init) => POST(new Request(input, init)),
    });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'finapp.catalog',
          'finapp.finance.parent',
          'finapp.social.parent',
          'finapp.groups.parent',
          'finapp.personal.parent',
        ]),
      );
      const result = await client.callTool({ name: 'finapp.finance.parent', arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        data: {
          domain: 'finance',
          children: expect.arrayContaining(['finapp.finance.transactions.list']),
        },
      });
    } finally {
      await client.close();
    }
  }, 10_000);

  it('challenges a request without a bearer token instead of dispatching it', async () => {
    const response = await POST(new Request('https://finapp.test/mcp', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata="https://finapp.test/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it('rejects a revoked grant before initializing an MCP connection', async () => {
    authorization.active = false;
    const response = await POST(
      new Request('https://finapp.test/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture-token' },
      }),
    );
    expect(response.status).toBe(401);
  });
});
