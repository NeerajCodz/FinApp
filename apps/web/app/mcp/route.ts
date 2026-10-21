import { api } from '@convex/_generated/api';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { convexClient, mcpResourceUrl, verifyMcpAccessToken } from '@/lib/mcp/oauth';
import type { McpPrincipal } from '@/lib/mcp/oauth';
import { createMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function allowedOrigin(origin: string | null, request: Request): boolean {
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const host = request.headers.get('host');
  const resourceOrigin = new URL(mcpResourceUrl()).origin;
  const sameOrigin = parsed.origin === resourceOrigin && (!host || host === parsed.host);
  const configuredOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const clientOrigin =
    ['https://chatgpt.com', 'https://claude.ai', 'https://claude.com'].includes(parsed.origin) ||
    (parsed.protocol === 'http:' && ['localhost:6274', '127.0.0.1:6274'].includes(parsed.host));
  return sameOrigin || clientOrigin || configuredOrigins.includes(parsed.origin);
}
function withCors(response: Response, request: Request): Response {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigin(origin, request)) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Protocol-Version');
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unauthorized() {
  const metadata = new URL(
    '/.well-known/oauth-protected-resource/mcp',
    mcpResourceUrl(),
  ).toString();
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${metadata}", scope="finapp:read"`,
    },
  });
}
function configurationUnavailable() {
  return Response.json(
    { error: 'server_not_configured', detail: 'The MCP server is not configured yet.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

function isConfigured(): boolean {
  try {
    mcpResourceUrl();
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isConfigured()) return configurationUnavailable();
  if (!allowedOrigin(request.headers.get('origin'), request)) {
    return new Response('Forbidden origin.', { status: 403 });
  }
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token || token.length > 8_192) return withCors(unauthorized(), request);

  let principal: McpPrincipal | null;
  try {
    principal = await verifyMcpAccessToken(token);
  } catch {
    return withCors(unauthorized(), request);
  }
  if (!principal || !principal.scopes.includes('finapp:read')) {
    return withCors(unauthorized(), request);
  }

  const client = convexClient(token);
  const profile = await client.query(api.mcpOAuth.currentUser, {}).catch(() => null);
  if (!profile || profile.id !== principal.userId) return withCors(unauthorized(), request);
  const activeGrant = await client
    .query(api.mcpOAuth.activeGrant, {
      grantId: principal.grantId as never,
    })
    .catch(() => false);
  if (!activeGrant) return withCors(unauthorized(), request);

  const server = createMcpServer(client, principal.scopes, principal.grantId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 1_048_576,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response, request);
  } catch {
    return withCors(new Response('MCP request could not be handled.', { status: 400 }), request);
  } finally {
    await transport.close();
    await server.close();
  }
}

export async function GET(request: Request) {
  if (!isConfigured()) return configurationUnavailable();
  if (!allowedOrigin(request.headers.get('origin'), request)) {
    return new Response('Forbidden origin.', { status: 403 });
  }
  return withCors(
    new Response(null, { status: 405, headers: { Allow: 'POST, OPTIONS' } }),
    request,
  );
}

export async function DELETE(request: Request) {
  if (!isConfigured()) return configurationUnavailable();
  if (!allowedOrigin(request.headers.get('origin'), request)) {
    return new Response('Forbidden origin.', { status: 403 });
  }
  return withCors(
    new Response(null, { status: 405, headers: { Allow: 'POST, OPTIONS' } }),
    request,
  );
}

export async function OPTIONS(request: Request) {
  if (!isConfigured()) return configurationUnavailable();
  const origin = request.headers.get('origin');
  if (!allowedOrigin(origin, request) || !origin) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Accept',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    },
  });
}
