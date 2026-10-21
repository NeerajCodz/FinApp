import { api } from '@convex/_generated/api';
import { convexClient, mcpResourceUrl } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const responseType = params.get('response_type');
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const state = params.get('state');
  const challenge = params.get('code_challenge');
  const scopes = [...new Set(['finapp:read', ...(params.get('scope') ?? '').split(/\s+/).filter(Boolean)])];
  if (
    responseType !== 'code' ||
    !clientId ||
    !redirectUri ||
    !state ||
    state.length > 1024 ||
    params.get('code_challenge_method') !== 'S256' ||
    !challenge ||
    !/^[A-Za-z0-9_-]{43}$/.test(challenge)
  ) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const resource = params.get('resource');
  if (resource !== mcpResourceUrl()) {
    return Response.json({ error: 'invalid_target' }, { status: 400 });
  }
  const client = await convexClient().query(api.mcpOAuth.client, { clientId }).catch(() => null);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return Response.json({ error: 'invalid_client' }, { status: 400 });
  }
  const authorizeUrl = new URL('/mcp/authorize', request.url);
  for (const [key, value] of params.entries()) authorizeUrl.searchParams.set(key, value);
  authorizeUrl.searchParams.set('client_name', client.clientName);
  authorizeUrl.searchParams.set('scope', scopes.join(' '));
  return Response.redirect(authorizeUrl, 302);
}
