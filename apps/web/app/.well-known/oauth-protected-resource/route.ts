import { mcpIssuer, mcpResourceUrl } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const issuer = mcpIssuer();
  return Response.json(
    {
      resource: mcpResourceUrl(),
      authorization_servers: [issuer],
      scopes_supported: [
        'finapp:read',
        'finapp:write:finance',
        'finapp:write:social',
        'finapp:write:groups',
        'finapp:write:personal',
      ],
      resource_documentation: new URL('/mcp/dashboard', issuer).toString(),
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
