/**
 * Third-party OAuth apps for the public API: registration (Settings → Developer), the
 * authorization-code + PKCE flow behind the shared /oauth/authorize and /oauth/token endpoints,
 * rotating refresh tokens with reuse detection, and connected-app management. Client secrets,
 * codes and tokens are stored only as SHA-256 digests.
 */
import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { getOptionalUser, requireUser } from '../shared/auth';
import { MAX_REDIRECT_URIS, validRedirectUri } from '../shared/mcpClients';
import { createNotification } from '../notifications/mutations';
import { recordAudit } from './audit';
import { isActiveUser, MAX_APPS_PER_USER } from './principal';
import { parseScopes, scopesOutside, type ApiScope } from './scopes';
import {
  APP_CLIENT_ID_PREFIX,
  base64url,
  constantTimeEqual,
  hashToken,
  isAppClientId,
  randomToken,
  tokenPrefix,
} from './tokens';

export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TOKEN_TTL_MS = 90 * 86_400_000;
const CODE_TTL_MS = 5 * 60_000;

function newClientId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `${APP_CLIENT_ID_PREFIX}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Errors from the token endpoint use OAuth error codes. */
function oauthError(
  code: 'invalid_client' | 'invalid_grant' | 'invalid_request' | 'invalid_scope',
): never {
  throw new Error(code.toUpperCase());
}

function httpsUrl(value: string | undefined, field: string) {
  if (value === undefined || value === '') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || value.length > 2048)
      throw new Error();
    return url.toString();
  } catch {
    throw new Error(`INVALID_${field}`);
  }
}

function cleanRedirects(uris: readonly string[]) {
  const unique = [...new Set(uris.map((uri) => uri.trim()).filter(Boolean))];
  if (!unique.length || unique.length > MAX_REDIRECT_URIS) throw new Error('INVALID_REDIRECT_URIS');
  if (unique.some((uri) => !validRedirectUri(uri))) throw new Error('INVALID_REDIRECT_URIS');
  return unique;
}

function cleanScopes(scopes: readonly string[]) {
  const parsed = parseScopes(scopes);
  if (!parsed.ok || !parsed.scopes.length) throw new Error('INVALID_SCOPE');
  return parsed.scopes;
}

function cleanText(value: string | undefined, max: number, error: string) {
  const text = value?.trim();
  if (text === undefined || text === '') return undefined;
  if (text.length > max) throw new Error(error);
  return text;
}

async function signedIn(ctx: MutationCtx) {
  const user = await requireUser(ctx);
  if (!isActiveUser(user)) throw new Error('AUTH_REQUIRED');
  return user;
}

async function appByClientId(ctx: QueryCtx, clientId: string) {
  if (!isAppClientId(clientId)) return null;
  return ctx.db
    .query('developerApps')
    .withIndex('by_client_id', (index) => index.eq('clientId', clientId))
    .unique();
}

async function ownedApp(ctx: MutationCtx, ownerId: Id<'users'>, appId: string) {
  const id = ctx.db.normalizeId('developerApps', appId);
  const app = id ? await ctx.db.get(id) : null;
  if (!app || app.ownerId !== ownerId) throw new Error('APP_NOT_FOUND');
  return app;
}

function presentApp(app: Doc<'developerApps'>) {
  return {
    id: app._id,
    clientId: app.clientId,
    name: app.name,
    description: app.description,
    logoUrl: app.logoUrl,
    homepageUrl: app.homepageUrl,
    redirectUris: app.redirectUris,
    scopes: app.scopes,
    clientType: app.clientType,
    clientSecretPrefix: app.clientSecretPrefix,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

// ---------- Developer: app registration ----------

export const listMyApps = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!isActiveUser(user)) return [];
    const apps = await ctx.db
      .query('developerApps')
      .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
      .take(MAX_APPS_PER_USER + 5);
    return Promise.all(
      apps.map(async (app) => {
        const grants = await ctx.db
          .query('developerAppGrants')
          .withIndex('by_app', (index) => index.eq('appId', app._id))
          .collect();
        return {
          ...presentApp(app),
          activeUsers: new Set(
            grants.filter((grant) => grant.revokedAt === undefined).map((grant) => grant.userId),
          ).size,
        };
      }),
    );
  },
});

export const createApp = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    homepageUrl: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    scopes: v.array(v.string()),
    clientType: v.union(v.literal('confidential'), v.literal('public')),
  },
  handler: async (ctx, args) => {
    const user = await signedIn(ctx);
    const existing = await ctx.db
      .query('developerApps')
      .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
      .take(MAX_APPS_PER_USER + 1);
    if (existing.length >= MAX_APPS_PER_USER) throw new Error('TOO_MANY_APPS');
    const name = cleanText(args.name, 80, 'INVALID_APP_NAME');
    if (!name) throw new Error('INVALID_APP_NAME');
    const now = Date.now();
    const clientSecret =
      args.clientType === 'confidential' ? randomToken('clientSecret') : undefined;
    const appId = await ctx.db.insert('developerApps', {
      ownerId: user._id,
      clientId: newClientId(),
      name,
      description: cleanText(args.description, 300, 'INVALID_APP_DESCRIPTION'),
      logoUrl: httpsUrl(args.logoUrl, 'LOGO_URL'),
      homepageUrl: httpsUrl(args.homepageUrl, 'HOMEPAGE_URL'),
      redirectUris: cleanRedirects(args.redirectUris),
      scopes: cleanScopes(args.scopes),
      clientType: args.clientType,
      ...(clientSecret
        ? {
            clientSecretHash: await hashToken(clientSecret),
            clientSecretPrefix: tokenPrefix(clientSecret),
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit(ctx, user._id, {
      kind: 'app.created',
      actorType: 'user',
      appId,
      label: name,
    });
    const app = (await ctx.db.get(appId))!;
    return { ...presentApp(app), clientSecret };
  },
});

export const updateApp = mutation({
  args: {
    appId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    homepageUrl: v.optional(v.string()),
    redirectUris: v.optional(v.array(v.string())),
    scopes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await signedIn(ctx);
    const app = await ownedApp(ctx, user._id, args.appId);
    const patch: Partial<Doc<'developerApps'>> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = cleanText(args.name, 80, 'INVALID_APP_NAME');
      if (!name) throw new Error('INVALID_APP_NAME');
      patch.name = name;
    }
    if (args.description !== undefined)
      patch.description = cleanText(args.description, 300, 'INVALID_APP_DESCRIPTION');
    if (args.logoUrl !== undefined) patch.logoUrl = httpsUrl(args.logoUrl, 'LOGO_URL');
    if (args.homepageUrl !== undefined)
      patch.homepageUrl = httpsUrl(args.homepageUrl, 'HOMEPAGE_URL');
    if (args.redirectUris !== undefined) patch.redirectUris = cleanRedirects(args.redirectUris);
    if (args.scopes !== undefined) {
      const scopes = cleanScopes(args.scopes);
      patch.scopes = scopes;
      // Narrowing an app's scopes narrows every existing authorization with it.
      const grants = await ctx.db
        .query('developerAppGrants')
        .withIndex('by_app', (index) => index.eq('appId', app._id))
        .collect();
      for (const grant of grants) {
        if (grant.revokedAt !== undefined) continue;
        const kept = grant.scopes.filter((scope) => scopes.includes(scope as ApiScope));
        if (kept.length !== grant.scopes.length) await ctx.db.patch(grant._id, { scopes: kept });
      }
    }
    await ctx.db.patch(app._id, patch);
    return presentApp((await ctx.db.get(app._id))!);
  },
});

export const rotateAppSecret = mutation({
  args: { appId: v.string() },
  handler: async (ctx, { appId }) => {
    const user = await signedIn(ctx);
    const app = await ownedApp(ctx, user._id, appId);
    if (app.clientType !== 'confidential') throw new Error('PUBLIC_CLIENT');
    const clientSecret = randomToken('clientSecret');
    await ctx.db.patch(app._id, {
      clientSecretHash: await hashToken(clientSecret),
      clientSecretPrefix: tokenPrefix(clientSecret),
      updatedAt: Date.now(),
    });
    await recordAudit(ctx, user._id, {
      kind: 'app.secret_rotated',
      actorType: 'user',
      appId: app._id,
      label: app.name,
    });
    return { clientSecret, clientSecretPrefix: tokenPrefix(clientSecret) };
  },
});

/** Deletes an app: every authorization, token and app-created webhook stops working. */
export const deleteApp = mutation({
  args: { appId: v.string() },
  handler: async (ctx, { appId }) => {
    const user = await signedIn(ctx);
    const app = await ownedApp(ctx, user._id, appId);
    const now = Date.now();
    const grants = await ctx.db
      .query('developerAppGrants')
      .withIndex('by_app', (index) => index.eq('appId', app._id))
      .collect();
    for (const grant of grants)
      if (grant.revokedAt === undefined)
        await ctx.db.patch(grant._id, {
          revokedAt: now,
          accessTokenHash: undefined,
          refreshTokenHash: undefined,
        });
    await ctx.db.delete(app._id);
    await recordAudit(ctx, user._id, { kind: 'app.deleted', actorType: 'user', label: app.name });
    return { deleted: true };
  },
});

// ---------- Users: connected apps ----------

export const listConnectedApps = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!isActiveUser(user)) return [];
    const grants = await ctx.db
      .query('developerAppGrants')
      .withIndex('by_user_createdAt', (index) => index.eq('userId', user._id))
      .order('desc')
      .take(100);
    const rows = await Promise.all(
      grants
        .filter((grant) => grant.revokedAt === undefined)
        .map(async (grant) => {
          const app = await ctx.db.get(grant.appId);
          return app
            ? {
                grantId: grant._id,
                appName: app.name,
                logoUrl: app.logoUrl,
                homepageUrl: app.homepageUrl,
                scopes: grant.scopes,
                createdAt: grant.createdAt,
                lastUsedAt: grant.lastUsedAt,
              }
            : null;
        }),
    );
    return rows.filter((row) => row !== null);
  },
});

export const revokeConnectedApp = mutation({
  args: { grantId: v.string() },
  handler: async (ctx, { grantId }) => {
    const user = await signedIn(ctx);
    const id = ctx.db.normalizeId('developerAppGrants', grantId);
    const grant = id ? await ctx.db.get(id) : null;
    if (!grant || grant.userId !== user._id) throw new Error('GRANT_NOT_FOUND');
    if (grant.revokedAt === undefined) {
      await ctx.db.patch(grant._id, {
        revokedAt: Date.now(),
        accessTokenHash: undefined,
        refreshTokenHash: undefined,
      });
      const app = await ctx.db.get(grant.appId);
      await recordAudit(ctx, user._id, {
        kind: 'app.revoked',
        actorType: 'user',
        appId: grant.appId,
        grantId: grant._id,
        label: app?.name,
      });
    }
    return { revoked: true };
  },
});

// ---------- OAuth: authorization ----------

/** Public details for the consent screen and the authorize endpoint. */
export const publicApp = query({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const app = await appByClientId(ctx, clientId);
    if (!app) return null;
    const owner = await ctx.db.get(app.ownerId);
    return {
      clientId: app.clientId,
      name: app.name,
      description: app.description,
      logoUrl: app.logoUrl,
      homepageUrl: app.homepageUrl,
      redirectUris: app.redirectUris,
      scopes: app.scopes,
      developer: owner?.username ? `@${owner.username}` : (owner?.displayName ?? 'A FinApp user'),
    };
  },
});

/** Called from the consent screen by the signed-in user who approved the request. */
export const authorize = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await signedIn(ctx);
    const app = await appByClientId(ctx, args.clientId);
    if (!app || !app.redirectUris.includes(args.redirectUri)) throw new Error('INVALID_CLIENT');
    if (!/^[A-Za-z0-9_-]{43}$/.test(args.codeChallenge)) throw new Error('INVALID_REQUEST');
    const scopes = cleanScopes(args.scopes);
    if (scopesOutside(scopes, app.scopes as ApiScope[]).length) throw new Error('INVALID_SCOPE');
    const code = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const now = Date.now();
    await ctx.db.insert('developerAppCodes', {
      codeHash: await hashToken(code),
      appId: app._id,
      userId: user._id,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      scopes,
      expiresAt: now + CODE_TTL_MS,
      createdAt: now,
    });
    return code;
  },
});

async function authenticateClient(ctx: MutationCtx, clientId: string, clientSecret?: string) {
  const app = await appByClientId(ctx, clientId);
  if (!app) oauthError('invalid_client');
  if (app.clientType === 'confidential') {
    if (!clientSecret || !app.clientSecretHash) oauthError('invalid_client');
    if (!constantTimeEqual(await hashToken(clientSecret), app.clientSecretHash))
      oauthError('invalid_client');
  } else if (clientSecret) {
    oauthError('invalid_client');
  }
  return app;
}

async function issueTokens(
  ctx: MutationCtx,
  grantId: Id<'developerAppGrants'>,
  rotatedFrom?: string,
) {
  const accessToken = randomToken('access');
  const refreshToken = randomToken('refresh');
  const now = Date.now();
  await ctx.db.patch(grantId, {
    accessTokenHash: await hashToken(accessToken),
    accessExpiresAt: now + ACCESS_TOKEN_TTL_SECONDS * 1000,
    refreshTokenHash: await hashToken(refreshToken),
    refreshExpiresAt: now + REFRESH_TOKEN_TTL_MS,
    ...(rotatedFrom ? { previousRefreshTokenHash: rotatedFrom } : {}),
  });
  const grant = (await ctx.db.get(grantId))!;
  return {
    access_token: accessToken,
    token_type: 'Bearer' as const,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: grant.scopes.join(' '),
  };
}

async function sha256Base64url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64url(new Uint8Array(digest));
}

/** Token endpoint, `authorization_code` grant (PKCE S256 required). */
export const exchangeCode = mutation({
  args: {
    clientId: v.string(),
    clientSecret: v.optional(v.string()),
    code: v.string(),
    redirectUri: v.string(),
    codeVerifier: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      args.code.length > 128 ||
      args.redirectUri.length > 2048 ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(args.codeVerifier)
    )
      oauthError('invalid_grant');
    const app = await authenticateClient(ctx, args.clientId, args.clientSecret);
    const codeHash = await hashToken(args.code);
    const code = await ctx.db
      .query('developerAppCodes')
      .withIndex('by_code_hash', (index) => index.eq('codeHash', codeHash))
      .unique();
    if (
      !code ||
      code.appId !== app._id ||
      code.consumedAt !== undefined ||
      code.expiresAt <= Date.now() ||
      code.redirectUri !== args.redirectUri ||
      !constantTimeEqual(await sha256Base64url(args.codeVerifier), code.codeChallenge)
    )
      oauthError('invalid_grant');
    await ctx.db.patch(code._id, { consumedAt: Date.now() });
    const user = await ctx.db.get(code.userId);
    if (!isActiveUser(user)) oauthError('invalid_grant');
    const grantId = await ctx.db.insert('developerAppGrants', {
      appId: app._id,
      userId: code.userId,
      scopes: code.scopes,
      createdAt: Date.now(),
    });
    await recordAudit(ctx, code.userId, {
      kind: 'app.authorized',
      actorType: 'user',
      appId: app._id,
      grantId,
      label: app.name,
    });
    await createNotification(
      ctx,
      code.userId,
      `api-app-connected:${String(grantId)}`,
      'security',
      'developerApp',
      String(grantId),
      'New app connected',
      `${app.name} can now use your FinApp (${code.scopes.length} ${code.scopes.length === 1 ? 'permission' : 'permissions'}). Not you? Disconnect it in Settings → Developer.`,
    );
    return issueTokens(ctx, grantId);
  },
});

/**
 * Token endpoint, `refresh_token` grant. Refresh tokens rotate on every use; presenting a
 * rotated-out token again revokes the whole authorization (token theft signal).
 */
export const refresh = mutation({
  args: { clientId: v.string(), clientSecret: v.optional(v.string()), refreshToken: v.string() },
  handler: async (ctx, args) => {
    if (args.refreshToken.length > 256) oauthError('invalid_grant');
    const app = await authenticateClient(ctx, args.clientId, args.clientSecret);
    const digest = await hashToken(args.refreshToken);
    const grant = await ctx.db
      .query('developerAppGrants')
      .withIndex('by_refresh_hash', (index) => index.eq('refreshTokenHash', digest))
      .unique();
    if (!grant) {
      const reused = await ctx.db
        .query('developerAppGrants')
        .withIndex('by_previous_refresh_hash', (index) =>
          index.eq('previousRefreshTokenHash', digest),
        )
        .unique();
      if (reused && reused.appId === app._id && reused.revokedAt === undefined) {
        await ctx.db.patch(reused._id, {
          revokedAt: Date.now(),
          accessTokenHash: undefined,
          refreshTokenHash: undefined,
        });
        await recordAudit(ctx, reused.userId, {
          kind: 'app.refresh_reuse_revoked',
          actorType: 'app',
          appId: app._id,
          grantId: reused._id,
          label: app.name,
        });
        // Returned (not thrown) so the revocation above is committed.
        return { error: 'invalid_grant' as const };
      }
      oauthError('invalid_grant');
    }
    if (
      grant.appId !== app._id ||
      grant.revokedAt !== undefined ||
      (grant.refreshExpiresAt ?? 0) <= Date.now()
    )
      oauthError('invalid_grant');
    const user = await ctx.db.get(grant.userId);
    if (!isActiveUser(user)) oauthError('invalid_grant');
    return issueTokens(ctx, grant._id, digest);
  },
});

/** RFC 7009 revocation: revoking either token ends the authorization. Always succeeds. */
export const revokeToken = mutation({
  args: { clientId: v.string(), clientSecret: v.optional(v.string()), token: v.string() },
  handler: async (ctx, args) => {
    const app = await authenticateClient(ctx, args.clientId, args.clientSecret);
    if (args.token.length > 256) return { revoked: false };
    const digest = await hashToken(args.token);
    const grant =
      (await ctx.db
        .query('developerAppGrants')
        .withIndex('by_access_hash', (index) => index.eq('accessTokenHash', digest))
        .unique()) ??
      (await ctx.db
        .query('developerAppGrants')
        .withIndex('by_refresh_hash', (index) => index.eq('refreshTokenHash', digest))
        .unique());
    if (grant && grant.appId === app._id && grant.revokedAt === undefined)
      await ctx.db.patch(grant._id, {
        revokedAt: Date.now(),
        accessTokenHash: undefined,
        refreshTokenHash: undefined,
      });
    return { revoked: true };
  },
});
