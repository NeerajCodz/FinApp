import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getOptionalUser, requireUser } from './shared/auth';

const allowedScopes: Record<string, true> = {
  'finapp:read': true,
  'finapp:write:finance': true,
  'finapp:write:social': true,
  'finapp:write:groups': true,
  'finapp:write:personal': true,
};

function base64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function isAllowedScope(scope: string): boolean {
  return Object.hasOwn(allowedScopes, scope);
}

function validRedirectUri(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const uri = new URL(value);
    return (
      !uri.username &&
      !uri.password &&
      (uri.protocol === 'https:' ||
        (uri.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname))) &&
      !uri.hash
    );
  } catch {
    return false;
  }
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const registerClient = mutation({
  args: { clientName: v.string(), redirectUris: v.array(v.string()) },
  handler: async (ctx, { clientName, redirectUris }) => {
    const name = clientName.trim();
    if (!name || name.length > 128 || redirectUris.length < 1 || redirectUris.length > 12) {
      throw new Error('INVALID_CLIENT_METADATA');
    }
    const redirects = [...new Set(redirectUris)];
    if (redirects.some((uri) => !validRedirectUri(uri))) throw new Error('INVALID_REDIRECT_URI');
    const clientId = randomCode();
    await ctx.db.insert('mcpOAuthClients', {
      clientId,
      clientName: name,
      redirectUris: redirects,
      createdAt: Date.now(),
    });
    return {
      client_id: clientId,
      client_name: name,
      redirect_uris: redirects,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    };
  },
});

export const client = query({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    if (!/^[a-f\d]{64}$/.test(clientId)) return null;
    const record = await ctx.db
      .query('mcpOAuthClients')
      .withIndex('by_client_id', (index) => index.eq('clientId', clientId))
      .unique();
    return record
      ? {
          clientId: record.clientId,
          clientName: record.clientName,
          redirectUris: record.redirectUris,
        }
      : null;
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
      !/^[a-f\d]{64}$/.test(args.clientId) ||
      args.redirectUri.length > 2048 ||
      !/^[A-Za-z0-9_-]{43}$/.test(args.codeChallenge)
    ) {
      throw new Error('INVALID_CLIENT');
    }
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const client = await ctx.db
      .query('mcpOAuthClients')
      .withIndex('by_client_id', (index) => index.eq('clientId', args.clientId))
      .unique();
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

export const exchangeAuthorizationCode = mutation({
  args: {
    code: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeVerifier: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      !/^[a-f\d]{64}$/.test(args.code) ||
      !/^[a-f\d]{64}$/.test(args.clientId) ||
      args.redirectUri.length > 2048 ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(args.codeVerifier)
    ) {
      throw new Error('INVALID_GRANT');
    }
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
    return { userId: code.userId, scopes: code.scopes, grantId };
  },
});

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
