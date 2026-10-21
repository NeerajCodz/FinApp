import { api } from '@convex/_generated/api';
import { convexClient, mcpResourceUrl, signMcpAccessToken } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (
    request.headers.get('content-type')?.split(';', 1)[0]?.trim() !==
    'application/x-www-form-urlencoded'
  ) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return Response.json({ error: 'invalid_request' }, { status: 413 });
  }
  const body = await request.text();
  if (body.length > 16_384) return Response.json({ error: 'invalid_request' }, { status: 413 });
  const form = new URLSearchParams(body);
  const grantType = form.get('grant_type');
  const code = form.get('code');
  const clientId = form.get('client_id');
  const redirectUri = form.get('redirect_uri');
  const codeVerifier = form.get('code_verifier');
  if (
    grantType !== 'authorization_code' ||
    !code ||
    !clientId ||
    !redirectUri ||
    !codeVerifier ||
    form.get('resource') !== mcpResourceUrl()
  ) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const grant = await convexClient().mutation(api.mcpOAuth.exchangeAuthorizationCode, {
      code,
      clientId,
      redirectUri,
      codeVerifier,
    });
    const accessToken = await signMcpAccessToken(
      String(grant.userId),
      String(grant.grantId),
      grant.scopes,
    );
    return Response.json(
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: grant.scopes.join(' '),
      },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
  } catch {
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  }
}
