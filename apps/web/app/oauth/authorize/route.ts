import { api } from '@convex/_generated/api';
import { authorizationRedirect } from '@finapp/mcp/metadata';
import { convexClient, mcpResourceUrl } from '@finapp/mcp/oauth';
import { developerAuthorize, isAppClientId } from '@/lib/developerOAuth';

export const runtime = 'nodejs';

const invalid = (error: string, status = 400) => Response.json({ error }, { status });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const state = params.get('state');
  if (!clientId || !redirectUri) return invalid('invalid_request');
  // Public API developer apps share this endpoint; MCP clients continue below.
  if (isAppClientId(clientId)) return developerAuthorize(request, params);

  // Resolve the client first: issued ids are looked up, HTTPS ids are Client ID Metadata
  // Documents that the backend fetches and validates.
  const client = await convexClient()
    .action(api.mcpOAuthActions.resolveClient, { clientId })
    .catch(() => null);
  // Never redirect to an unverified address (RFC 6749 §4.1.2.1).
  if (!client || !client.redirectUris.includes(redirectUri)) return invalid('invalid_client');

  // From here the redirect URI is trusted: report errors to it, with `iss` (RFC 9207).
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
  const resource = params.get('resource');
  if (resource && resource !== mcpResourceUrl()) return fail('invalid_target', 'Unknown resource.');

  const scopes = [
    ...new Set(['finapp:read', ...(params.get('scope') ?? '').split(/\s+/).filter(Boolean)]),
  ];
  const authorizeUrl = new URL('/mcp/authorize', request.url);
  for (const [key, value] of params.entries()) authorizeUrl.searchParams.set(key, value);
  authorizeUrl.searchParams.set('client_name', client.clientName);
  authorizeUrl.searchParams.set('scope', scopes.join(' '));
  return Response.redirect(authorizeUrl, 302);
}
