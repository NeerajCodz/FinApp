import { api, internal } from '@convex/_generated/api';
import { decodeJwt } from 'jose';
import { readClientCredentials } from '@convex/shared/mcpClients';
import { convexAdminClient, mcpResourceUrl, prepareMcpAccessTokenSigner } from '@finapp/mcp/oauth';

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
  const authorization = request.headers.get('authorization');
  const credentials = readClientCredentials(authorization, form);
  if (authorization && !/^Basic /i.test(authorization))
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  if ('error' in credentials)
    return Response.json(
      { error: credentials.error },
      { status: credentials.error === 'invalid_client' ? 401 : 400 },
    );
  const invalidClient = () =>
    Response.json(
      { error: 'invalid_client' },
      {
        status: 401,
        headers: credentials.via === 'basic' ? { 'WWW-Authenticate': 'Basic realm="finapp"' } : {},
      },
    );
  // With a JWT assertion the client id may only appear in the assertion's `sub`.
  let clientId = credentials.clientId;
  if (!clientId && credentials.clientAssertion) {
    try {
      const sub = decodeJwt(credentials.clientAssertion).sub;
      clientId = typeof sub === 'string' ? sub : null;
    } catch {
      return invalidClient();
    }
  }
  if (!clientId) return Response.json({ error: 'invalid_request' }, { status: 400 });
  if (grantType !== 'authorization_code' && grantType !== 'refresh_token')
    return Response.json({ error: 'unsupported_grant_type' }, { status: 400 });
  const rawScope = grantType === 'refresh_token' ? form.get('scope') : null;
  const requestedScopes =
    rawScope === null ? undefined : [...new Set(rawScope.split(/\s+/).filter(Boolean))];
  if (
    requestedScopes &&
    (requestedScopes.length === 0 ||
      requestedScopes.length > 5 ||
      !requestedScopes.includes('finapp:read'))
  ) {
    return Response.json({ error: 'invalid_scope' }, { status: 400 });
  }
  const resource = form.get('resource');
  let signAccessToken: Awaited<ReturnType<typeof prepareMcpAccessTokenSigner>>;
  try {
    if (resource && resource !== mcpResourceUrl()) {
      return Response.json({ error: 'invalid_target' }, { status: 400 });
    }
    signAccessToken = await prepareMcpAccessTokenSigner();
  } catch {
    return Response.json({ error: 'server_error' }, { status: 503 });
  }

  type Grant = { userId: string; grantId: string; scopes: string[]; refreshToken: string };
  let grant: Grant;
  try {
    const client = convexAdminClient();
    if (grantType === 'authorization_code') {
      const code = form.get('code');
      const redirectUri = form.get('redirect_uri');
      const codeVerifier = form.get('code_verifier');
      if (!code || !redirectUri || !codeVerifier)
        return Response.json({ error: 'invalid_request' }, { status: 400 });
      const args = { code, clientId, redirectUri, codeVerifier };
      grant = credentials.clientAssertion
        ? await client.action(api.mcpOAuthActions.exchangeWithClientAssertion, {
            ...args,
            clientAssertion: credentials.clientAssertion,
          })
        : await client.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
            ...args,
            ...(credentials.clientSecret ? { clientSecret: credentials.clientSecret } : {}),
            authTransport:
              credentials.via === 'basic' ? 'basic' : credentials.via === 'post' ? 'post' : 'none',
          });
    } else {
      const refreshToken = form.get('refresh_token');
      if (!refreshToken) return Response.json({ error: 'invalid_request' }, { status: 400 });
      grant = credentials.clientAssertion
        ? await client.action(api.mcpOAuthActions.refreshWithClientAssertion, {
            refreshToken,
            clientId,
            clientAssertion: credentials.clientAssertion,
            ...(requestedScopes ? { requestedScopes } : {}),
          })
        : await client.mutation(internal.mcpOAuth.refreshAccessGrant, {
            refreshToken,
            clientId,
            ...(credentials.clientSecret ? { clientSecret: credentials.clientSecret } : {}),
            authTransport:
              credentials.via === 'basic' ? 'basic' : credentials.via === 'post' ? 'post' : 'none',
            ...(requestedScopes ? { requestedScopes } : {}),
          });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '';
    if (message.includes('INVALID_CLIENT')) return invalidClient();
    if (message.includes('INVALID_SCOPE'))
      return Response.json({ error: 'invalid_scope' }, { status: 400 });
    if (message.includes('INVALID_GRANT') || message === 'Invalid authorization code')
      return Response.json({ error: 'invalid_grant' }, { status: 400 });
    return Response.json({ error: 'server_error' }, { status: 503 });
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
        refresh_token: grant.refreshToken,
        scope: grant.scopes.join(' '),
      },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
  } catch {
    return Response.json({ error: 'server_error' }, { status: 503 });
  }
}
