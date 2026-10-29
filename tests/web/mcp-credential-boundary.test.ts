import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportPKCS8, exportSPKI, generateKeyPair, jwtVerify } from 'jose';
import { api } from '../../convex/_generated/api';
import {
  mcpBackendClient,
  prepareMcpAccessTokenSigner,
  verifyMcpAccessToken,
} from '../../apps/web/lib/mcp/oauth';
import { POST as tokenPost } from '../../apps/web/app/oauth/token/route';

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let privatePem: string;
let publicPem: string;
let weakPrivatePem: string;

beforeAll(async () => {
  keys = await generateKeyPair('RS256', { extractable: true });
  privatePem = await exportPKCS8(keys.privateKey);
  publicPem = await exportSPKI(keys.publicKey);
  weakPrivatePem = generateKeyPairSync('rsa', {
    modulusLength: 1024,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
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
    const sign = await prepareMcpAccessTokenSigner();
    const token = await sign('user-one', 'grant-one', ['finapp:read']);
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

  it('keeps the prepared signing key stable across later environment changes', async () => {
    const sign = await prepareMcpAccessTokenSigner();
    vi.stubEnv('MCP_SIGNING_PRIVATE_KEY', 'invalid after preparation');
    const token = await sign('user-one', 'grant-one', ['finapp:read']);
    await expect(verifyMcpAccessToken(token)).resolves.toMatchObject({
      userId: 'user-one',
      grantId: 'grant-one',
    });
  });

  it.each(['missing', 'malformed', 'weak'] as const)(
    'returns a server error before consuming the code with a %s signing key',
    async (failure) => {
      vi.stubEnv(
        'MCP_SIGNING_PRIVATE_KEY',
        failure === 'missing' ? '' : failure === 'weak' ? weakPrivatePem : 'not a PEM key',
      );
      const exchange = vi.fn(async () =>
        Response.json({
          status: 'success',
          value: { userId: 'user-one', grantId: 'grant-one', scopes: ['finapp:read'] },
        }),
      );
      vi.stubGlobal('fetch', exchange);
      const request = () =>
        new Request('https://finapp.test/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: 'a'.repeat(64),
            client_id: 'b'.repeat(64),
            redirect_uri: 'https://client.test/callback',
            code_verifier: 'c'.repeat(43),
            resource: 'https://finapp.test/mcp',
          }),
        });
      const failed = await tokenPost(request());
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual({ error: 'server_error' });
      expect(exchange).not.toHaveBeenCalled();

      vi.stubEnv('MCP_SIGNING_PRIVATE_KEY', privatePem);
      const retried = await tokenPost(request());
      expect(retried.status).toBe(200);
      const body = (await retried.json()) as { access_token: string };
      await expect(verifyMcpAccessToken(body.access_token)).resolves.toMatchObject({
        userId: 'user-one',
        grantId: 'grant-one',
      });
    },
  );
});
