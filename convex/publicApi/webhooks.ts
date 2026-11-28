/**
 * Webhooks: endpoint management (settings UI and API), event emission from domain writes, and
 * signed delivery with retries. Delivery logs keep status codes and timings only.
 */
import { ConvexError, v } from 'convex/values';
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server';
import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import { getOptionalUser, requireUser } from '../shared/auth';
import { recordAudit } from './audit';
import { isActiveUser, MAX_WEBHOOKS_PER_USER } from './principal';
import { hasScope } from './scopes';
import {
  eventForSyncChange,
  eventScope,
  isWebhookEventType,
  type WebhookEventType,
} from './webhookEvents';
import {
  checkWebhookUrl,
  classifyResponse,
  deriveWebhookSecret,
  DISABLE_AFTER_CONSECUTIVE_FAILURES,
  randomSalt,
  retryDelay,
  signatureHeader,
} from './webhookSigning';
import { base64url } from './tokens';

const ROTATION_GRACE_MS = 24 * 3_600_000;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const DELIVERY_TIMEOUT_MS = 10_000;

/** Errors thrown here surface through the API with these codes. */
function fail(code: string, status: number, message: string): never {
  throw new ConvexError({ code, status, message });
}

function masterKey() {
  return process.env.WEBHOOK_SECRET_KEY;
}

export function presentEndpoint(endpoint: Doc<'webhookEndpoints'>) {
  return {
    id: endpoint._id,
    url: endpoint.url,
    description: endpoint.description,
    events: endpoint.events,
    enabled: endpoint.enabled,
    secretPrefix: endpoint.secretPrefix,
    consecutiveFailures: endpoint.consecutiveFailures,
    disabledReason: endpoint.disabledReason,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}

function validEvents(events: readonly string[]) {
  const unique = [...new Set(events)];
  if (!unique.length || unique.some((event) => !isWebhookEventType(event)))
    fail('invalid_request', 400, 'Unknown or missing webhook event types.');
  return unique;
}

function validUrl(raw: string) {
  const checked = checkWebhookUrl(raw);
  if (!checked.ok)
    fail(
      'invalid_webhook_url',
      400,
      checked.reason === 'HTTPS_REQUIRED'
        ? 'Webhook URLs must use HTTPS.'
        : checked.reason === 'PRIVATE_ADDRESS'
          ? 'Webhook URLs must point to a public host, not a private or local address.'
          : 'This webhook URL is not allowed.',
    );
  return checked.url;
}

async function secretFor(endpointId: string, salt: string) {
  try {
    return await deriveWebhookSecret(masterKey(), endpointId, salt);
  } catch {
    fail('webhooks_unavailable', 503, 'Webhooks are not configured on this server.');
  }
}

export type WebhookOwner = { userId: Id<'users'>; appId?: Id<'developerApps'> };

/** Endpoints visible to this owner: apps see only their own; the user sees all of theirs. */
export async function listEndpointsFor(ctx: QueryCtx, owner: WebhookOwner) {
  const rows = await ctx.db
    .query('webhookEndpoints')
    .withIndex('by_user', (index) => index.eq('userId', owner.userId))
    .collect();
  return rows.filter((row) => !owner.appId || row.appId === owner.appId);
}

export async function endpointFor(ctx: QueryCtx, owner: WebhookOwner, endpointId: string) {
  const id = ctx.db.normalizeId('webhookEndpoints', endpointId);
  const endpoint = id ? await ctx.db.get(id) : null;
  if (
    !endpoint ||
    endpoint.userId !== owner.userId ||
    (owner.appId !== undefined && endpoint.appId !== owner.appId)
  )
    fail('not_found', 404, 'Webhook endpoint not found.');
  return endpoint;
}

export async function createEndpoint(
  ctx: MutationCtx,
  owner: WebhookOwner,
  input: { url: string; events: readonly string[]; description?: string },
) {
  const url = validUrl(input.url);
  const events = validEvents(input.events);
  const existing = await listEndpointsFor(ctx, { userId: owner.userId });
  if (existing.length >= MAX_WEBHOOKS_PER_USER)
    fail('limit_reached', 409, `You can have at most ${MAX_WEBHOOKS_PER_USER} webhook endpoints.`);
  const salt = randomSalt();
  const now = Date.now();
  const description = input.description?.trim().slice(0, 200) || undefined;
  const id = await ctx.db.insert('webhookEndpoints', {
    userId: owner.userId,
    ...(owner.appId ? { appId: owner.appId } : {}),
    url,
    ...(description ? { description } : {}),
    events,
    enabled: true,
    secretSalt: salt,
    secretPrefix: 'whsec_',
    consecutiveFailures: 0,
    createdAt: now,
    updatedAt: now,
  });
  const secret = await secretFor(id, salt);
  await ctx.db.patch(id, { secretPrefix: secret.slice(0, 10) });
  await recordAudit(ctx, owner.userId, {
    kind: 'webhook.created',
    actorType: owner.appId ? 'app' : 'user',
    appId: owner.appId,
    label: new URL(url).host,
  });
  return { ...presentEndpoint((await ctx.db.get(id))!), secret };
}

export async function updateEndpoint(
  ctx: MutationCtx,
  owner: WebhookOwner,
  endpointId: string,
  patch: {
    url?: string;
    events?: readonly string[];
    description?: string | null;
    enabled?: boolean;
  },
) {
  const endpoint = await endpointFor(ctx, owner, endpointId);
  const next: Partial<Doc<'webhookEndpoints'>> = { updatedAt: Date.now() };
  if (patch.url !== undefined) next.url = validUrl(patch.url);
  if (patch.events !== undefined) next.events = validEvents(patch.events);
  if (patch.description !== undefined)
    next.description = patch.description?.trim().slice(0, 200) || undefined;
  if (patch.enabled !== undefined) {
    next.enabled = patch.enabled;
    if (patch.enabled) {
      next.consecutiveFailures = 0;
      next.disabledReason = undefined;
    }
  }
  await ctx.db.patch(endpoint._id, next);
  return presentEndpoint((await ctx.db.get(endpoint._id))!);
}

export async function deleteEndpoint(ctx: MutationCtx, owner: WebhookOwner, endpointId: string) {
  const endpoint = await endpointFor(ctx, owner, endpointId);
  await ctx.db.delete(endpoint._id);
  await recordAudit(ctx, owner.userId, {
    kind: 'webhook.deleted',
    actorType: owner.appId ? 'app' : 'user',
    appId: owner.appId,
    label: new URL(endpoint.url).host,
  });
  return { id: endpoint._id, deleted: true as const };
}

export async function rotateEndpointSecret(
  ctx: MutationCtx,
  owner: WebhookOwner,
  endpointId: string,
) {
  const endpoint = await endpointFor(ctx, owner, endpointId);
  const salt = randomSalt();
  const secret = await secretFor(endpoint._id, salt);
  await ctx.db.patch(endpoint._id, {
    secretSalt: salt,
    secretPrefix: secret.slice(0, 10),
    previousSecretSalt: endpoint.secretSalt,
    previousSecretExpiresAt: Date.now() + ROTATION_GRACE_MS,
    updatedAt: Date.now(),
  });
  await recordAudit(ctx, owner.userId, {
    kind: 'webhook.secret_rotated',
    actorType: owner.appId ? 'app' : 'user',
    appId: owner.appId,
    label: new URL(endpoint.url).host,
  });
  return { ...presentEndpoint((await ctx.db.get(endpoint._id))!), secret };
}

export async function listDeliveriesFor(
  ctx: QueryCtx,
  owner: WebhookOwner,
  endpointId: string,
  take: number,
) {
  const endpoint = await endpointFor(ctx, owner, endpointId);
  const rows = await ctx.db
    .query('webhookDeliveries')
    .withIndex('by_endpoint_createdAt', (index) => index.eq('endpointId', endpoint._id))
    .order('desc')
    .take(take);
  return rows.map((row) => ({
    id: row._id,
    eventId: row.eventId,
    eventType: row.eventType,
    attempt: row.attempt,
    status: row.status,
    responseStatus: row.responseStatus,
    durationMs: row.durationMs,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
  }));
}

// ---------- Emission ----------

/** JSON-safe copy without secrets; bigints become decimal strings. */
export function sanitizeForPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => sanitizeForPayload(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      /(?:identity|password|token|secret|verification|session|hash)/i.test(key) ||
      key === '_creationTime'
        ? []
        : [[key === '_id' ? 'id' : key, sanitizeForPayload(item, depth + 1)]],
    ),
  );
}

async function appMayReceive(
  ctx: MutationCtx,
  endpoint: Doc<'webhookEndpoints'>,
  type: WebhookEventType,
) {
  if (!endpoint.appId) return true;
  const scope = eventScope(type);
  const grants = await ctx.db
    .query('developerAppGrants')
    .withIndex('by_app', (index) => index.eq('appId', endpoint.appId!))
    .collect();
  return grants.some(
    (grant) =>
      grant.userId === endpoint.userId &&
      grant.revokedAt === undefined &&
      (type === 'ping' || !scope || hasScope(grant.scopes, scope)),
  );
}

/**
 * Queues an event for every enabled endpoint of the user subscribed to it. A no-op (one indexed
 * read) for users without webhooks.
 */
export async function emitWebhookEvent(
  ctx: MutationCtx,
  userId: Id<'users'>,
  type: WebhookEventType,
  data: Record<string, unknown>,
  onlyEndpointId?: Id<'webhookEndpoints'>,
) {
  const endpoints = await ctx.db
    .query('webhookEndpoints')
    .withIndex('by_user', (index) => index.eq('userId', userId))
    .collect();
  const targets = [];
  for (const endpoint of endpoints) {
    if (onlyEndpointId ? endpoint._id !== onlyEndpointId : !endpoint.enabled) continue;
    if (type !== 'ping' && !endpoint.events.includes(type)) continue;
    if (!(await appMayReceive(ctx, endpoint, type))) continue;
    targets.push(endpoint);
  }
  if (!targets.length) return null;
  const now = Date.now();
  const publicId = `evt_${base64url(crypto.getRandomValues(new Uint8Array(16)))}`;
  let payload = JSON.stringify({
    id: publicId,
    type,
    apiVersion: 'v1',
    createdAt: now,
    data: sanitizeForPayload(data),
  });
  if (payload.length > MAX_PAYLOAD_BYTES)
    payload = JSON.stringify({
      id: publicId,
      type,
      apiVersion: 'v1',
      createdAt: now,
      data: { id: data.id, truncated: true },
    });
  const eventId = await ctx.db.insert('webhookEvents', { userId, type, payload, createdAt: now });
  for (const endpoint of targets) {
    const deliveryId = await ctx.db.insert('webhookDeliveries', {
      endpointId: endpoint._id,
      eventId,
      userId,
      eventType: type,
      attempt: 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.publicApi.webhooks.deliver, { deliveryId });
  }
  return eventId;
}

/** Called from `recordSyncChange` for every synced write. */
export async function emitForSyncChange(
  ctx: MutationCtx,
  userId: Id<'users'>,
  entityType: string,
  documentId: string,
  updatedAt: number,
  document: unknown,
  deletedAt: number | undefined,
) {
  const type = eventForSyncChange(entityType, document, updatedAt, deletedAt);
  if (!type) return;
  await emitWebhookEvent(ctx, userId, type, {
    id: documentId,
    object: deletedAt !== undefined ? undefined : document,
  });
}

// ---------- Delivery ----------

export const deliveryContext = internalQuery({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get(deliveryId);
    if (!delivery || delivery.status !== 'pending') return null;
    const [endpoint, event] = await Promise.all([
      ctx.db.get(delivery.endpointId),
      ctx.db.get(delivery.eventId),
    ]);
    const user = await ctx.db.get(delivery.userId);
    if (!endpoint || !event || !isActiveUser(user)) return null;
    if (!endpoint.enabled && event.type !== 'ping') return null;
    return {
      endpointId: endpoint._id,
      url: endpoint.url,
      salts: [
        endpoint.secretSalt,
        ...(endpoint.previousSecretSalt && (endpoint.previousSecretExpiresAt ?? 0) > Date.now()
          ? [endpoint.previousSecretSalt]
          : []),
      ],
      payload: event.payload,
      eventType: event.type,
      publicEventId: (JSON.parse(event.payload) as { id: string }).id,
      attempt: delivery.attempt,
    };
  },
});

export const deliver = internalAction({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: async (ctx, { deliveryId }) => {
    const context = await ctx.runQuery(internal.publicApi.webhooks.deliveryContext, {
      deliveryId,
    });
    if (!context) {
      await ctx.runMutation(internal.publicApi.webhooks.recordDelivery, {
        deliveryId,
        outcome: 'skipped',
      });
      return;
    }
    const checked = checkWebhookUrl(context.url);
    if (!checked.ok) {
      await ctx.runMutation(internal.publicApi.webhooks.recordDelivery, {
        deliveryId,
        outcome: 'retry',
        errorCode: 'blocked_url',
      });
      return;
    }
    let secrets: string[];
    try {
      secrets = await Promise.all(
        context.salts.map((salt) =>
          deriveWebhookSecret(process.env.WEBHOOK_SECRET_KEY, context.endpointId, salt),
        ),
      );
    } catch {
      await ctx.runMutation(internal.publicApi.webhooks.recordDelivery, {
        deliveryId,
        outcome: 'retry',
        errorCode: 'not_configured',
      });
      return;
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    let status: number | undefined;
    let errorCode: string | undefined;
    try {
      const response = await fetch(checked.url, {
        method: 'POST',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FinApp-Webhooks/1.0',
          'FinApp-Event-Id': context.publicEventId,
          'FinApp-Event-Type': context.eventType,
          'FinApp-Delivery-Attempt': String(context.attempt),
          'FinApp-Signature': await signatureHeader(secrets, timestamp, context.payload),
        },
        body: context.payload,
      });
      status = response.status;
      await response.body?.cancel().catch(() => undefined);
    } catch (cause) {
      errorCode =
        cause instanceof Error && cause.name === 'AbortError' ? 'timeout' : 'network_error';
    } finally {
      clearTimeout(timer);
    }
    const kind = status === undefined ? 'retry' : classifyResponse(status);
    await ctx.runMutation(internal.publicApi.webhooks.recordDelivery, {
      deliveryId,
      outcome: kind === 'success' ? 'success' : kind === 'gone' ? 'gone' : 'retry',
      responseStatus: status,
      durationMs: Date.now() - started,
      errorCode,
    });
  },
});

export const recordDelivery = internalMutation({
  args: {
    deliveryId: v.id('webhookDeliveries'),
    outcome: v.union(
      v.literal('success'),
      v.literal('retry'),
      v.literal('gone'),
      v.literal('skipped'),
    ),
    responseStatus: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.status !== 'pending') return;
    const now = Date.now();
    const endpoint = await ctx.db.get(delivery.endpointId);
    const result = {
      responseStatus: args.responseStatus,
      durationMs: args.durationMs,
      errorCode: args.errorCode,
      updatedAt: now,
    };
    if (args.outcome === 'skipped') {
      await ctx.db.patch(delivery._id, { ...result, status: 'failed', errorCode: 'skipped' });
      return;
    }
    if (args.outcome === 'success') {
      await ctx.db.patch(delivery._id, { ...result, status: 'succeeded' });
      if (endpoint && endpoint.consecutiveFailures !== 0)
        await ctx.db.patch(endpoint._id, { consecutiveFailures: 0 });
      return;
    }
    const delay = args.outcome === 'gone' ? null : retryDelay(delivery.attempt);
    if (delay !== null && endpoint?.enabled) {
      await ctx.db.patch(delivery._id, {
        ...result,
        status: 'retrying',
        nextAttemptAt: now + delay,
      });
      const nextId = await ctx.db.insert('webhookDeliveries', {
        endpointId: delivery.endpointId,
        eventId: delivery.eventId,
        userId: delivery.userId,
        eventType: delivery.eventType,
        attempt: delivery.attempt + 1,
        status: 'pending',
        createdAt: now + delay,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(delay, internal.publicApi.webhooks.deliver, {
        deliveryId: nextId,
      });
      return;
    }
    await ctx.db.patch(delivery._id, { ...result, status: 'failed' });
    if (!endpoint || delivery.eventType === 'ping') return;
    const failures = endpoint.consecutiveFailures + 1;
    const disable = args.outcome === 'gone' || failures >= DISABLE_AFTER_CONSECUTIVE_FAILURES;
    await ctx.db.patch(endpoint._id, {
      consecutiveFailures: failures,
      ...(disable
        ? {
            enabled: false,
            disabledReason: args.outcome === 'gone' ? 'endpoint_gone' : 'too_many_failures',
          }
        : {}),
    });
    if (disable && endpoint.enabled)
      await recordAudit(ctx, endpoint.userId, {
        kind: 'webhook.disabled',
        actorType: 'user',
        appId: endpoint.appId,
        label: new URL(endpoint.url).host,
      });
  },
});

// ---------- Settings UI ----------

async function signedInOwner(ctx: MutationCtx): Promise<WebhookOwner> {
  const user = await requireUser(ctx);
  if (!isActiveUser(user)) throw new Error('AUTH_REQUIRED');
  return { userId: user._id };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!isActiveUser(user)) return [];
    const endpoints = await listEndpointsFor(ctx, { userId: user._id });
    return Promise.all(
      endpoints.map(async (endpoint) => {
        const app = endpoint.appId ? await ctx.db.get(endpoint.appId) : null;
        return {
          ...presentEndpoint(endpoint),
          appName: app?.name,
          deliveries: await listDeliveriesFor(ctx, { userId: user._id }, endpoint._id, 10),
        };
      }),
    );
  },
});

export const create = mutation({
  args: { url: v.string(), events: v.array(v.string()), description: v.optional(v.string()) },
  handler: async (ctx, args) => createEndpoint(ctx, await signedInOwner(ctx), args),
});

export const update = mutation({
  args: {
    endpointId: v.string(),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    description: v.optional(v.union(v.string(), v.null())),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { endpointId, ...patch }) =>
    updateEndpoint(ctx, await signedInOwner(ctx), endpointId, patch),
});

export const remove = mutation({
  args: { endpointId: v.string() },
  handler: async (ctx, { endpointId }) => deleteEndpoint(ctx, await signedInOwner(ctx), endpointId),
});

export const rotateSecret = mutation({
  args: { endpointId: v.string() },
  handler: async (ctx, { endpointId }) =>
    rotateEndpointSecret(ctx, await signedInOwner(ctx), endpointId),
});

export const sendTest = mutation({
  args: { endpointId: v.string() },
  handler: async (ctx, { endpointId }) => {
    const owner = await signedInOwner(ctx);
    const endpoint = await endpointFor(ctx, owner, endpointId);
    const eventId = await emitWebhookEvent(
      ctx,
      owner.userId,
      'ping',
      { message: 'Test event from FinApp' },
      endpoint._id,
    );
    return { eventId };
  },
});
