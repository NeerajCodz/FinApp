import { mcpJwks } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await mcpJwks(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
