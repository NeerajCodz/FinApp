import { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { convexClient, mcpResourceUrl, prepareMcpAccessTokenSigner } from '@/lib/mcp/oauth';

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
  const bytes = new Uint8Array(16_384);
  let byteLength = 0;
  try {
    const reader = request.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.byteLength > bytes.byteLength - byteLength) {
            await reader.cancel().catch(() => undefined);
            return Response.json({ error: 'invalid_request' }, { status: 413 });
          }
          bytes.set(value, byteLength);
          byteLength += value.byteLength;
        }
      } finally {
        reader.releaseLock();
      }
    }
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const form = new URLSearchParams(new TextDecoder().decode(bytes.subarray(0, byteLength)));
  const grantType = form.get('grant_type');
  const code = form.get('code');
  const clientId = form.get('client_id');
  const redirectUri = form.get('redirect_uri');
  const codeVerifier = form.get('code_verifier');
  if (grantType !== 'authorization_code' || !code || !clientId || !redirectUri || !codeVerifier) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  let signAccessToken: Awaited<ReturnType<typeof prepareMcpAccessTokenSigner>>;
  try {
    if (form.get('resource') !== mcpResourceUrl()) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }
    signAccessToken = await prepareMcpAccessTokenSigner();
  } catch {
    return Response.json({ error: 'server_error' }, { status: 503 });
  }

  let grant: FunctionReturnType<typeof api.mcpOAuth.exchangeAuthorizationCode>;
  try {
    grant = await convexClient().mutation(api.mcpOAuth.exchangeAuthorizationCode, {
      code,
      clientId,
      redirectUri,
      codeVerifier,
    });
  } catch {
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  }

  try {
    const accessToken = await signAccessToken(
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
    return Response.json({ error: 'server_error' }, { status: 503 });
  }
}
