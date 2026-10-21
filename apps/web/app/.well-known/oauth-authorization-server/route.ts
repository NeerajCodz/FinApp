import { mcpIssuer, mcpResourceUrl } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const issuer = mcpIssuer();
  const origin = new URL(issuer);
  const metadata = {
    issuer,
    authorization_endpoint: new URL('/oauth/authorize', origin).toString(),
    token_endpoint: new URL('/oauth/token', origin).toString(),
    registration_endpoint: new URL('/oauth/register', origin).toString(),
    jwks_uri: new URL('/.well-known/jwks.json', origin).toString(),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [
      'finapp:read',
      'finapp:write:finance',
      'finapp:write:social',
      'finapp:write:groups',
      'finapp:write:personal',
    ],
    client_id_metadata_document_supported: false,

    resource: mcpResourceUrl(),
  };
  return Response.json(metadata, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
