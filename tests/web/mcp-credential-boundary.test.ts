import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportPKCS8, exportSPKI, generateKeyPair, jwtVerify } from 'jose';
import { api } from '../../convex/_generated/api';
import {
  mcpBackendClient,
  signMcpAccessToken,
  verifyMcpAccessToken,
} from '../../apps/web/lib/mcp/oauth';

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let privatePem: string;
let publicPem: string;

beforeAll(async () => {
  keys = await generateKeyPair('RS256', { extractable: true });
  privatePem = await exportPKCS8(keys.privateKey);
  publicPem = await exportSPKI(keys.publicKey);
});
beforeEach(() => {
  vi.stubEnv('MCP_ISSUER_URL', 'https://finapp.test');
  vi.stubEnv('MCP_RESOURCE_URL', 'https://finapp.test/mcp');
  vi.stubEnv('MCP_SIGNING_KEY_ID', 'credential-boundary-test');
  vi.stubEnv('MCP_SIGNING_PRIVATE_KEY', privatePem);
  vi.stubEnv('MCP_SIGNING_PUBLIC_KEY', publicPem);
  vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://fixture.convex.cloud');
  vi.stubEnv('CONVEX_SITE_URL', 'https://fixture.convex.site');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function backendProvider() {
  vi.resetModules();
  const { default: config } = await import('../../convex/auth.config');
  const provider = config.providers.find((entry) => 'type' in entry && entry.type === 'customJwt');
  if (!provider || !('issuer' in provider)) throw new Error('MCP backend provider is missing');
  return provider;
}

async function outgoingBackendToken() {
  let token = '';
  vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    token = new Headers(init?.headers).get('Authorization')?.replace(/^Bearer /, '') ?? '';
    return Response.json({ status: 'success', value: null });
  });
  const client = await mcpBackendClient({
    userId: 'user-one',
    grantId: 'grant-one',
    scopes: ['finapp:read'],
  });
  await client.query(api.mcpOAuth.currentUser, {});
  return token;
}

describe('MCP credential boundary', () => {
  it('rejects a client-facing access token under the actual Convex auth provider audience', async () => {
    const token = await signMcpAccessToken('user-one', 'grant-one', ['finapp:read']);
    const provider = await backendProvider();
    await expect(
      jwtVerify(token, keys.publicKey, {
        issuer: provider.issuer,
        audience: provider.applicationID,
        algorithms: ['RS256'],
      }),
    ).rejects.toMatchObject({ code: 'ERR_JWT_CLAIM_VALIDATION_FAILED', claim: 'aud' });
    await expect(verifyMcpAccessToken(token)).resolves.toEqual({
      userId: 'user-one',
      grantId: 'grant-one',
      scopes: ['finapp:read'],
    });
  });

  it('uses a short-lived backend credential which cannot be substituted for an MCP access token', async () => {
    const token = await outgoingBackendToken();
    const provider = await backendProvider();
    const { payload } = await jwtVerify(token, keys.publicKey, {
      issuer: provider.issuer,
      audience: provider.applicationID,
      algorithms: ['RS256'],
    });
    expect(payload).toMatchObject({ sub: 'user-one', grantId: 'grant-one' });
    await expect(verifyMcpAccessToken(token)).rejects.toMatchObject({
      code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
      claim: 'aud',
    });
    await expect(
      jwtVerify(token, keys.publicKey, {
        issuer: provider.issuer,
        audience: provider.applicationID,
        algorithms: ['RS256'],
        currentDate: new Date(((payload.iat ?? 0) + 61) * 1000),
      }),
    ).rejects.toMatchObject({ code: 'ERR_JWT_EXPIRED' });
  });
});
