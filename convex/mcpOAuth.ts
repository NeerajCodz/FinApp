import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { getOptionalUser, requireUser } from './shared/auth';
import { createNotification } from './notifications/mutations';
import {
  isConfidentialSecretMethod,
  isIssuedClientId,
  isTokenEndpointAuthMethod,
  isValidClientId,
  MAX_REDIRECT_URIS,
  REFRESH_TOKEN_TTL_MS,
  validJwksUri,
  validRedirectUri,
  type TokenEndpointAuthMethod,
} from './shared/mcpClients';

const allowedScopes: Record<string, true> = {
  'finapp:read': true,
  'finapp:write:finance': true,
  'finapp:write:social': true,
  'finapp:write:groups': true,
  'finapp:write:personal': true,
};

/** ChatGPT's connector callbacks, preset for dashboard-created clients. */
export const CHATGPT_REDIRECT_URIS = ['https://chatgpt.com/connector_platform_oauth_redirect'];

function base64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function isAllowedScope(scope: string): boolean {
  return Object.hasOwn(allowedScopes, scope);
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomSecret(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two equal-length hex digests. */
function sameDigest(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1)
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

function clientMethod(client: Doc<'mcpOAuthClients'>): TokenEndpointAuthMethod {
  return client.tokenEndpointAuthMethod ?? 'none';
}

function normalizeRedirects(redirectUris: readonly string[]): string[] {
  const redirects = [...new Set(redirectUris)];
  if (redirects.length < 1 || redirects.length > MAX_REDIRECT_URIS)
    throw new Error('INVALID_CLIENT_METADATA');
  if (redirects.some((uri) => !validRedirectUri(uri))) throw new Error('INVALID_REDIRECT_URI');
  return redirects;
}

async function findClient(ctx: { db: QueryCtx['db'] }, clientId: string) {
  return ctx.db
    .query('mcpOAuthClients')
    .withIndex('by_client_id', (index) => index.eq('clientId', clientId))
    .unique();
}

const tokenAuthMethod = v.union(
  v.literal('none'),
  v.literal('client_secret_basic'),
  v.literal('client_secret_post'),
  v.literal('private_key_jwt'),
);

/** Dynamic Client Registration (RFC 7591). Secret clients get their secret once, here. */
export const registerClient = mutation({
  args: {
    clientName: v.string(),
    redirectUris: v.array(v.string()),
    tokenEndpointAuthMethod: v.optional(tokenAuthMethod),
    jwksUri: v.optional(v.string()),
  },
  handler: async (ctx, { clientName, redirectUris, tokenEndpointAuthMethod, jwksUri }) => {
    const name = clientName.trim();
    if (!name || name.length > 128) throw new Error('INVALID_CLIENT_METADATA');
    const redirects = normalizeRedirects(redirectUris);
    const method = tokenEndpointAuthMethod ?? 'none';
    if (method === 'private_key_jwt' && !validJwksUri(jwksUri))
      throw new Error('INVALID_CLIENT_METADATA');
    const clientId = randomCode();
    const secret = isConfidentialSecretMethod(method) ? randomSecret() : undefined;
    const now = Date.now();
    await ctx.db.insert('mcpOAuthClients', {
      clientId,
      clientName: name,
      redirectUris: redirects,
      createdAt: now,
      registration: 'dcr',
      tokenEndpointAuthMethod: method,
      ...(secret ? { clientSecretHash: await hash(secret) } : {}),
      ...(method === 'private_key_jwt' && jwksUri ? { jwksUri } : {}),
    });
    return {
      client_id: clientId,
      client_id_issued_at: Math.floor(now / 1000),
      client_name: name,
      redirect_uris: redirects,
      token_endpoint_auth_method: method,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      ...(method === 'private_key_jwt' && jwksUri ? { jwks_uri: jwksUri } : {}),
    };
  },
});

/**
 * "Use your own client credentials": a signed-in user creates a confidential client on the MCP
 * dashboard and pastes its id and secret into ChatGPT (or another MCP client).
 */
export const createStaticClient = mutation({
  args: {
    clientName: v.string(),
    redirectUris: v.optional(v.array(v.string())),
    tokenEndpointAuthMethod: v.optional(
      v.union(v.literal('client_secret_basic'), v.literal('client_secret_post')),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const owned = await ctx.db
      .query('mcpOAuthClients')
      .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
      .take(21);
    if (owned.length >= 20) throw new Error('TOO_MANY_CLIENTS');
    const name = args.clientName.trim();
    if (!name || name.length > 128) throw new Error('INVALID_CLIENT_METADATA');
    const redirects = normalizeRedirects(
      args.redirectUris?.length ? args.redirectUris : CHATGPT_REDIRECT_URIS,
    );
    const method = args.tokenEndpointAuthMethod ?? 'client_secret_basic';
    const clientId = randomCode();
    const secret = randomSecret();
    await ctx.db.insert('mcpOAuthClients', {
      clientId,
      clientName: name,
      redirectUris: redirects,
      createdAt: Date.now(),
      registration: 'static',
      tokenEndpointAuthMethod: method,
      clientSecretHash: await hash(secret),
      ownerId: user._id,
    });
    return {
      clientId,
      clientSecret: secret,
      redirectUris: redirects,
      tokenEndpointAuthMethod: method,
    };
  },
});

export const listMyClients = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) return [];
    const clients = await ctx.db
      .query('mcpOAuthClients')
      .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
      .take(20);
    return clients.map((client) => ({
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUris: client.redirectUris,
      tokenEndpointAuthMethod: clientMethod(client),
      createdAt: client.createdAt,
    }));
  },
});

/** Deletes a dashboard client and revokes every connection made through it. */
export const deleteMyClient = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const client = isIssuedClientId(clientId) ? await findClient(ctx, clientId) : null;
    if (!client || client.ownerId !== user._id) throw new Error('CLIENT_NOT_FOUND');
    const grants = await ctx.db
      .query('mcpOAuthGrants')
      .withIndex('by_client', (index) => index.eq('clientId', clientId))
      .take(500);
    const now = Date.now();
    for (const grant of grants)
      if (grant.revokedAt === undefined) await ctx.db.patch(grant._id, { revokedAt: now });
    await ctx.db.delete(client._id);
    return { deleted: true };
  },
});

export const client = query({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    if (!isValidClientId(clientId)) return null;
    const record = await findClient(ctx, clientId);
    return record
      ? {
          clientId: record.clientId,
          clientName: record.clientName,
          redirectUris: record.redirectUris,
          registration: record.registration ?? 'dcr',
        }
      : null;
  },
});

/** For the CIMD resolver: the stored copy of a metadata-document client, if fresh enough. */
export const storedClient = internalQuery({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const record = await findClient(ctx, clientId);
    return record
      ? {
          clientId: record.clientId,
          clientName: record.clientName,
          redirectUris: record.redirectUris,
          registration: record.registration ?? 'dcr',
          tokenEndpointAuthMethod: clientMethod(record),
          jwksUri: record.jwksUri,
          metadataFetchedAt: record.metadataFetchedAt,
        }
      : null;
  },
});

/** Stores (or refreshes) a validated Client ID Metadata Document client. */
export const upsertMetadataClient = internalMutation({
  args: {
    clientId: v.string(),
    clientName: v.string(),
    redirectUris: v.array(v.string()),
    tokenEndpointAuthMethod: tokenAuthMethod,
    jwksUri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const redirects = normalizeRedirects(args.redirectUris);
    const now = Date.now();
    const fields = {
      clientName: args.clientName.slice(0, 128),
      redirectUris: redirects,
      registration: 'cimd' as const,
      tokenEndpointAuthMethod: args.tokenEndpointAuthMethod,
      jwksUri: args.jwksUri,
      metadataFetchedAt: now,
    };
    const existing = await findClient(ctx, args.clientId);
    if (existing) {
      if ((existing.registration ?? 'dcr') !== 'cimd') throw new Error('INVALID_CLIENT');
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert('mcpOAuthClients', {
        clientId: args.clientId,
        createdAt: now,
        ...fields,
      });
    }
    return null;
  },
});

export const createAuthorizationCode = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (
      !isValidClientId(args.clientId) ||
      args.redirectUri.length > 2048 ||
      !/^[A-Za-z0-9_-]{43}$/.test(args.codeChallenge)
    ) {
      throw new Error('INVALID_CLIENT');
    }
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const client = await findClient(ctx, args.clientId);
    if (!client || !client.redirectUris.includes(args.redirectUri))
      throw new Error('INVALID_CLIENT');
    if (
      args.scopes.length < 1 ||
      args.scopes.length > 5 ||
      !args.scopes.includes('finapp:read') ||
      args.scopes.some((scope) => !isAllowedScope(scope))
    ) {
      throw new Error('INVALID_SCOPE');
    }
    const code = randomCode();
    const now = Date.now();
    await ctx.db.insert('mcpOAuthCodes', {
      codeHash: await hash(code),
      clientId: args.clientId,
      userId: user._id,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      scopes: [...new Set(args.scopes)],
      expiresAt: now + 5 * 60_000,
      createdAt: now,
    });
    return code;
  },
});

/**
 * Authenticates the client at the token endpoint per its registered method. `assertionVerified`
 * is only ever true from the internal path, after the action verified a `private_key_jwt`
 * assertion (signature, issuer, audience, expiry, one-time jti).
 */
async function authenticateClient(
  ctx: MutationCtx,
  clientId: string,
  credentials: { clientSecret?: string; assertionVerified: boolean },
) {
  const client = await findClient(ctx, clientId);
  if (!client) throw new Error('INVALID_CLIENT');
  const method = clientMethod(client);
  if (method === 'private_key_jwt') {
    if (!credentials.assertionVerified) throw new Error('INVALID_CLIENT');
  } else if (isConfidentialSecretMethod(method)) {
    if (!credentials.clientSecret || !client.clientSecretHash) throw new Error('INVALID_CLIENT');
    if (!sameDigest(await hash(credentials.clientSecret), client.clientSecretHash))
      throw new Error('INVALID_CLIENT');
  } else if (credentials.clientSecret) {
    // A public client presenting a secret is misconfigured; fail closed.
    throw new Error('INVALID_CLIENT');
  }
  return client;
}

async function issueRefreshToken(ctx: MutationCtx, grantId: Doc<'mcpOAuthGrants'>['_id']) {
  const refreshToken = randomSecret();
  await ctx.db.patch(grantId, {
    refreshTokenHash: await hash(refreshToken),
    refreshExpiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });
  return refreshToken;
}

const exchangeArgs = {
  code: v.string(),
  clientId: v.string(),
  redirectUri: v.string(),
  codeVerifier: v.string(),
};

async function exchangeCode(
  ctx: MutationCtx,
  args: { code: string; clientId: string; redirectUri: string; codeVerifier: string },
  credentials: { clientSecret?: string; assertionVerified: boolean },
) {
  if (
    !/^[a-f\d]{64}$/.test(args.code) ||
    !isValidClientId(args.clientId) ||
    args.redirectUri.length > 2048 ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(args.codeVerifier)
  ) {
    throw new Error('INVALID_GRANT');
  }
  await authenticateClient(ctx, args.clientId, credentials);
  const codeHash = await hash(args.code);
  const code = await ctx.db
    .query('mcpOAuthCodes')
    .withIndex('by_code_hash', (index) => index.eq('codeHash', codeHash))
    .unique();
  if (
    !code ||
    code.consumedAt !== undefined ||
    code.expiresAt <= Date.now() ||
    code.clientId !== args.clientId ||
    code.redirectUri !== args.redirectUri
  ) {
    throw new Error('INVALID_GRANT');
  }
  const challenge = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(args.codeVerifier),
  );
  if (base64url(new Uint8Array(challenge)) !== code.codeChallenge) {
    throw new Error('INVALID_GRANT');
  }
  await ctx.db.patch(code._id, { consumedAt: Date.now() });
  const grantId = await ctx.db.insert('mcpOAuthGrants', {
    clientId: code.clientId,
    userId: code.userId,
    scopes: code.scopes,
    createdAt: Date.now(),
  });
  const refreshToken = await issueRefreshToken(ctx, grantId);
  const client = await findClient(ctx, code.clientId);
  await createNotification(
    ctx,
    code.userId,
    `mcp-connected:${String(grantId)}`,
    'security',
    'mcpConnection',
    String(grantId),
    'New app connected',
    `${client?.clientName ?? 'An AI app'} can now use your Finapp (${code.scopes.length} ${code.scopes.length === 1 ? 'permission' : 'permissions'}). Not you? Disconnect it in Settings → AI → MCP connections.`,
  );
  return { userId: code.userId, scopes: code.scopes, grantId, refreshToken };
}

/** Code exchange for public (`none`) and secret (`client_secret_*`) clients. */
export const exchangeAuthorizationCode = mutation({
  args: { ...exchangeArgs, clientSecret: v.optional(v.string()) },
  handler: async (ctx, { clientSecret, ...args }) =>
    exchangeCode(ctx, args, { clientSecret, assertionVerified: false }),
});

/** Code exchange after the action verified a `private_key_jwt` client assertion. */
export const exchangeAuthorizationCodeWithAssertion = internalMutation({
  args: { ...exchangeArgs, assertionJti: v.string(), assertionExpiresAt: v.number() },
  handler: async (ctx, { assertionJti, assertionExpiresAt, ...args }) => {
    await useAssertionJti(ctx, args.clientId, assertionJti, assertionExpiresAt);
    return exchangeCode(ctx, args, { assertionVerified: true });
  },
});

async function refreshGrant(
  ctx: MutationCtx,
  args: { refreshToken: string; clientId: string },
  credentials: { clientSecret?: string; assertionVerified: boolean },
) {
  if (!args.refreshToken || args.refreshToken.length > 256 || !isValidClientId(args.clientId))
    throw new Error('INVALID_GRANT');
  await authenticateClient(ctx, args.clientId, credentials);
  const refreshTokenHash = await hash(args.refreshToken);
  const grant = await ctx.db
    .query('mcpOAuthGrants')
    .withIndex('by_refresh_hash', (index) => index.eq('refreshTokenHash', refreshTokenHash))
    .unique();
  if (
    !grant ||
    grant.clientId !== args.clientId ||
    grant.revokedAt !== undefined ||
    (grant.refreshExpiresAt ?? 0) <= Date.now()
  )
    throw new Error('INVALID_GRANT');
  const user = await ctx.db.get(grant.userId);
  if (!user || user.deletedAt !== undefined) throw new Error('INVALID_GRANT');
  const refreshToken = await issueRefreshToken(ctx, grant._id);
  return { userId: grant.userId, scopes: grant.scopes, grantId: grant._id, refreshToken };
}

/** Refresh-token grant (rotating) for public and secret clients. */
export const refreshAccessGrant = mutation({
  args: { refreshToken: v.string(), clientId: v.string(), clientSecret: v.optional(v.string()) },
  handler: async (ctx, { clientSecret, ...args }) =>
    refreshGrant(ctx, args, { clientSecret, assertionVerified: false }),
});

export const refreshAccessGrantWithAssertion = internalMutation({
  args: {
    refreshToken: v.string(),
    clientId: v.string(),
    assertionJti: v.string(),
    assertionExpiresAt: v.number(),
  },
  handler: async (ctx, { assertionJti, assertionExpiresAt, ...args }) => {
    await useAssertionJti(ctx, args.clientId, assertionJti, assertionExpiresAt);
    return refreshGrant(ctx, args, { assertionVerified: true });
  },
});

/** Each client assertion is single-use (RFC 7523 §3, jti). */
async function useAssertionJti(ctx: MutationCtx, clientId: string, jti: string, expiresAt: number) {
  if (!jti || jti.length > 256) throw new Error('INVALID_CLIENT');
  const key = await hash(`${clientId}\n${jti}`);
  const seen = await ctx.db
    .query('mcpOAuthAssertionJtis')
    .withIndex('by_key', (index) => index.eq('key', key))
    .unique();
  if (seen) throw new Error('INVALID_CLIENT');
  await ctx.db.insert('mcpOAuthAssertionJtis', { key, expiresAt });
  // Opportunistic cleanup of a few expired entries.
  const expired = await ctx.db
    .query('mcpOAuthAssertionJtis')
    .withIndex('by_expiresAt', (index) => index.lt('expiresAt', Date.now()))
    .take(20);
  for (const row of expired) await ctx.db.delete(row._id);
}

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) return null;
    return { id: user._id, displayName: user.displayName ?? user.name ?? 'Finapp user' };
  },
});
export const listGrants = query({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) return [];
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const grants = await ctx.db
      .query('mcpOAuthGrants')
      .withIndex('by_user_createdAt', (index) => index.eq('userId', user._id))
      .order('desc')
      .take(safeLimit);
    return Promise.all(
      grants.map(async (grant) => {
        const client = await ctx.db
          .query('mcpOAuthClients')
          .withIndex('by_client_id', (index) => index.eq('clientId', grant.clientId))
          .unique();
        return {
          id: grant._id,
          clientName: client?.clientName ?? 'Removed MCP client',
          scopes: grant.scopes,
          createdAt: grant.createdAt,
          revokedAt: grant.revokedAt,
        };
      }),
    );
  },
});

export const activeGrant = query({
  args: { grantId: v.id('mcpOAuthGrants') },
  handler: async (ctx, { grantId }) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) return false;
    const grant = await ctx.db.get(grantId);
    return Boolean(grant && grant.userId === user._id && grant.revokedAt === undefined);
  },
});

export const revokeGrant = mutation({
  args: { grantId: v.id('mcpOAuthGrants') },
  handler: async (ctx, { grantId }) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const grant = await ctx.db.get(grantId);
    if (!grant || grant.userId !== user._id) throw new Error('GRANT_NOT_FOUND');
    if (grant.revokedAt === undefined) await ctx.db.patch(grantId, { revokedAt: Date.now() });
    return { revoked: true };
  },
});

export const recordToolInvocation = mutation({
  args: {
    grantId: v.id('mcpOAuthGrants'),
    toolName: v.string(),
    succeeded: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (
      !user ||
      user.deletedAt !== undefined ||
      !/^finapp\.[a-z0-9_]+(?:\.[a-z0-9_]+)*$/.test(args.toolName)
    ) {
      throw new Error('INVALID_ACTIVITY');
    }
    const grant = await ctx.db.get(args.grantId);
    if (!grant || grant.userId !== user._id || grant.revokedAt !== undefined) {
      throw new Error('GRANT_NOT_FOUND');
    }
    await ctx.db.insert('mcpOAuthActivity', {
      userId: user._id,
      grantId: args.grantId,
      toolName: args.toolName,
      succeeded: args.succeeded,
      createdAt: Date.now(),
    });
    const recent = await ctx.db
      .query('mcpOAuthActivity')
      .withIndex('by_user_createdAt', (index) => index.eq('userId', user._id))
      .order('desc')
      .take(101);
    const oldest = recent[100];
    if (oldest) await ctx.db.delete(oldest._id);
  },
});

export const listActivity = query({
  args: {
    limit: v.number(),
    domain: v.optional(
      v.union(
        v.literal('finance'),
        v.literal('social'),
        v.literal('groups'),
        v.literal('personal'),
      ),
    ),
    succeeded: v.optional(v.boolean()),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined)
      return { events: [], retained: 0, matching: 0, hasMore: false };
    const safeLimit = Math.max(1, Math.min(50, Math.floor(args.limit)));
    const recent = await ctx.db
      .query('mcpOAuthActivity')
      .withIndex('by_user_createdAt', (index) => index.eq('userId', user._id))
      .order('desc')
      .take(100);
    const filtered = recent.filter((event) => {
      const domain = event.toolName.split('.')[1];
      return (
        (!args.domain || domain === args.domain) &&
        (args.succeeded === undefined || event.succeeded === args.succeeded) &&
        (args.startAt === undefined || event.createdAt >= args.startAt) &&
        (args.endAt === undefined || event.createdAt < args.endAt)
      );
    });
    const events = await Promise.all(
      filtered.slice(0, safeLimit).map(async (event) => {
        const grant = await ctx.db.get(event.grantId);
        const client = grant
          ? await ctx.db
              .query('mcpOAuthClients')
              .withIndex('by_client_id', (index) => index.eq('clientId', grant.clientId))
              .unique()
          : null;
        return {
          id: event._id,
          toolName: event.toolName,
          succeeded: event.succeeded,
          createdAt: event.createdAt,
          clientName: client?.clientName ?? 'Removed MCP client',
        };
      }),
    );
    return {
      events,
      retained: recent.length,
      matching: filtered.length,
      hasMore: filtered.length > safeLimit,
    };
  },
});
