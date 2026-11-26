import { protectedResourceMetadata } from '@finapp/mcp/metadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(protectedResourceMetadata(), {
    headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  });
}
