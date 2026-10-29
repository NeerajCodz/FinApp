import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
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

async function authorization(verifier = defaultVerifier) {
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
  });
  const codeArgs = {
    clientId: registration.client_id,
    redirectUri,
    codeChallenge: challenge(verifier),
    scopes: ['finapp:read'],
  };
  const code = await owner.mutation(api.mcpOAuth.createAuthorizationCode, codeArgs);
  const exchange = {
    code,
    clientId: registration.client_id,
    redirectUri,
    codeVerifier: verifier,
  };
  const storedCode = () => t.run((ctx) => ctx.db.query('mcpOAuthCodes').unique());
  const grants = () => t.run((ctx) => ctx.db.query('mcpOAuthGrants').collect());
  return { t, owner, userId, exchange, codeArgs, storedCode, grants };
}

describe('MCP OAuth authorization code exchange', () => {
  it('consumes a successful code and rejects replay without minting another grant', async () => {
    const fixture = await authorization();
    const grant = await fixture.t.mutation(
      api.mcpOAuth.exchangeAuthorizationCode,
      fixture.exchange,
    );

    expect(grant).toMatchObject({ userId: fixture.userId, scopes: ['finapp:read'] });
    expect(await fixture.storedCode()).toMatchObject({ consumedAt: expect.any(Number) });
    expect(await fixture.grants()).toEqual([
      expect.objectContaining({ _id: grant.grantId, userId: fixture.userId }),
    ]);
    await expect(
      fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
    ).rejects.toThrow('INVALID_GRANT');
    expect(await fixture.grants()).toHaveLength(1);
  });

  it('cannot replay a consumed code to replace a revoked connection', async () => {
    const fixture = await authorization();
    const grant = await fixture.t.mutation(
      api.mcpOAuth.exchangeAuthorizationCode,
      fixture.exchange,
    );
    await fixture.owner.mutation(api.mcpOAuth.revokeGrant, { grantId: grant.grantId });

    await expect(
      fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
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
      fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
        ...fixture.exchange,
        codeVerifier: 'b'.repeat(43),
      }),
    ).rejects.toThrow('INVALID_GRANT');
    expect((await fixture.storedCode())?.consumedAt).toBeUndefined();
    expect(await fixture.grants()).toHaveLength(0);

    await expect(
      fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
    ).resolves.toMatchObject({ userId: fixture.userId });
    expect(await fixture.grants()).toHaveLength(1);
  });

  it.each([43, 128])('accepts RFC 7636 unreserved verifiers of length %i', async (length) => {
    const verifier = `Az09-_.~${'a'.repeat(length - 8)}`;
    const fixture = await authorization(verifier);
    await expect(
      fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
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
      fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
        ...fixture.exchange,
        codeVerifier,
      }),
    ).rejects.toThrow('INVALID_GRANT');
    expect((await fixture.storedCode())?.consumedAt).toBeUndefined();
    expect(await fixture.grants()).toHaveLength(0);
    await expect(
      fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
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
        fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, exchange),
      ).rejects.toThrow('INVALID_GRANT');
      expect((await fixture.storedCode())?.consumedAt).toBeUndefined();
      expect(await fixture.grants()).toHaveLength(0);
      await expect(
        fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
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
      fixture.t.mutation(api.mcpOAuth.exchangeAuthorizationCode, fixture.exchange),
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
});
