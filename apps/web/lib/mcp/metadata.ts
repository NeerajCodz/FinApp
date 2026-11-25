import { TOKEN_ENDPOINT_AUTH_METHODS } from '@convex/shared/mcpClients';
import { mcpIssuer, mcpResourceUrl } from './oauth';

export const MCP_SCOPES = [
  'finapp:read',
  'finapp:write:finance',
  'finapp:write:social',
  'finapp:write:groups',
  'finapp:write:personal',
] as const;

/**
 * Authorization server metadata (RFC 8414), served at both
 * /.well-known/oauth-authorization-server and /.well-known/openid-configuration.
 *
 * Supports every client registration style ChatGPT offers: your own client credentials
 * (dashboard clients with a secret), Dynamic Client Registration, and Client ID Metadata
 * Documents (`private_key_jwt` or public). RFC 9207 `iss` is returned on every authorization
 * response, which lets ChatGPT use its stable redirect URI.
 */
export function authorizationServerMetadata() {
  const issuer = mcpIssuer();
  const at = (path: string) => new URL(path, issuer).toString();
  return {
    issuer,
    authorization_endpoint: at('/oauth/authorize'),
    token_endpoint: at('/oauth/token'),
    registration_endpoint: at('/oauth/register'),
    jwks_uri: at('/.well-known/jwks.json'),
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: [...TOKEN_ENDPOINT_AUTH_METHODS],
    token_endpoint_auth_signing_alg_values_supported: ['RS256', 'ES256', 'PS256', 'EdDSA'],
    scopes_supported: [...MCP_SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: at('/mcp/dashboard'),
    resource: mcpResourceUrl(),
  };
}

export function protectedResourceMetadata() {
  const issuer = mcpIssuer();
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [issuer],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Finapp',
    resource_documentation: new URL('/mcp/dashboard', issuer).toString(),
    resource_policy_uri: new URL('/privacy', issuer).toString(),
  };
}

/** Appends RFC 9207 `iss` (and the given params) to an authorization response redirect. */
export function authorizationRedirect(redirectUri: string, params: Record<string, string>) {
  const callback = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) callback.searchParams.set(key, value);
  callback.searchParams.set('iss', mcpIssuer());
  return callback.toString();
}
