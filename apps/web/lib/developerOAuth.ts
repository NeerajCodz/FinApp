/**
 * Public API OAuth (third-party developer apps, `fa_app_…` client ids) on the shared
 * /oauth/authorize, /oauth/token and /oauth/revoke endpoints. MCP clients keep their own flow;
 * these helpers only run for developer-app client ids.
 */
import { api } from '@convex/_generated/api';
import { isAppClientId } from '@convex/publicApi/tokens';
import { isApiScope, scopesOutside, type ApiScope } from '@convex/publicApi/scopes';
import { authorizationRedirect } from '@finapp/mcp/metadata';
import { convexClient } from '@finapp/mcp/oauth';

export { isAppClientId };

const noStore = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

export async function developerAuthorize(request: Request, params: URLSearchParams) {
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state');
  const app = await convexClient()
    .query(api.publicApi.oauthApps.publicApp, { clientId })
    .catch(() => null);
  // Never redirect to an address the app did not register (RFC 6749 §4.1.2.1).
  if (!app || !app.redirectUris.includes(redirectUri))
    return Response.json({ error: 'invalid_client' }, { status: 400 });
  const fail = (error: string, description: string) =>
    Response.redirect(
      authorizationRedirect(redirectUri, {
        error,
        error_description: description,
        ...(state ? { state } : {}),
      }),
      302,
    );
  if (params.get('response_type') !== 'code')
    return fail('unsupported_response_type', 'Only the authorization code flow is supported.');
  if (!state || state.length > 1024) return fail('invalid_request', 'A state value is required.');
  const challenge = params.get('code_challenge');
  if (
    params.get('code_challenge_method') !== 'S256' ||
    !challenge ||
    !/^[A-Za-z0-9_-]{43}$/.test(challenge)
  )
    return fail('invalid_request', 'PKCE with S256 is required.');
  const requested = (params.get('scope') ?? '').split(/[\s,]+/).filter(Boolean);
  const scopes = requested.length ? requested : app.scopes;
  if (
    scopes.some((scope) => !isApiScope(scope)) ||
    scopesOutside(scopes as ApiScope[], app.scopes as ApiScope[]).length
  )
    return fail('invalid_scope', 'The app requested a scope it is not registered for.');
  const consent = new URL('/oauth/consent', request.url);
  consent.searchParams.set('client_id', clientId);
  consent.searchParams.set('redirect_uri', redirectUri);
  consent.searchParams.set('state', state);
  consent.searchParams.set('code_challenge', challenge);
  consent.searchParams.set('scope', [...new Set(scopes)].join(' '));
  return Response.redirect(consent, 302);
}

type Credentials = {
  clientId: string;
  clientSecret?: string;
  clientAssertion?: string;
  via: string;
};

export async function developerToken(form: URLSearchParams, credentials: Credentials) {
  const invalidClient = () =>
    Response.json(
      { error: 'invalid_client' },
      {
        status: 401,
        headers: credentials.via === 'basic' ? { 'WWW-Authenticate': 'Basic realm="finapp"' } : {},
      },
    );
  if (credentials.clientAssertion) return invalidClient();
  const grantType = form.get('grant_type');
  const client = convexClient();
  const secret = credentials.clientSecret ? { clientSecret: credentials.clientSecret } : {};
  try {
    if (grantType === 'authorization_code') {
      const code = form.get('code');
      const redirectUri = form.get('redirect_uri');
      const codeVerifier = form.get('code_verifier');
      if (!code || !redirectUri || !codeVerifier)
        return Response.json({ error: 'invalid_request' }, { status: 400 });
      const tokens = await client.mutation(api.publicApi.oauthApps.exchangeCode, {
        clientId: credentials.clientId,
        code,
        redirectUri,
        codeVerifier,
        ...secret,
      });
      return Response.json(tokens, { headers: noStore });
    }
    if (grantType === 'refresh_token') {
      const refreshToken = form.get('refresh_token');
      if (!refreshToken) return Response.json({ error: 'invalid_request' }, { status: 400 });
      const tokens = await client.mutation(api.publicApi.oauthApps.refresh, {
        clientId: credentials.clientId,
        refreshToken,
        ...secret,
      });
      if ('error' in tokens) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      return Response.json(tokens, { headers: noStore });
    }
    return Response.json({ error: 'unsupported_grant_type' }, { status: 400 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '';
    if (message.includes('INVALID_CLIENT')) return invalidClient();
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  }
}

export async function developerRevoke(form: URLSearchParams, credentials: Credentials) {
  const token = form.get('token');
  if (!token) return Response.json({ error: 'invalid_request' }, { status: 400 });
  try {
    await convexClient().mutation(api.publicApi.oauthApps.revokeToken, {
      clientId: credentials.clientId,
      token,
      ...(credentials.clientSecret ? { clientSecret: credentials.clientSecret } : {}),
    });
  } catch {
    return Response.json({ error: 'invalid_client' }, { status: 401 });
  }
  // RFC 7009: unknown tokens are not an error.
  return new Response(null, { status: 200, headers: noStore });
}
