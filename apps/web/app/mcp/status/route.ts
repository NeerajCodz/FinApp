import { mcpResourceUrl } from '@/lib/mcp/oauth';
import { MCP_SERVER_VERSION, toolCatalog } from '@/lib/mcp/server';
import { widgets } from '@/lib/mcp/widgets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public, data-free health summary for the dashboard's live "server status" check. */
export async function GET() {
  let endpoint: string | null;
  try {
    endpoint = mcpResourceUrl();
  } catch {
    endpoint = null;
  }
  const tools = toolCatalog();
  return Response.json(
    {
      status: endpoint ? 'ok' : 'not_configured',
      name: 'finapp',
      version: MCP_SERVER_VERSION,
      transport: 'streamable-http',
      endpoint,
      authorization: endpoint
        ? new URL('/.well-known/oauth-protected-resource/mcp', endpoint).toString()
        : null,
      // Discovery tools (catalog + four domain parents) are registered alongside these.
      toolCount: tools.length + 5,
      widgetCount: Object.keys(widgets).length,
      checkedAt: Date.now(),
    },
    { status: endpoint ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
