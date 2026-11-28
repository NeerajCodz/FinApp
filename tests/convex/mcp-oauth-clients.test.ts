import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import {
  isCimdClientId,
  parseCimdDocument,
  readClientCredentials,
  selectCimdAuthMethod,
} from '../../convex/shared/mcpClients';

const modules = import.meta.glob('../../convex/**/*.ts');
const redirectUri = 'https://chatgpt.com/connector_platform_oauth_redirect';
const verifier = 'v'.repeat(43);

const challenge = createHash('sha256').update(verifier).digest('base64url');

afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  const subject = 'oauth-clients-owner';
  await t.run((ctx) =>
    ctx.db.insert('users', {
      identityId: subject,
      email: `${subject}@example.com`,
      emailVerificationTime: 1,
      displayName: subject,
    }),
  );
  const owner = t.withIdentity({ subject, email: `${subject}@example.com`, name: subject });
  const authorize = (clientId: string) =>
    owner.mutation(api.mcpOAuth.createAuthorizationCode, {
      clientId,
      redirectUri,
      codeChallenge: challenge,
      scopes: ['finapp:read'],
    });
  return { t, owner, authorize };
}

describe('confidential clients', () => {
  it('DCR client_secret_post: issues a secret once and requires it at the token endpoint', async () => {
    const { t, authorize } = await setup();
    const registration = await t.mutation(api.mcpOAuth.registerClient, {
      clientName: 'Secret client',
      redirectUris: [redirectUri],
      tokenEndpointAuthMethod: 'client_secret_post',
    });
    expect(registration).toMatchObject({
      token_endpoint_auth_method: 'client_secret_post',
      client_secret: expect.any(String),
      client_secret_expires_at: 0,
    });
    const code = await authorize(registration.client_id);
    const exchange = {
      code,
      clientId: registration.client_id,
      redirectUri,
      codeVerifier: verifier,
      authTransport: 'post' as const,
    };
    await expect(t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, exchange)).rejects.toThrow(
      'INVALID_CLIENT',
    );
    await expect(
      t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, { ...exchange, clientSecret: 'wrong' }),
    ).rejects.toThrow('INVALID_CLIENT');
    await expect(
      t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
        code,
        clientId: registration.client_id,
        redirectUri,
        codeVerifier: verifier,
        clientSecret: registration.client_secret!,
      }),
    ).rejects.toThrow('INVALID_CLIENT');
    const grant = await t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
      ...exchange,
      clientSecret: registration.client_secret!,
    });
    await expect(
      t.mutation(internal.mcpOAuth.refreshAccessGrant, {
        refreshToken: grant.refreshToken,
        clientId: registration.client_id,
        clientSecret: registration.client_secret!,
      }),
    ).rejects.toThrow('INVALID_CLIENT');
    const refreshed = await t.mutation(internal.mcpOAuth.refreshAccessGrant, {
      refreshToken: grant.refreshToken,
      clientId: registration.client_id,
      clientSecret: registration.client_secret!,
      authTransport: 'post',
    });
    expect(refreshed.refreshToken).toEqual(expect.any(String));
    expect(grant.refreshToken).toEqual(expect.any(String));
  });

  it('dashboard clients belong to their owner, default to ChatGPT, and delete revokes grants', async () => {
    vi.useFakeTimers();
    const { t, owner, authorize } = await setup();
    const created = await owner.mutation(api.mcpOAuth.createStaticClient, {
      clientName: 'ChatGPT',
    });
    expect(created).toMatchObject({
      tokenEndpointAuthMethod: 'client_secret_basic',
      redirectUris: [redirectUri],
    });
    expect(await owner.query(api.mcpOAuth.listMyClients, {})).toHaveLength(1);
    const code = await authorize(created.clientId);
    const grant = await t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
      code,
      clientId: created.clientId,
      redirectUri,
      codeVerifier: verifier,
      clientSecret: created.clientSecret,
      authTransport: 'basic',
    });
    await owner.mutation(api.mcpOAuth.deleteMyClient, { clientId: created.clientId });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const stored = await t.run((ctx) => ctx.db.get(grant.grantId));
    expect(stored?.revokedAt).toEqual(expect.any(Number));
    expect(await owner.query(api.mcpOAuth.listMyClients, {})).toHaveLength(0);
  });

  it('a public client cannot present a secret', async () => {
    const { t, authorize } = await setup();
    const registration = await t.mutation(api.mcpOAuth.registerClient, {
      clientName: 'Public client',
      redirectUris: [redirectUri],
    });
    const code = await authorize(registration.client_id);
    await expect(
      t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
        code,
        clientId: registration.client_id,
        redirectUri,
        codeVerifier: verifier,
        clientSecret: 'x',
        authTransport: 'none',
      }),
    ).rejects.toThrow('INVALID_CLIENT');
  });
});

describe('refresh tokens', () => {
  it('rotate on use, reject reuse, and stop after revocation', async () => {
    const { t, owner, authorize } = await setup();
    const registration = await t.mutation(api.mcpOAuth.registerClient, {
      clientName: 'Refreshing client',
      redirectUris: [redirectUri],
    });
    const code = await authorize(registration.client_id);
    const first = await t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
      code,
      clientId: registration.client_id,
      redirectUri,
      codeVerifier: verifier,
      authTransport: 'none',
    });
    const second = await t.mutation(internal.mcpOAuth.refreshAccessGrant, {
      refreshToken: first.refreshToken,
      clientId: registration.client_id,
      authTransport: 'none',
    });
    expect(second.grantId).toBe(first.grantId);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(
      t.mutation(internal.mcpOAuth.refreshAccessGrant, {
        refreshToken: first.refreshToken,
        clientId: registration.client_id,
        authTransport: 'none',
      }),
    ).rejects.toThrow('INVALID_GRANT');
    await owner.mutation(api.mcpOAuth.revokeGrant, { grantId: second.grantId });
    await expect(
      t.mutation(internal.mcpOAuth.refreshAccessGrant, {
        refreshToken: second.refreshToken,
        clientId: registration.client_id,
        authTransport: 'none',
      }),
    ).rejects.toThrow('INVALID_GRANT');
  });
});

describe('client ID metadata documents', () => {
  const clientId = 'https://chatgpt.com/oauth/client.json';

  it('recognises metadata-document client ids and rejects unsafe ones', () => {
    expect(isCimdClientId(clientId)).toBe(true);
    expect(isCimdClientId('https://chatgpt.com/')).toBe(false);
    expect(isCimdClientId('http://chatgpt.com/oauth/client.json')).toBe(false);
    expect(isCimdClientId('https://127.0.0.1/client.json')).toBe(false);
    expect(isCimdClientId('https://localhost/client.json')).toBe(false);
    expect(isCimdClientId('https://chatgpt.com:8443/client.json')).toBe(false);
  });

  it('picks the auth method from the intersection, preferring the singular choice', () => {
    expect(
      selectCimdAuthMethod({
        token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
        token_endpoint_auth_method: 'private_key_jwt',
      }),
    ).toBe('private_key_jwt');
    expect(
      selectCimdAuthMethod({
        token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
        token_endpoint_auth_method: 'none',
      }),
    ).toBe('none');
    expect(selectCimdAuthMethod({ token_endpoint_auth_methods_supported: ['none'] })).toBe('none');
    expect(selectCimdAuthMethod({ token_endpoint_auth_method: 'client_secret_basic' })).toBeNull();
  });

  it('validates the document and defaults the JWKS to the document origin', () => {
    const parsed = parseCimdDocument(clientId, {
      client_id: clientId,
      client_name: 'ChatGPT',
      redirect_uris: [redirectUri],
      token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
      token_endpoint_auth_method: 'private_key_jwt',
    });
    expect(parsed).toEqual({
      clientName: 'ChatGPT',
      redirectUris: [redirectUri],
      tokenEndpointAuthMethod: 'private_key_jwt',
      jwksUri: 'https://chatgpt.com/oauth/jwks.json',
    });
    expect(() =>
      parseCimdDocument(clientId, {
        client_id: 'https://evil.example/c.json',
        redirect_uris: [redirectUri],
      }),
    ).toThrow('CLIENT_ID_MISMATCH');
    expect(() =>
      parseCimdDocument(clientId, { client_id: clientId, redirect_uris: ['javascript:alert(1)'] }),
    ).toThrow('INVALID_REDIRECT_URI');
  });

  it('stores a metadata client that can authorize; a private_key_jwt client cannot skip its assertion', async () => {
    const { t, authorize } = await setup();
    await t.mutation(internal.mcpOAuth.upsertMetadataClient, {
      clientId,
      clientName: 'ChatGPT',
      redirectUris: [redirectUri],
      tokenEndpointAuthMethod: 'private_key_jwt',
      jwksUri: 'https://chatgpt.com/oauth/jwks.json',
    });
    expect(await t.query(api.mcpOAuth.client, { clientId })).toMatchObject({
      registration: 'cimd',
      redirectUris: [redirectUri],
    });
    const code = await authorize(clientId);
    await expect(
      t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
        code,
        clientId,
        redirectUri,
        codeVerifier: verifier,
      }),
    ).rejects.toThrow('INVALID_CLIENT');
    const grant = await t.mutation(internal.mcpOAuth.exchangeAuthorizationCodeWithAssertion, {
      code,
      clientId,
      redirectUri,
      codeVerifier: verifier,
      assertionJti: 'jti-1',
      assertionExpiresAt: Date.now() + 60_000,
    });
    expect(grant.refreshToken).toEqual(expect.any(String));
    // A replayed assertion (same jti) is refused.
    await expect(
      t.mutation(internal.mcpOAuth.refreshAccessGrantWithAssertion, {
        refreshToken: grant.refreshToken,
        clientId,
        assertionJti: 'jti-1',
        assertionExpiresAt: Date.now() + 60_000,
      }),
    ).rejects.toThrow('INVALID_CLIENT');
  });
});

describe('token request client credentials', () => {
  it('reads Basic, post and assertion credentials and refuses mixing them', () => {
    const basic = `Basic ${btoa('client%20one:se%3Acret')}`;
    expect(readClientCredentials(basic, new URLSearchParams())).toEqual({
      clientId: 'client one',
      clientSecret: 'se:cret',
      via: 'basic',
    });
    expect(
      readClientCredentials(null, new URLSearchParams({ client_id: 'a', client_secret: 'b' })),
    ).toEqual({ clientId: 'a', clientSecret: 'b', via: 'post' });
    expect(
      readClientCredentials(
        null,
        new URLSearchParams({
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: 'x.y.z',
        }),
      ),
    ).toEqual({ clientId: null, clientAssertion: 'x.y.z', via: 'assertion' });
    expect(readClientCredentials(basic, new URLSearchParams({ client_secret: 'b' }))).toEqual({
      error: 'invalid_request',
    });
  });
});
