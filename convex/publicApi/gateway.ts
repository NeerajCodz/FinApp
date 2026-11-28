/**
 * HTTP gateway for /api/v1: CORS, routing, authentication (personal access tokens and OAuth app
 * tokens), scope checks, rate limiting, input validation, idempotency and the error envelope.
 * Tokens are hashed on arrival and never logged or stored in plaintext.
 */
import { ConvexError, v } from 'convex/values';
import type { HttpRouter } from 'convex/server';
import { z } from 'zod';
import { httpAction, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { recordAudit } from './audit';
import { isActiveUser } from './principal';
import { DEFAULT_BUCKET, takeToken } from './rateLimit';
import { API_BASE_PATH, API_REVISION, API_VERSION, matchRoute, type RouteDef } from './routes';
import { hasScope, isApiScope } from './scopes';
import { constantTimeEqual, hashIp, hashToken, sha256Hex, tokenKind } from './tokens';
import { buildOpenApiDocument } from './openapi';
import { toApiError, type ApiErrorData } from './exec';

const LAST_USED_WRITE_INTERVAL_MS = 60_000;
const MAX_BODY_BYTES = 256 * 1024;

type AuthResult =
  | {
      ok: true;
      principal: { userId: Id<'users'>; appId?: Id<'developerApps'>; key: string };
      audit: {
        actorType: 'pat' | 'app';
        tokenId?: Id<'personalAccessTokens'>;
        grantId?: Id<'developerAppGrants'>;
        appId?: Id<'developerApps'>;
        label: string;
      };
      rate: { limit: number; remaining: number; resetSeconds: number };
    }
  | {
      ok: false;
      error: ApiErrorData & { requiredScope?: string };
      rate?: { limit: number; remaining: number; resetSeconds: number; retryAfter: number };
    };

const unauthorized = (message: string): AuthResult => ({
  ok: false,
  error: { code: 'unauthorized', status: 401, message },
});

/**
 * Resolves a token digest to its owner, checks status and scope, and takes one token from the
 * credential's rate-limit bucket, all in one transaction.
 */
export const authorize = internalMutation({
  args: {
    kind: v.union(v.literal('pat'), v.literal('access')),
    tokenHash: v.string(),
    scope: v.string(),
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AuthResult> => {
    const now = Date.now();
    let userId: Id<'users'>;
    let scopes: string[];
    let bucketKey: string;
    let principal: Extract<AuthResult, { ok: true }>['principal'];
    let audit: Extract<AuthResult, { ok: true }>['audit'];
    let touch: () => Promise<void>;

    if (args.kind === 'pat') {
      const token = await ctx.db
        .query('personalAccessTokens')
        .withIndex('by_token_hash', (index) => index.eq('tokenHash', args.tokenHash))
        .unique();
      if (!token || !constantTimeEqual(token.tokenHash, args.tokenHash))
        return unauthorized('The access token is invalid.');
      if (token.revokedAt !== undefined) return unauthorized('The access token was revoked.');
      if (token.expiresAt !== undefined && token.expiresAt <= now)
        return unauthorized('The access token has expired.');
      userId = token.userId;
      scopes = token.scopes;
      bucketKey = `pat:${token._id}`;
      principal = { userId, key: bucketKey };
      audit = { actorType: 'pat', tokenId: token._id, label: token.name };
      touch = async () => {
        if (
          (token.lastUsedAt ?? 0) < now - LAST_USED_WRITE_INTERVAL_MS ||
          (args.ipHash && token.lastUsedIpHash !== args.ipHash)
        )
          await ctx.db.patch(token._id, {
            lastUsedAt: now,
            ...(args.ipHash ? { lastUsedIpHash: args.ipHash } : {}),
          });
      };
    } else {
      const grant = await ctx.db
        .query('developerAppGrants')
        .withIndex('by_access_hash', (index) => index.eq('accessTokenHash', args.tokenHash))
        .unique();
      if (!grant || !constantTimeEqual(grant.accessTokenHash ?? '', args.tokenHash))
        return unauthorized('The access token is invalid.');
      if (grant.revokedAt !== undefined) return unauthorized('This app was disconnected.');
      if ((grant.accessExpiresAt ?? 0) <= now)
        return unauthorized('The access token has expired; use the refresh token.');
      const app = await ctx.db.get(grant.appId);
      if (!app) return unauthorized('This app no longer exists.');
      userId = grant.userId;
      scopes = grant.scopes;
      bucketKey = `grant:${grant._id}`;
      principal = { userId, appId: app._id, key: bucketKey };
      audit = { actorType: 'app', grantId: grant._id, appId: app._id, label: app.name };
      touch = async () => {
        if (
          (grant.lastUsedAt ?? 0) < now - LAST_USED_WRITE_INTERVAL_MS ||
          (args.ipHash && grant.lastUsedIpHash !== args.ipHash)
        )
          await ctx.db.patch(grant._id, {
            lastUsedAt: now,
            ...(args.ipHash ? { lastUsedIpHash: args.ipHash } : {}),
          });
      };
    }

    const user = await ctx.db.get(userId);
    if (!isActiveUser(user)) return unauthorized('This account cannot use the API.');
    if (!isApiScope(args.scope) || !hasScope(scopes, args.scope))
      return {
        ok: false,
        error: {
          code: 'insufficient_scope',
          status: 403,
          message: `This token is missing the '${args.scope}' scope.`,
          requiredScope: args.scope,
        },
      };

    const bucket = await ctx.db
      .query('apiRateLimits')
      .withIndex('by_key', (index) => index.eq('key', bucketKey))
      .unique();
    const taken = takeToken(
      bucket ? { tokens: bucket.tokens, updatedAt: bucket.updatedAt } : null,
      now,
      DEFAULT_BUCKET,
    );
    if (bucket) await ctx.db.patch(bucket._id, taken.state);
    else await ctx.db.insert('apiRateLimits', { key: bucketKey, ...taken.state });
    const rate = {
      limit: taken.limit,
      remaining: taken.remaining,
      resetSeconds: taken.resetSeconds,
    };
    if (!taken.allowed) {
      await recordAudit(ctx, userId, {
        ...audit,
        kind: 'api.rate_limited',
        status: 429,
        ipHash: args.ipHash,
      });
      return {
        ok: false,
        error: { code: 'rate_limited', status: 429, message: 'Too many requests.' },
        rate: { ...rate, retryAfter: taken.retryAfterSeconds },
      };
    }
    await touch();
    return { ok: true, principal, audit, rate };
  },
});

// ---------- HTTP ----------

const CORS_HEADERS: Record<string, string> = {
  // Bearer tokens only (no cookies), so any origin may call the API from a browser.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
  'Access-Control-Expose-Headers':
    'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, Idempotent-Replayed, FinApp-Api-Version',
  'Access-Control-Max-Age': '86400',
};

function newRequestId() {
  return `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

function respond(
  requestId: string,
  status: number,
  body: string | null,
  extra: Record<string, string> = {},
) {
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      'X-Request-Id': requestId,
      'FinApp-Api-Version': `${API_VERSION}; revision=${API_REVISION}`,
      'Cache-Control': 'no-store',
      ...(body === null ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
      ...extra,
    },
  });
}

function errorResponse(
  requestId: string,
  error: ApiErrorData & { details?: unknown; requiredScope?: string },
  extra: Record<string, string> = {},
) {
  return respond(
    requestId,
    error.status,
    JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.details ? { details: error.details } : {}),
        ...(error.requiredScope ? { requiredScope: error.requiredScope } : {}),
      },
    }),
    extra,
  );
}

function rateHeaders(rate: { limit: number; remaining: number; resetSeconds: number }) {
  return {
    'X-RateLimit-Limit': String(rate.limit),
    'X-RateLimit-Remaining': String(rate.remaining),
    'X-RateLimit-Reset': String(rate.resetSeconds),
  };
}

function zodDetails(error: z.ZodError, location: string) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: [location, ...issue.path.map(String)].join('.'),
    message: issue.message,
  }));
}

/** Validates path, query and body against the route's schemas. */
async function readInput(request: Request, route: RouteDef, params: Record<string, string>) {
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) query[key] = value;
  let body: unknown = {};
  if (route.body) {
    const type = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (type !== 'application/json')
      return {
        error: {
          code: 'unsupported_media_type',
          status: 415,
          message: 'Send the request body as application/json.',
        },
      };
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES)
      return { error: { code: 'payload_too_large', status: 413, message: 'Body too large.' } };
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return { error: { code: 'invalid_json', status: 400, message: 'Malformed JSON body.' } };
    }
  }
  const parsedParams = (route.params ?? z.object({})).safeParse(params);
  const parsedQuery = (route.query ?? z.object({})).safeParse(query);
  const parsedBody = (route.body ?? z.object({})).safeParse(body);
  const details = [
    ...(parsedParams.success ? [] : zodDetails(parsedParams.error, 'path')),
    ...(parsedQuery.success ? [] : zodDetails(parsedQuery.error, 'query')),
    ...(parsedBody.success ? [] : zodDetails(parsedBody.error, 'body')),
  ];
  if (details.length || !parsedParams.success || !parsedQuery.success || !parsedBody.success)
    return {
      error: {
        code: 'invalid_request',
        status: 400,
        message: 'The request failed validation.',
        details,
      },
    };
  // Unknown query parameters are rejected so typos don't silently widen a listing.
  const known = new Set(Object.keys(route.query?.shape ?? {}));
  const unknown = Object.keys(query).filter((key) => !known.has(key));
  if (unknown.length)
    return {
      error: {
        code: 'invalid_request',
        status: 400,
        message: `Unknown query parameter(s): ${unknown.join(', ')}.`,
      },
    };
  return {
    input: {
      params: parsedParams.data as Record<string, string>,
      query: parsedQuery.data as Record<string, unknown>,
      body: parsedBody.data as Record<string, unknown>,
    },
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === 'bigint') return item.toString();
    if (item && typeof item === 'object' && !Array.isArray(item))
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
      );
    return item;
  });
}

/** Removes `undefined` (not a Convex value) while keeping bigints. */
function convexSafe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convexSafe);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, convexSafe(item)]),
  );
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  );
}

let openApiCache: string | null = null;
function openApiJson() {
  openApiCache ??= JSON.stringify(
    buildOpenApiDocument({
      apiOrigin: process.env.PUBLIC_API_URL?.trim() || process.env.CONVEX_SITE_URL,
      authOrigin: process.env.MCP_ISSUER_URL?.trim() || process.env.CONVEX_SITE_URL,
    }),
  );
  return openApiCache;
}

export const handle = httpAction(async (ctx, request) => {
  const requestId = newRequestId();
  if (request.method === 'OPTIONS') return respond(requestId, 204, null);
  const url = new URL(request.url);
  const path = url.pathname.startsWith(API_BASE_PATH)
    ? url.pathname.slice(API_BASE_PATH.length) || '/'
    : url.pathname;
  const match = matchRoute(request.method, path);
  if (!match)
    return errorResponse(requestId, {
      code: 'not_found',
      status: 404,
      message: `No route for ${request.method} ${API_BASE_PATH}${path}.`,
    });
  if ('allowed' in match)
    return errorResponse(
      requestId,
      { code: 'method_not_allowed', status: 405, message: 'Method not allowed.' },
      { Allow: [...new Set(match.allowed)].join(', ') },
    );
  const { route, params } = match;

  if (route.kind === 'meta') {
    if (route.id === 'getOpenApi')
      return respond(requestId, 200, openApiJson(), { 'Cache-Control': 'public, max-age=300' });
    return respond(
      requestId,
      200,
      JSON.stringify({
        version: API_VERSION,
        revision: API_REVISION,
        openapi: `${API_BASE_PATH}/openapi.json`,
      }),
    );
  }

  // Authentication: the token is only ever hashed here.
  const header = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? '';
  const kind = tokenKind(token);
  if (!token || (kind !== 'pat' && kind !== 'access'))
    return errorResponse(
      requestId,
      {
        code: 'unauthorized',
        status: 401,
        message: 'Send a personal access token or OAuth access token as `Authorization: Bearer …`.',
      },
      { 'WWW-Authenticate': 'Bearer realm="finapp"' },
    );
  const ipHash =
    (await hashIp(clientIp(request), process.env.PUBLIC_API_IP_SALT?.trim())) ?? undefined;
  const auth = await ctx.runMutation(internal.publicApi.gateway.authorize, {
    kind,
    tokenHash: await hashToken(token),
    scope: route.scope!,
    ...(ipHash ? { ipHash } : {}),
  });
  if (!auth.ok) {
    const extra: Record<string, string> = auth.rate
      ? { ...rateHeaders(auth.rate), 'Retry-After': String(auth.rate.retryAfter) }
      : {};
    if (auth.error.status === 401)
      extra['WWW-Authenticate'] = 'Bearer realm="finapp", error="invalid_token"';
    if (auth.error.status === 403)
      extra['WWW-Authenticate'] =
        `Bearer realm="finapp", error="insufficient_scope", scope="${auth.error.requiredScope}"`;
    return errorResponse(requestId, auth.error, extra);
  }
  const limits = rateHeaders(auth.rate);
  const finish = async (response: Response) => {
    await ctx.scheduler.runAfter(0, internal.publicApi.audit.recordRequest, {
      userId: auth.principal.userId,
      ...auth.audit,
      method: request.method,
      route: route.path,
      status: response.status,
      ...(ipHash ? { ipHash } : {}),
    });
    return response;
  };

  const parsed = await readInput(request, route, params);
  if ('error' in parsed) return finish(errorResponse(requestId, parsed.error!, limits));

  const idempotencyKey = request.headers.get('idempotency-key') ?? undefined;
  if (idempotencyKey !== undefined && !/^[\x21-\x7e]{1,255}$/.test(idempotencyKey))
    return finish(
      errorResponse(
        requestId,
        {
          code: 'invalid_request',
          status: 400,
          message: 'Idempotency-Key must be 1-255 printable ASCII characters.',
        },
        limits,
      ),
    );

  try {
    const input = convexSafe(parsed.input) as {
      params: Record<string, string>;
      query: Record<string, unknown>;
      body: Record<string, unknown>;
    };
    if (route.kind === 'query') {
      const result = await ctx.runQuery(internal.publicApi.exec.read, {
        principal: auth.principal,
        routeId: route.id,
        input,
      });
      return finish(respond(requestId, result.status, result.body, limits));
    }
    const result = await ctx.runMutation(internal.publicApi.exec.write, {
      principal: auth.principal,
      routeId: route.id,
      input,
      ...(idempotencyKey && route.method === 'POST' ? { idempotencyKey } : {}),
      requestHash: await sha256Hex(`${route.id}\n${stableStringify(input)}`),
    });
    return finish(
      respond(requestId, result.status, result.body, {
        ...limits,
        ...(result.replayed ? { 'Idempotent-Replayed': 'true' } : {}),
      }),
    );
  } catch (error) {
    const data =
      error instanceof ConvexError
        ? toApiError(error)
        : { code: 'internal_error', status: 500, message: 'Something went wrong.' };
    return finish(errorResponse(requestId, data, limits));
  }
});

/** Registers /api/v1/* on the Convex HTTP router. */
export function registerPublicApi(http: HttpRouter) {
  for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] as const) {
    http.route({ pathPrefix: `${API_BASE_PATH}/`, method, handler: handle });
  }
  http.route({ path: API_BASE_PATH, method: 'GET', handler: handle });
}
