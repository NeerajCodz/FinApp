import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');
const BASE = '/api/v1';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  process.env.WEBHOOK_SECRET_KEY = Buffer.alloc(32, 3).toString('base64');
  process.env.PUBLIC_API_IP_SALT = 'test-salt';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.WEBHOOK_SECRET_KEY;
  delete process.env.PUBLIC_API_IP_SALT;
});

async function setup(subject = 'api-user') {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert('users', {
      identityId: subject,
      email: `${subject}@example.com`,
      emailVerificationTime: 1,
      displayName: subject,
      username: subject.replace(/-/g, '_'),
      defaultCurrency: 'INR',
      timezone: 'Asia/Kolkata',
    }),
  );
  const user = t.withIdentity({ subject, email: `${subject}@example.com`, name: subject });
  const pat = async (scopes: string[]) =>
    (await user.mutation(api.pats.mutations.create, {
      name: 'CI',
      scopes,
      expiry: { preset: '30d' },
    })) as { id: string; token: string };
  const call = async (
    token: string | null,
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await t.fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-Forwarded-For': '203.0.113.9',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, json: text ? JSON.parse(text) : null };
  };
  return { t, userId, user, pat, call };
}

const ALL = [
  'profile:read',
  'accounts:write',
  'transactions:write',
  'categories:write',
  'webhooks:manage',
];

describe('personal access tokens and the gateway', () => {
  it('stores only a digest and authenticates by bearer token', async () => {
    const { t, pat, call, userId } = await setup();
    const { token, id } = await pat(['profile:read']);
    expect(token).toMatch(/^fa_pat_/);
    const stored = await t.run(async (ctx) => ctx.db.get(id as never));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect((stored as { tokenHash: string }).tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );

    const me = await call(token, 'GET', '/me');
    expect(me.status).toBe(200);
    expect(me.json.data.id).toBe(userId);
    expect(me.headers.get('x-request-id')).toMatch(/^req_/);
    expect(me.headers.get('x-ratelimit-limit')).toBe('120');
    expect(me.headers.get('access-control-allow-origin')).toBe('*');
    const used = await t.run(async (ctx) => ctx.db.get(id as never));
    expect((used as { lastUsedAt?: number }).lastUsedAt).toBeTypeOf('number');
    expect((used as { lastUsedIpHash?: string }).lastUsedIpHash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('rejects missing, malformed, revoked and under-scoped tokens', async () => {
    const { user, pat, call } = await setup();
    expect((await call(null, 'GET', '/me')).status).toBe(401);
    expect((await call('fa_pat_nope', 'GET', '/me')).json.error.code).toBe('unauthorized');
    const { token, id } = await pat(['accounts:read']);
    const denied = await call(token, 'GET', '/me');
    expect(denied.status).toBe(403);
    expect(denied.json.error).toMatchObject({
      code: 'insufficient_scope',
      requiredScope: 'profile:read',
    });
    expect((await call(token, 'GET', '/accounts')).status).toBe(200);
    await user.mutation(api.pats.mutations.revoke, { tokenId: id });
    expect((await call(token, 'GET', '/accounts')).status).toBe(401);
  });

  it('stops working for deleted users and caps active tokens', async () => {
    const { t, userId, pat, call } = await setup();
    const { token } = await pat(['profile:read']);
    await t.run((ctx) => ctx.db.patch(userId, { deletedAt: Date.now() }));
    expect((await call(token, 'GET', '/me')).status).toBe(401);
  });

  it('regenerates a token: the old value stops working', async () => {
    const { user, pat, call } = await setup();
    const { token, id } = await pat(['profile:read']);
    const next = (await user.mutation(api.pats.mutations.regenerate, { tokenId: id })) as {
      token: string;
    };
    expect((await call(token, 'GET', '/me')).status).toBe(401);
    expect((await call(next.token, 'GET', '/me')).status).toBe(200);
  });

  it('rate limits per token with 429 and Retry-After', async () => {
    const { t, pat, call } = await setup();
    const { token, id } = await pat(['profile:read']);
    await t.run((ctx) =>
      ctx.db.insert('apiRateLimits', { key: `pat:${id}`, tokens: 0, updatedAt: Date.now() }),
    );
    const limited = await call(token, 'GET', '/me');
    expect(limited.status).toBe(429);
    expect(limited.json.error.code).toBe('rate_limited');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(limited.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('validates input with a consistent error shape', async () => {
    const { pat, call } = await setup();
    const { token } = await pat(ALL);
    const bad = await call(token, 'POST', '/accounts', { name: '', type: 'piggybank' });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe('invalid_request');
    expect(bad.json.error.requestId).toMatch(/^req_/);
    expect(bad.json.error.details.length).toBeGreaterThan(0);
    expect((await call(token, 'GET', '/accounts?bogus=1')).status).toBe(400);
    expect((await call(token, 'GET', '/accounts/not-an-id')).status).toBe(404);
    expect((await call(token, 'PUT', '/accounts')).status).toBe(405);
    expect((await call(token, 'GET', '/unknown')).status).toBe(404);
    const preflight = await call(null, 'OPTIONS', '/accounts');
    expect(preflight.status).toBe(204);
  });

  it('creates resources through the domain functions with Idempotency-Key replay', async () => {
    const { t, pat, call } = await setup();
    const { token } = await pat(ALL);
    const body = {
      name: 'Wallet',
      type: 'cash',
      currency: 'inr',
      openingBalanceMinor: '10000',
    };
    const first = await call(token, 'POST', '/accounts', body, { 'Idempotency-Key': 'acc-1' });
    expect(first.status).toBe(201);
    const accountId = first.json.data.id;
    const replay = await call(token, 'POST', '/accounts', body, { 'Idempotency-Key': 'acc-1' });
    expect(replay.status).toBe(201);
    expect(replay.json.data.id).toBe(accountId);
    expect(replay.headers.get('idempotent-replayed')).toBe('true');
    const mismatch = await call(
      token,
      'POST',
      '/accounts',
      { ...body, name: 'Other' },
      { 'Idempotency-Key': 'acc-1' },
    );
    expect(mismatch.status).toBe(422);
    expect(mismatch.json.error.code).toBe('idempotency_key_reused');
    const accounts = await t.run((ctx) => ctx.db.query('accounts').collect());
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.currency).toBe('INR');

    const category = await call(token, 'POST', '/categories', { name: 'Coffee', kind: 'expense' });
    expect(category.status).toBe(201);
    const now = Date.now();
    for (let index = 0; index < 3; index += 1) {
      const created = await call(token, 'POST', '/transactions', {
        accountId,
        type: 'expense',
        amountMinor: String(1000 + index),
        currency: 'INR',
        title: `Coffee ${index}`,
        categoryId: category.json.data.id,
        occurredAt: now - index * 1000,
      });
      expect(created.status).toBe(201);
    }
    const page1 = await call(token, 'GET', '/transactions?limit=2');
    expect(page1.status).toBe(200);
    expect(page1.json.data).toHaveLength(2);
    expect(page1.json.data[0].amountMinor).toBe('1000');
    expect(page1.json.hasMore).toBe(true);
    const page2 = await call(
      token,
      'GET',
      `/transactions?limit=2&cursor=${encodeURIComponent(page1.json.nextCursor)}`,
    );
    expect(page2.json.data).toHaveLength(1);
    expect(page2.json.hasMore).toBe(false);
    const foreign = await call(
      token,
      'GET',
      `/transactions?limit=2&type=income&cursor=${encodeURIComponent(page1.json.nextCursor)}`,
    );
    expect(foreign.status).toBe(400);
    expect(foreign.json.error.code).toBe('invalid_cursor');

    const txId = page1.json.data[0].id;
    const patched = await call(token, 'PATCH', `/transactions/${txId}`, { title: 'Flat white' });
    expect(patched.status).toBe(200);
    const fetched = await call(token, 'GET', `/transactions/${txId}`);
    expect(fetched.json.data.title).toBe('Flat white');
    expect((await call(token, 'DELETE', `/transactions/${txId}`)).json.data.deleted).toBe(true);
  });

  it('never bypasses ownership: another user’s account is not found', async () => {
    const owner = await setup('owner-user');
    const { token } = await owner.pat(ALL);
    const created = await owner.call(token, 'POST', '/accounts', {
      name: 'Mine',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: '0',
    });
    const otherId = await owner.t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: 'intruder',
        email: 'i@example.com',
        emailVerificationTime: 1,
        displayName: 'i',
      }),
    );
    const intruder = owner.t.withIdentity({ subject: 'intruder' });
    const other = (await intruder.mutation(api.pats.mutations.create, {
      name: 'x',
      scopes: ['accounts:write'],
      expiry: { preset: 'never' },
    })) as { token: string };
    expect(otherId).toBeTruthy();
    const read = await owner.call(other.token, 'GET', `/accounts/${created.json.data.id}`);
    expect(read.status).toBe(404);
    const write = await owner.call(other.token, 'PATCH', `/accounts/${created.json.data.id}`, {
      name: 'Stolen',
    });
    expect(write.status).toBe(404);
  });

  it('serves the OpenAPI document without authentication', async () => {
    const { call } = await setup();
    const doc = await call(null, 'GET', '/openapi.json');
    expect(doc.status).toBe(200);
    expect(doc.json.openapi).toBe('3.1.0');
    expect(doc.json.paths['/transactions'].get.operationId).toBe('listTransactions');
  });
});

describe('webhooks', () => {
  it('rejects private targets and delivers signed events with a delivery log', async () => {
    const { t, pat, call } = await setup();
    const { token } = await pat(ALL);
    const blocked = await call(token, 'POST', '/webhooks', {
      url: 'https://169.254.169.254/hook',
      events: ['transaction.created'],
    });
    expect(blocked.status).toBe(400);
    expect(blocked.json.error.code).toBe('invalid_webhook_url');

    const created = await call(token, 'POST', '/webhooks', {
      url: 'https://hooks.example.com/finapp',
      events: ['transaction.created'],
    });
    expect(created.status).toBe(201);
    const secret: string = created.json.data.secret;
    expect(secret).toMatch(/^whsec_/);
    const stored = await t.run((ctx) => ctx.db.query('webhookEndpoints').collect());
    expect(JSON.stringify(stored)).not.toContain(secret);

    const calls: { headers: Record<string, string>; body: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push({ headers: init.headers as Record<string, string>, body: String(init.body) });
        return new Response(null, { status: 204 });
      }),
    );
    const account = await call(token, 'POST', '/accounts', {
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: '0',
    });
    await call(token, 'POST', '/transactions', {
      accountId: account.json.data.id,
      type: 'expense',
      amountMinor: '2500',
      currency: 'INR',
      title: 'Lunch',
      occurredAt: Date.now(),
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(calls).toHaveLength(1);
    const delivery = calls[0]!;
    expect(delivery.headers['FinApp-Event-Type']).toBe('transaction.created');
    const payload = JSON.parse(delivery.body);
    expect(payload).toMatchObject({ type: 'transaction.created', apiVersion: 'v1' });
    expect(payload.data.object.amountMinor).toBe('2500');
    const [timestamp, signature] = delivery.headers['FinApp-Signature']!.split(',');
    const t0 = timestamp!.slice(2);
    expect(signature).toBe(
      `v1=${createHmac('sha256', secret).update(`${t0}.${delivery.body}`).digest('hex')}`,
    );
    const log = await call(token, 'GET', `/webhooks/${created.json.data.id}/deliveries`);
    expect(log.json.data[0]).toMatchObject({ status: 'succeeded', responseStatus: 204 });
    expect(JSON.stringify(log.json)).not.toContain('Lunch');
  });

  it('retries failures and disables an endpoint that returns 410', async () => {
    const { t, pat, call } = await setup();
    const { token } = await pat(ALL);
    const created = await call(token, 'POST', '/webhooks', {
      url: 'https://hooks.example.com/gone',
      events: ['account.created'],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 410 })),
    );
    await call(token, 'POST', '/accounts', {
      name: 'Cash',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: '0',
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const endpoint = await call(token, 'GET', `/webhooks/${created.json.data.id}`);
    expect(endpoint.json.data).toMatchObject({ enabled: false, disabledReason: 'endpoint_gone' });
  });
});

describe('OAuth apps', () => {
  const redirectUri = 'https://app.example.com/callback';
  const verifier = 'v'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  it('runs code + PKCE, scopes the token, rotates refresh tokens and revokes on reuse', async () => {
    const { t, user, call } = await setup('app-user');
    const app = (await user.mutation(api.publicApi.oauthApps.createApp, {
      name: 'Budget sync',
      redirectUris: [redirectUri],
      scopes: ['profile:read', 'transactions:read'],
      clientType: 'confidential',
    })) as { clientId: string; clientSecret: string };
    expect(app.clientId).toMatch(/^fa_app_/);
    await expect(
      user.mutation(api.publicApi.oauthApps.authorize, {
        clientId: app.clientId,
        redirectUri,
        codeChallenge: challenge,
        scopes: ['accounts:write'],
      }),
    ).rejects.toThrow('INVALID_SCOPE');
    const code = await user.mutation(api.publicApi.oauthApps.authorize, {
      clientId: app.clientId,
      redirectUri,
      codeChallenge: challenge,
      scopes: ['profile:read'],
    });
    await expect(
      t.mutation(api.publicApi.oauthApps.exchangeCode, {
        clientId: app.clientId,
        clientSecret: 'fa_cs_wrong',
        code,
        redirectUri,
        codeVerifier: verifier,
      }),
    ).rejects.toThrow('INVALID_CLIENT');
    await expect(
      t.mutation(api.publicApi.oauthApps.exchangeCode, {
        clientId: app.clientId,
        clientSecret: app.clientSecret,
        code,
        redirectUri,
        codeVerifier: 'w'.repeat(43),
      }),
    ).rejects.toThrow('INVALID_GRANT');
    const tokens = (await t.mutation(api.publicApi.oauthApps.exchangeCode, {
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      code,
      redirectUri,
      codeVerifier: verifier,
    })) as { access_token: string; refresh_token: string; scope: string };
    expect(tokens.access_token).toMatch(/^fa_oat_/);
    expect(tokens.scope).toBe('profile:read');
    expect((await call(tokens.access_token, 'GET', '/me')).status).toBe(200);
    expect((await call(tokens.access_token, 'GET', '/transactions')).status).toBe(403);

    const rotated = (await t.mutation(api.publicApi.oauthApps.refresh, {
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      refreshToken: tokens.refresh_token,
    })) as { access_token: string; refresh_token: string };
    expect((await call(tokens.access_token, 'GET', '/me')).status).toBe(401);
    expect((await call(rotated.access_token, 'GET', '/me')).status).toBe(200);
    const reuse = await t.mutation(api.publicApi.oauthApps.refresh, {
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      refreshToken: tokens.refresh_token,
    });
    expect(reuse).toEqual({ error: 'invalid_grant' });
    expect((await call(rotated.access_token, 'GET', '/me')).status).toBe(401);
    const connected = await user.query(api.publicApi.oauthApps.listConnectedApps, {});
    expect(connected).toHaveLength(0);
  });
});
