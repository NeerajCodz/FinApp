/**
 * Executes one API operation inside a single query or mutation. Writes check and store the
 * `Idempotency-Key` in the same transaction as the change, so a key applies its change once.
 */
import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';
import { actingAs, OPS, type OpResult, type Principal } from './ops';
import { routeById } from './routes';
import { CursorError } from './cursor';
import { sha256Hex } from './tokens';

export const IDEMPOTENCY_TTL_MS = 24 * 3_600_000;

const principalValidator = v.object({
  userId: v.id('users'),
  appId: v.optional(v.id('developerApps')),
  /** Stable credential key (`pat:<id>` or `grant:<id>`) for idempotency scoping. */
  key: v.string(),
});
const inputValidator = v.object({
  params: v.record(v.string(), v.string()),
  query: v.any(),
  body: v.any(),
});

export type ApiErrorData = { code: string; status: number; message: string };

const FORBIDDEN = new Set([
  'INSUFFICIENT_PERMISSION',
  'NOT_MEMBER',
  'NOT_OWNER',
  'NOT_ADMIN',
  'FORBIDDEN',
  'AUTH_REQUIRED',
  'GROUP_ARCHIVED',
]);
const CONFLICT = new Set(['DUPLICATE_MUTATION', 'TRANSACTION_CHANGED', 'VERSION_CONFLICT']);

/** Maps an error thrown by an operation or domain function to the API error shape. */
export function toApiError(error: unknown): ApiErrorData {
  if (error instanceof ConvexError) {
    const data = error.data as Partial<ApiErrorData> | string;
    if (data && typeof data === 'object' && typeof data.code === 'string')
      return {
        code: data.code,
        status: typeof data.status === 'number' ? data.status : 422,
        message: typeof data.message === 'string' ? data.message : data.code,
      };
  }
  if (error instanceof CursorError)
    return {
      code: 'invalid_cursor',
      status: 400,
      message: 'The cursor is malformed or was issued for different filters.',
    };
  const message = error instanceof Error ? error.message : '';
  const code = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|[A-Z]{4,})\b/.exec(message)?.[1];
  if (!code) return { code: 'internal_error', status: 500, message: 'Something went wrong.' };
  if (code.endsWith('NOT_FOUND') || code === 'NOT_FOUND')
    return { code: 'not_found', status: 404, message: 'Resource not found.' };
  if (FORBIDDEN.has(code))
    return {
      code: 'forbidden',
      status: 403,
      message: 'You do not have permission to do this, or the resource is not accessible.',
    };
  if (CONFLICT.has(code))
    return { code: code.toLowerCase(), status: 409, message: 'The resource changed; retry.' };
  return { code: code.toLowerCase(), status: 422, message: `The request was rejected: ${code}.` };
}

/** JSON with bigints as decimal strings, `_id` as `id`, and Convex system fields dropped. */
export function toJson(value: unknown): string {
  return JSON.stringify(present(value));
}

function present(value: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => present(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    if (key === '_creationTime' || item === undefined) continue;
    if (key === '_id') {
      if (!('id' in record)) out.id = present(item, depth + 1);
      continue;
    }
    out[key] = present(item, depth + 1);
  }
  return out;
}

export function envelope(result: OpResult): unknown {
  return result.kind === 'list'
    ? { data: result.data, hasMore: result.hasMore, nextCursor: result.nextCursor }
    : { data: result.data };
}

function redactSecrets(body: string): string {
  if (!body.includes('"secret"')) return body;
  const parsed = JSON.parse(body) as { data?: Record<string, unknown> };
  if (parsed.data && typeof parsed.data.secret === 'string')
    parsed.data = { ...parsed.data, secret: null, secretRedacted: true };
  return JSON.stringify(parsed);
}

function rethrow(error: unknown): never {
  throw new ConvexError(toApiError(error));
}

export const read = internalQuery({
  args: { principal: principalValidator, routeId: v.string(), input: inputValidator },
  handler: async (ctx, { principal, routeId, input }) => {
    const route = routeById(routeId);
    const op = OPS[routeId];
    if (!route || !op || route.kind !== 'query') throw new Error('UNKNOWN_ROUTE');
    try {
      const result = await op({
        ctx: actingAs(ctx, principal.userId),
        principal: principal as Principal,
        input,
        routeId,
        mutationId: '',
      });
      return { status: route.status ?? 200, body: toJson(envelope(result)) };
    } catch (error) {
      rethrow(error);
    }
  },
});

export const write = internalMutation({
  args: {
    principal: principalValidator,
    routeId: v.string(),
    input: inputValidator,
    idempotencyKey: v.optional(v.string()),
    requestHash: v.string(),
  },
  handler: async (ctx, { principal, routeId, input, idempotencyKey, requestHash }) => {
    const route = routeById(routeId);
    const op = OPS[routeId];
    if (!route || !op || route.kind !== 'mutation') throw new Error('UNKNOWN_ROUTE');
    if (idempotencyKey) {
      const stored = await ctx.db
        .query('apiIdempotencyKeys')
        .withIndex('by_principal_key', (index) =>
          index.eq('principal', principal.key).eq('key', idempotencyKey),
        )
        .unique();
      if (stored && stored.expiresAt > Date.now()) {
        if (stored.requestHash !== requestHash)
          throw new ConvexError({
            code: 'idempotency_key_reused',
            status: 422,
            message: 'This Idempotency-Key was already used with a different request.',
          });
        return { status: stored.status, body: stored.body, replayed: true };
      }
      if (stored) await ctx.db.delete(stored._id);
    }
    const mutationId = idempotencyKey
      ? `api-${(await sha256Hex(`${principal.key}\n${idempotencyKey}`)).slice(0, 32)}`
      : `api-${crypto.randomUUID()}`;
    let body: string;
    try {
      const result = await op({
        ctx: actingAs(ctx, principal.userId),
        principal: principal as Principal,
        input,
        routeId,
        mutationId,
      });
      body = toJson(envelope(result));
    } catch (error) {
      rethrow(error);
    }
    const status = route.status ?? 200;
    if (idempotencyKey) {
      const now = Date.now();
      await ctx.db.insert('apiIdempotencyKeys', {
        principal: principal.key,
        key: idempotencyKey,
        requestHash,
        status,
        // Secrets shown once (webhook signing secrets) are never stored for replays.
        body: redactSecrets(body),
        createdAt: now,
        expiresAt: now + IDEMPOTENCY_TTL_MS,
      });
    }
    return { status, body, replayed: false };
  },
});
