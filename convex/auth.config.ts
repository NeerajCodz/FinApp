import type { AuthConfig } from 'convex/server';
import { MCP_CONVEX_AUDIENCE } from './shared/mcpAuth';

const convexSiteUrl = process.env.CONVEX_SITE_URL;
if (!convexSiteUrl) throw new Error('CONVEX_SITE_URL is required for Convex authentication.');

const providers: AuthConfig['providers'] = [
  {
    domain: convexSiteUrl,
    applicationID: 'convex',
  },
];

const mcpIssuer = process.env.MCP_ISSUER_URL;
if (mcpIssuer) {
  const issuer = new URL(mcpIssuer).origin;
  providers.push({
    type: 'customJwt',
    issuer,
    jwks: new URL('/.well-known/jwks.json', issuer).toString(),
    applicationID: MCP_CONVEX_AUDIENCE,
    algorithm: 'RS256',
  });
}

export default { providers } satisfies AuthConfig;
