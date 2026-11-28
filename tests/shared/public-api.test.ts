import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  hasScope,
  normalizeScopes,
  parseScopes,
  scopesOutside,
} from '../../convex/publicApi/scopes';
import {
  constantTimeEqual,
  hashIp,
  hashToken,
  randomToken,
  resolveExpiry,
  tokenKind,
  tokenPrefix,
} from '../../convex/publicApi/tokens';
import { refill, takeToken } from '../../convex/publicApi/rateLimit';
import {
  CursorError,
  decodeConvexCursor,
  decodeOffsetCursor,
  encodeConvexCursor,
  filterFingerprint,
  pageOfList,
} from '../../convex/publicApi/cursor';
import {
  checkWebhookUrl,
  classifyResponse,
  deriveWebhookSecret,
  retryDelay,
  signatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../../convex/publicApi/webhookSigning';
import { eventForSyncChange, eventScope } from '../../convex/publicApi/webhookEvents';
import { matchRoute, ROUTES } from '../../convex/publicApi/routes';
import { buildOpenApiDocument } from '../../convex/publicApi/openapi';

describe('scopes', () => {
  it('parses space or comma separated scopes into canonical order', () => {
    expect(parseScopes('transactions:write, accounts:read transactions:write')).toEqual({
      ok: true,
      scopes: ['accounts:read', 'transactions:write'],
    });
  });
  it('rejects unknown scopes instead of dropping them', () => {
    expect(parseScopes(['accounts:read', 'accounts:admin', 'finapp:read'])).toEqual({
      ok: false,
      invalid: ['accounts:admin', 'finapp:read'],
    });
  });
  it('write implies read for the same resource only', () => {
    expect(hasScope(['transactions:write'], 'transactions:read')).toBe(true);
    expect(hasScope(['transactions:read'], 'transactions:write')).toBe(false);
    expect(hasScope(['transactions:write'], 'accounts:read')).toBe(false);
    expect(hasScope([], 'profile:read')).toBe(false);
    expect(hasScope(['webhooks:manage'], 'webhooks:manage')).toBe(true);
  });
  it('finds scopes an app may not request', () => {
    expect(scopesOutside(['accounts:read', 'goals:write'], ['accounts:write'])).toEqual([
      'goals:write',
    ]);
    expect(normalizeScopes(['goals:read', 'accounts:read', 'goals:read'])).toEqual([
      'accounts:read',
      'goals:read',
    ]);
  });
});

describe('tokens', () => {
  it('generates prefixed 256-bit tokens and recognises their kind', () => {
    const pat = randomToken('pat');
    expect(pat).toMatch(/^fa_pat_[A-Za-z0-9_-]{43}$/);
    expect(tokenKind(pat)).toBe('pat');
    expect(tokenKind(randomToken('access'))).toBe('access');
    expect(tokenKind('fa_pat_short')).toBeNull();
    expect(tokenKind(`Bearer ${pat}`)).toBeNull();
    expect(randomToken('pat')).not.toBe(pat);
    expect(tokenPrefix(pat)).toBe(pat.slice(0, 11));
  });
  it('hashes with SHA-256 hex and compares in constant time', async () => {
    const digest = await hashToken('fa_pat_example');
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashToken('fa_pat_example')).toBe(digest);
    expect(constantTimeEqual(digest, digest)).toBe(true);
    expect(constantTimeEqual(digest, digest.replace(/.$/, '0'))).toBe(digest.endsWith('0'));
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
  it('fingerprints IPs only with a salt', async () => {
    expect(await hashIp('203.0.113.5', undefined)).toBeNull();
    const one = await hashIp('203.0.113.5', 'salt-a');
    expect(one).toHaveLength(32);
    expect(await hashIp('203.0.113.5', 'salt-b')).not.toBe(one);
  });
  it('resolves expiry presets and bounds custom dates', () => {
    const now = 1_700_000_000_000;
    expect(resolveExpiry({ preset: 'never' }, now)).toBeUndefined();
    expect(resolveExpiry({ preset: '30d' }, now)).toBe(now + 30 * 86_400_000);
    expect(() => resolveExpiry({ customAt: now + 1000 }, now)).toThrow('INVALID_EXPIRY');
    expect(() => resolveExpiry({ customAt: now + 400 * 86_400_000 }, now)).toThrow();
    expect(resolveExpiry({ customAt: now + 10 * 86_400_000 }, now)).toBe(now + 10 * 86_400_000);
  });
});

describe('rate limiter', () => {
  const config = { capacity: 3, refillPerSecond: 1 };
  it('allows a burst up to capacity then rejects with Retry-After', () => {
    let state = null as ReturnType<typeof takeToken>['state'] | null;
    for (let index = 0; index < 3; index += 1) {
      const result = takeToken(state, 0, config);
      expect(result.allowed).toBe(true);
      state = result.state;
    }
    const blocked = takeToken(state, 0, config);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
  });
  it('refills over time without exceeding capacity', () => {
    expect(refill({ tokens: 0, updatedAt: 0 }, 1500, config).tokens).toBe(1.5);
    expect(refill({ tokens: 2, updatedAt: 0 }, 60_000, config).tokens).toBe(3);
    const after = takeToken({ tokens: 0, updatedAt: 0 }, 1000, config);
    expect(after.allowed).toBe(true);
    expect(after.resetSeconds).toBe(3);
  });
  it('ignores clock skew backwards', () => {
    expect(refill({ tokens: 1, updatedAt: 5000 }, 1000, config)).toEqual({
      tokens: 1,
      updatedAt: 5000,
    });
  });
});

describe('pagination cursors', () => {
  const fp = filterFingerprint({ route: 'listTransactions', type: 'expense', limit: 10 });
  it('round-trips and binds to filters (limit and cursor excluded)', () => {
    expect(filterFingerprint({ route: 'listTransactions', type: 'expense', cursor: 'x' })).toBe(fp);
    const cursor = encodeConvexCursor('convex-cursor-123', fp);
    expect(decodeConvexCursor(cursor, fp)).toBe('convex-cursor-123');
    expect(decodeConvexCursor(undefined, fp)).toBeNull();
    const other = filterFingerprint({ route: 'listTransactions', type: 'income' });
    expect(() => decodeConvexCursor(cursor, other)).toThrow(CursorError);
    expect(() => decodeConvexCursor('not a cursor!', fp)).toThrow(CursorError);
    expect(() => decodeOffsetCursor(cursor, fp)).toThrow(CursorError);
  });
  it('pages bounded lists by offset', () => {
    const rows = Array.from({ length: 5 }, (_, index) => index);
    const first = pageOfList(rows, 0, 2, fp);
    expect(first).toMatchObject({ data: [0, 1], hasMore: true });
    const second = pageOfList(rows, decodeOffsetCursor(first.nextCursor!, fp), 2, fp);
    expect(second.data).toEqual([2, 3]);
    const last = pageOfList(rows, 4, 2, fp);
    expect(last).toEqual({ data: [4], hasMore: false, nextCursor: null });
  });
});

describe('webhook signing', () => {
  it('signs `<t>.<body>` with HMAC-SHA256 (matches Node crypto)', async () => {
    const body = '{"id":"evt_1"}';
    const expected = createHmac('sha256', 'whsec_test').update(`1700000000.${body}`).digest('hex');
    expect(await signWebhookPayload('whsec_test', 1700000000, body)).toBe(expected);
    expect(await signatureHeader(['whsec_test'], 1700000000, body)).toBe(
      `t=1700000000,v1=${expected}`,
    );
  });
  it('verifies any signature during rotation and enforces the timestamp tolerance', async () => {
    const header = await signatureHeader(['new', 'old'], 1000, 'payload');
    expect(await verifyWebhookSignature('old', header, 'payload', 1100)).toBe(true);
    expect(await verifyWebhookSignature('new', header, 'payload', 1100)).toBe(true);
    expect(await verifyWebhookSignature('other', header, 'payload', 1100)).toBe(false);
    expect(await verifyWebhookSignature('new', header, 'tampered', 1100)).toBe(false);
    expect(await verifyWebhookSignature('new', header, 'payload', 2000)).toBe(false);
  });
  it('derives stable secrets from the master key, endpoint and salt', async () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const one = await deriveWebhookSecret(key, 'endpoint1', 'salt');
    expect(one).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    expect(await deriveWebhookSecret(key, 'endpoint1', 'salt')).toBe(one);
    expect(await deriveWebhookSecret(key, 'endpoint1', 'salt2')).not.toBe(one);
    await expect(deriveWebhookSecret(undefined, 'endpoint1', 'salt')).rejects.toThrow(
      'WEBHOOKS_NOT_CONFIGURED',
    );
  });
  it('blocks private, local and non-HTTPS targets (SSRF)', () => {
    for (const url of [
      'http://example.com/hook',
      'https://localhost/hook',
      'https://api.localhost/hook',
      'https://127.0.0.1/hook',
      'https://2130706433/hook',
      'https://0x7f000001/hook',
      'https://10.1.2.3/hook',
      'https://172.20.0.1/hook',
      'https://192.168.1.1/hook',
      'https://169.254.169.254/latest/meta-data',
      'https://100.64.0.1/hook',
      'https://[::1]/hook',
      'https://[fd00::1]/hook',
      'https://[::ffff:10.0.0.1]/hook',
      'https://user:pass@example.com/hook',
      'https://intranet/hook',
      'https://service.internal/hook',
      'https://example.com:22/hook',
    ])
      expect(checkWebhookUrl(url).ok, url).toBe(false);
    expect(checkWebhookUrl('https://hooks.example.com/finapp#x')).toEqual({
      ok: true,
      url: 'https://hooks.example.com/finapp',
    });
    expect(checkWebhookUrl('https://8.8.8.8:8443/hook').ok).toBe(true);
  });
  it('retries with growing backoff, then gives up', () => {
    expect(retryDelay(1, 0.5)).toBe(60_000);
    expect(retryDelay(2, 0.5)).toBe(300_000);
    expect(retryDelay(5, 0.5)).toBe(6 * 3_600_000);
    expect(retryDelay(6, 0.5)).toBeNull();
    expect(classifyResponse(204)).toBe('success');
    expect(classifyResponse(410)).toBe('gone');
    expect(classifyResponse(500)).toBe('retry');
    expect(classifyResponse(301)).toBe('retry');
  });
  it('classifies sync changes as events', () => {
    expect(
      eventForSyncChange('transactions', { createdAt: 10, updatedAt: 10 }, 10, undefined),
    ).toBe('transaction.created');
    expect(eventForSyncChange('transactions', { createdAt: 10 }, 50_000, undefined)).toBe(
      'transaction.updated',
    );
    expect(eventForSyncChange('transactions', { deletedAt: 9 }, 50_000, undefined)).toBe(
      'transaction.deleted',
    );
    expect(eventForSyncChange('accounts', undefined, 1, 1)).toBe('account.deleted');
    expect(eventForSyncChange('settlements', { createdAt: 1 }, 1, undefined)).toBe(
      'settlement.created',
    );
    expect(eventForSyncChange('userSettings', {}, 1, undefined)).toBeNull();
    expect(eventForSyncChange('groups', {}, 1, 1)).toBeNull();
    expect(eventScope('settlement.created')).toBe('splits:read');
    expect(eventScope('budget.exceeded')).toBe('budgets:read');
  });
});

describe('routes and OpenAPI', () => {
  it('matches paths, extracts params and reports allowed methods', () => {
    const match = matchRoute('GET', '/accounts/abc123');
    expect(match && 'route' in match && match.route.id).toBe('getAccount');
    expect(match && 'route' in match && match.params).toEqual({ accountId: 'abc123' });
    expect(matchRoute('GET', '/accounts/')).toMatchObject({ route: { id: 'listAccounts' } });
    expect(matchRoute('PUT', '/accounts')).toEqual({ allowed: ['GET', 'POST'] });
    expect(matchRoute('GET', '/nope')).toBeNull();
  });
  it('requires a scope on every non-meta route and has unique operations', () => {
    const ids = new Set<string>();
    for (const route of ROUTES) {
      expect(ids.has(route.id), route.id).toBe(false);
      ids.add(route.id);
      if (route.kind !== 'meta') expect(route.scope, route.id).toBeTruthy();
      if (route.method !== 'GET') expect(route.kind, route.id).toBe('mutation');
    }
  });
  it('generates a valid OpenAPI 3.1 document covering every route', () => {
    const doc = buildOpenApiDocument({ apiOrigin: 'https://x.convex.site' });
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers[0]!.url).toBe('https://x.convex.site/api/v1');
    for (const route of ROUTES) {
      const operation = doc.paths[route.path]?.[route.method.toLowerCase()] as {
        operationId: string;
        parameters: { name?: string; in?: string }[];
        security: unknown[];
      };
      expect(operation?.operationId).toBe(route.id);
      for (const name of route.path.match(/\{(\w+)\}/g) ?? [])
        expect(operation.parameters.some((param) => `{${param.name}}` === name)).toBe(true);
      expect(operation.security.length > 0).toBe(route.scope !== null);
    }
    const create = doc.paths['/transactions']!.post as {
      requestBody: {
        content: {
          'application/json': { schema: { properties: Record<string, { type?: string }> } };
        };
      };
      parameters: { $ref?: string }[];
    };
    expect(create.requestBody.content['application/json'].schema.properties.amountMinor!.type).toBe(
      'string',
    );
    expect(create.parameters).toContainEqual({ $ref: '#/components/parameters/IdempotencyKey' });
    expect(
      Object.keys(doc.components.securitySchemes.oauth2.flows.authorizationCode.scopes),
    ).toContain('webhooks:manage');
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});
