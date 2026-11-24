import {
  mcpConvexUrl,
  mcpIssuer,
  mcpResourceUrl,
  prepareMcpAccessTokenSigner,
  verifyMcpAccessToken,
} from '@/lib/mcp/oauth';
import { MCP_SERVER_VERSION, toolCatalog } from '@/lib/mcp/server';
import { widgets } from '@/lib/mcp/widgets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Check = 'ok' | 'missing' | 'unreachable';

async function check(run: () => unknown): Promise<Check> {
  try {
    await run();
    return 'ok';
  } catch {
    return 'missing';
  }
}

/** A cheap unauthenticated request to the Convex deployment. */
async function backendReachable(): Promise<Check> {
  try {
    const response = await fetch(new URL('/version', mcpConvexUrl()), {
      signal: AbortSignal.timeout(3_000),
      cache: 'no-store',
    });
    return response.ok ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

/**
 * Public, data-free health summary for the dashboard's live "server status" check. "ok" only
 * when the endpoint, issuer, token signing and backend are all usable.
 */
export async function GET() {
  let endpoint: string | null;
  try {
    endpoint = mcpResourceUrl();
  } catch {
    endpoint = null;
  }
  const [issuer, signing, backend] = await Promise.all([
    check(mcpIssuer),
    // Sign and verify a probe token: proves the private key, key id and public key match.
    check(async () => {
      const sign = await prepareMcpAccessTokenSigner();
      const principal = await verifyMcpAccessToken(await sign('status-probe', 'status-probe', []));
      if (!principal) throw new Error('MCP_SIGNING_MISMATCH');
    }),
    backendReachable(),
  ]);
  const checks = { endpoint: endpoint ? 'ok' : 'missing', issuer, signing, backend } as const;
  const healthy = Object.values(checks).every((value) => value === 'ok');
  const configured = endpoint && issuer === 'ok' && signing === 'ok';
  const tools = toolCatalog();
  return Response.json(
    {
      status: healthy ? 'ok' : configured ? 'degraded' : 'not_configured',
      checks,
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
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
