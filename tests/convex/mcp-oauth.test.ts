import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');
const redirectUri = 'https://mcp.example.com/callback';
const defaultVerifier = 'a'.repeat(43);

function challenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function differentHex(value: string) {
  return `${value[0] === 'a' ? 'b' : 'a'}${value.slice(1)}`;
}

async function authorization(
  verifier = defaultVerifier,
  tokenEndpointAuthMethod: 'none' | 'client_secret_basic' | 'client_secret_post' = 'none',
  scopes: string[] = ['finapp:read'],
) {
  const t = convexTest(schema, modules);
  const subject = 'mcp-oauth-owner';
  const userId = await t.run((ctx) =>
    ctx.db.insert('users', {
      identityId: subject,
      email: `${subject}@example.com`,
      emailVerificationTime: 1,
      displayName: subject,
    }),
  );
  const owner = t.withIdentity({ subject, email: `${subject}@example.com`, name: subject });
  const registration = await t.mutation(api.mcpOAuth.registerClient, {
    clientName: 'OAuth regression client',
    redirectUris: [redirectUri],
    tokenEndpointAuthMethod,
  });
  const codeArgs = {
    clientId: registration.client_id,
    redirectUri,
    codeChallenge: challenge(verifier),
    scopes,
  };
  const code = await owner.mutation(api.mcpOAuth.createAuthorizationCode, codeArgs);
  const exchange = {
    code,
    clientId: registration.client_id,
    redirectUri,
    codeVerifier: verifier,
    authTransport:
      tokenEndpointAuthMethod === 'client_secret_basic'
        ? ('basic' as const)
        : tokenEndpointAuthMethod === 'client_secret_post'
          ? ('post' as const)
          : ('none' as const),
  };
  const storedCode = () => t.run((ctx) => ctx.db.query('mcpOAuthCodes').unique());
  const grants = () => t.run((ctx) => ctx.db.query('mcpOAuthGrants').collect());
  return { t, owner, userId, registration, exchange, codeArgs, storedCode, grants };
}

describe('MCP OAuth authorization code exchange', () => {
  it('consumes a successful code and rejects replay without minting another grant', async () => {
    const fixture = await authorization();
    const grant = await fixture.t.mutation(
      internal.mcpOAuth.exchangeAuthorizationCode,
      fixture.exchange,
    );

    expect(grant).toMatchObject({ userId: fixture.userId, scopes: ['finapp:read'] });
    expect(await fixture.storedCode()).toMatchObject({ consumedAt: expect.any(Number) });
    expect(await fixture.grants()).toEqual([
      expect.objectContaining({ _id: grant.grantId, userId: fixture.userId }),
    ]);
    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
    ).rejects.toThrow('INVALID_GRANT');
    expect(await fixture.grants()).toHaveLength(1);
  });

  it('cannot replay a consumed code to replace a revoked connection', async () => {
    const fixture = await authorization();
    const grant = await fixture.t.mutation(
      internal.mcpOAuth.exchangeAuthorizationCode,
      fixture.exchange,
    );
    await fixture.owner.mutation(api.mcpOAuth.revokeGrant, { grantId: grant.grantId });

    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
    ).rejects.toThrow('INVALID_GRANT');
    expect(await fixture.grants()).toEqual([
      expect.objectContaining({ _id: grant.grantId, revokedAt: expect.any(Number) }),
    ]);
    await expect(
      fixture.owner.query(api.mcpOAuth.activeGrant, { grantId: grant.grantId }),
    ).resolves.toBe(false);
  });

  it('does not consume the code when a well-formed verifier fails PKCE', async () => {
    const fixture = await authorization();
    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
        ...fixture.exchange,
        codeVerifier: 'b'.repeat(43),
      }),
    ).rejects.toThrow('INVALID_GRANT');
    expect((await fixture.storedCode())?.consumedAt).toBeUndefined();
    expect(await fixture.grants()).toHaveLength(0);

    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
    ).resolves.toMatchObject({ userId: fixture.userId });
    expect(await fixture.grants()).toHaveLength(1);
  });

  it.each([43, 128])('accepts RFC 7636 unreserved verifiers of length %i', async (length) => {
    const verifier = `Az09-_.~${'a'.repeat(length - 8)}`;
    const fixture = await authorization(verifier);
    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
    ).resolves.toMatchObject({ userId: fixture.userId });
    expect(await fixture.storedCode()).toMatchObject({ consumedAt: expect.any(Number) });
  });

  it.each([
    ['too short', 'a'.repeat(42)],
    ['too long', 'a'.repeat(129)],
    ['space', `${'a'.repeat(42)} `],
    ['plus', `${'a'.repeat(42)}+`],
    ['slash', `${'a'.repeat(42)}/`],
    ['padding', `${'a'.repeat(42)}=`],
  ])('rejects a %s verifier without consuming the code', async (_label, codeVerifier) => {
    const fixture = await authorization();
    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
        ...fixture.exchange,
        codeVerifier,
      }),
    ).rejects.toThrow('INVALID_GRANT');
    expect((await fixture.storedCode())?.consumedAt).toBeUndefined();
    expect(await fixture.grants()).toHaveLength(0);
    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
    ).resolves.toMatchObject({ userId: fixture.userId });
  });

  it.each(['client', 'redirect', 'code'] as const)(
    'rejects a mismatched %s without consuming the valid code',
    async (field) => {
      const fixture = await authorization();
      const exchange = { ...fixture.exchange };
      if (field === 'client') exchange.clientId = differentHex(exchange.clientId);
      if (field === 'redirect') exchange.redirectUri = 'https://mcp.example.com/other';
      if (field === 'code') exchange.code = differentHex(exchange.code);

      await expect(
        fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, exchange),
      ).rejects.toThrow(field === 'client' ? 'INVALID_CLIENT' : 'INVALID_GRANT');
      expect((await fixture.storedCode())?.consumedAt).toBeUndefined();
      expect(await fixture.grants()).toHaveLength(0);
      await expect(
        fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
      ).resolves.toMatchObject({ userId: fixture.userId });
    },
  );

  it('rejects an expired code without consuming it or minting a grant', async () => {
    const fixture = await authorization();
    await fixture.t.run(async (ctx) => {
      const code = await ctx.db.query('mcpOAuthCodes').unique();
      if (!code) throw new Error('Expected authorization code');
      await ctx.db.patch(code._id, { expiresAt: 0 });
    });

    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
    ).rejects.toThrow('INVALID_GRANT');
    expect((await fixture.storedCode())?.consumedAt).toBeUndefined();
    expect(await fixture.grants()).toHaveLength(0);
  });

  it.each([
    ['too short', 'a'.repeat(42)],
    ['too long', 'a'.repeat(44)],
    ['dot', `${'a'.repeat(42)}.`],
    ['tilde', `${'a'.repeat(42)}~`],
  ])('keeps rejecting a %s S256 challenge', async (_label, codeChallenge) => {
    const fixture = await authorization();
    await expect(
      fixture.owner.mutation(api.mcpOAuth.createAuthorizationCode, {
        ...fixture.codeArgs,
        codeChallenge,
      }),
    ).rejects.toThrow('INVALID_CLIENT');
    expect(await fixture.t.run((ctx) => ctx.db.query('mcpOAuthCodes').collect())).toHaveLength(1);
  });
  it.each([
    {
      method: 'client_secret_basic' as const,
      wrongTransport: 'post' as const,
      correctTransport: 'basic' as const,
    },
    {
      method: 'client_secret_post' as const,
      wrongTransport: 'basic' as const,
      correctTransport: 'post' as const,
    },
  ])('requires the registered $method credential transport', async ({
    method,
    wrongTransport,
    correctTransport,
  }) => {
    const fixture = await authorization(defaultVerifier, method);
    const clientSecret = fixture.registration.client_secret;
    if (!clientSecret) throw new Error('Expected a registered client secret');

    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
        ...fixture.exchange,
        clientSecret,
        authTransport: wrongTransport,
      }),
    ).rejects.toThrow('INVALID_CLIENT');
    await expect(
      fixture.t.mutation(internal.mcpOAuth.exchangeAuthorizationCode, {
        ...fixture.exchange,
        clientSecret,
        authTransport: correctTransport,
      }),
    ).resolves.toMatchObject({ userId: fixture.userId });
  });

  it('narrows the live grant to a requested refresh scope subset', async () => {
    const fixture = await authorization(defaultVerifier, 'none', [
      'finapp:read',
      'finapp:write:finance',
    ]);
    const initial = await fixture.t.mutation(
      internal.mcpOAuth.exchangeAuthorizationCode,
      fixture.exchange,
    );

    await expect(
      fixture.t.mutation(internal.mcpOAuth.refreshAccessGrant, {
        refreshToken: initial.refreshToken,
        clientId: fixture.registration.client_id,
        requestedScopes: ['finapp:read', 'finapp:write:social'],
        authTransport: 'none',
      }),
    ).rejects.toThrow('INVALID_SCOPE');
    const narrowed = await fixture.t.mutation(internal.mcpOAuth.refreshAccessGrant, {
      refreshToken: initial.refreshToken,
      clientId: fixture.registration.client_id,
      authTransport: 'none',
      requestedScopes: ['finapp:read'],
    });
    expect(narrowed.scopes).toEqual(['finapp:read']);
    expect(await fixture.grants()).toMatchObject([{ scopes: ['finapp:read'] }]);
    await expect(
      fixture.t.mutation(internal.mcpOAuth.refreshAccessGrant, {
        refreshToken: narrowed.refreshToken,
        clientId: fixture.registration.client_id,
        authTransport: 'none',
      }),
    ).resolves.toMatchObject({ scopes: ['finapp:read'] });
  });

  it('applies newly granted scopes to the live grant policy', async () => {
    const fixture = await authorization();
    const grant = await fixture.t.mutation(
      internal.mcpOAuth.exchangeAuthorizationCode,
      fixture.exchange,
    );

    await fixture.owner.mutation(api.mcpOAuth.updateGrantScopes, {
      grantId: grant.grantId,
      scopes: ['finapp:write:finance'],
    });
    await expect(
      fixture.owner.query(api.mcpOAuth.accessPolicy, { grantId: grant.grantId }),
    ).resolves.toMatchObject({ scopes: ['finapp:read', 'finapp:write:finance'] });
  });

  it('revokes every grant when its dashboard client is deleted', async () => {
    const fixture = await authorization();
    const client = await fixture.owner.mutation(api.mcpOAuth.createStaticClient, {
      clientName: 'Delete all grants regression client',
    });
    await fixture.t.run(async (ctx) => {
      for (let index = 0; index < 501; index += 1) {
        await ctx.db.insert('mcpOAuthGrants', {
          clientId: client.clientId,
          userId: fixture.userId,
          scopes: ['finapp:read'],
          createdAt: Date.now(),
        });
      }
    });

    await fixture.owner.mutation(api.mcpOAuth.deleteMyClient, { clientId: client.clientId });
    const grants = await fixture.t.run((ctx) =>
      ctx.db
        .query('mcpOAuthGrants')
        .withIndex('by_client', (index) => index.eq('clientId', client.clientId))
        .collect(),
    );
    expect(grants).toHaveLength(501);
    expect(grants.every((grant) => grant.revokedAt !== undefined)).toBe(true);
  });
});
