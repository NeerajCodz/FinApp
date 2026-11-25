import { authorizationServerMetadata } from '@/lib/mcp/metadata';

export const dynamic = 'force-dynamic';

/** Some MCP clients only probe the OpenID path; serve the same OAuth metadata there. */
export async function GET() {
  return Response.json(authorizationServerMetadata(), {
    headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  });
}
