import { generateKeyPairSync } from 'node:crypto';
import { Scrypt } from 'lucia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import {
  base32Decode,
  base32Encode,
  currentStep,
  hashRecoveryCode,
  newRecoveryCodes,
  otpauthUri,
  totpCode,
  verifyTotp,
} from '../../convex/mfaDomain';
import { qrPath } from '../../convex/qr';

const modules = import.meta.glob('../../convex/**/*.ts');
// RFC 6238 test key "12345678901234567890" in base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP and recovery codes', () => {
  it('matches the RFC 6238 SHA-1 test vectors (last six digits)', async () => {
    expect(await totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(await totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(await totpCode(RFC_SECRET, Math.floor(1234567890 / 30))).toBe('005924');
    expect(await totpCode(RFC_SECRET, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('round-trips base32 and builds an otpauth URI', () => {
    const bytes = new TextEncoder().encode('12345678901234567890');
    expect(base32Encode(bytes)).toBe(RFC_SECRET);
    expect(Array.from(base32Decode(RFC_SECRET.toLowerCase()))).toEqual(Array.from(bytes));
    expect(otpauthUri(RFC_SECRET, '@olive')).toBe(
      `otpauth://totp/Finapp%3A%40olive?secret=${RFC_SECRET}&issuer=Finapp&algorithm=SHA1&digits=6&period=30`,
    );
  });

  it('accepts one step of drift, rejects reused steps and junk', async () => {
    const now = 1_767_225_600_000;
    const step = currentStep(now);
    const previous = await totpCode(RFC_SECRET, step - 1);
    expect(await verifyTotp(RFC_SECRET, previous, { now })).toBe(step - 1);
    expect(await verifyTotp(RFC_SECRET, previous, { now, lastUsedStep: step - 1 })).toBeNull();
    expect(await verifyTotp(RFC_SECRET, await totpCode(RFC_SECRET, step - 3), { now })).toBeNull();
    expect(await verifyTotp(RFC_SECRET, 'abc123', { now })).toBeNull();
  });

  it('makes distinct readable recovery codes, hashed per user', async () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(await hashRecoveryCode('u1', codes[0]!)).toBe(
      await hashRecoveryCode('u1', codes[0]!.toUpperCase().replace(/-/g, ' ')),
    );
    expect(await hashRecoveryCode('u1', codes[0]!)).not.toBe(
      await hashRecoveryCode('u2', codes[0]!),
    );
  });

  it('draws a square QR path', () => {
    const { size, path } = qrPath('otpauth://totp/Finapp:test?secret=ABC');
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  });
});

beforeEach(() => {
  // A 32-byte vault key (base64) so the TOTP secret can be encrypted at rest.
  vi.stubEnv('AI_KEYS_SECRET', Buffer.alloc(32, 7).toString('base64'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert('users', {
      email: 'olive@example.com',
      username: 'olive',
      emailVerificationTime: Date.now(),
    }),
  );
  return { t, userId, me: t.withIdentity({ subject: `${userId}|session` }) };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createEmailChallenge(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  challengeId: string,
  code: string,
  previousSentAt?: number,
) {
  const challengeIdHash = await sha256(challengeId);
  const codeHash = await sha256(`${challengeId}:${code}`);
  await t.mutation(internal.authEmailChallenges.create, {
    userId,
    challengeIdHash,
    codeHash,
    now: previousSentAt ?? Date.now(),
    ...(previousSentAt === undefined ? { emailSent: false } : {}),
  });
  return { challengeIdHash, codeHash };
}

/** The current code for a started or active TOTP secret (decrypted the way the server does). */
async function codeFor(
  t: ReturnType<typeof convexTest>,
  userId: string,
  pending: boolean,
  offset = 0,
) {
  const { decryptSecret } = await import('../../convex/ai/keyVault');
  const row = await t.run((ctx) => ctx.db.query('mfaFactors').first());
  const stored = pending ? row!.totpPendingSecret! : row!.totpSecret!;
  return totpCode(await decryptSecret(stored, userId), currentStep() + offset);
}

describe('authenticator app enrollment', () => {
  it('turns on with a valid code, gives recovery codes once, and counts as two-factor', async () => {
    const { t, userId, me } = await fixture();
    expect(await me.query(api.mfa.status, {})).toMatchObject({ totp: false, available: true });
    const started = await me.action(api.mfa.startTotp, {});
    expect(started.uri).toContain('otpauth://totp/Finapp%3A%40olive?secret=');
    expect(started.qr.size).toBeGreaterThan(20);
    const row = await t.run((ctx) => ctx.db.query('mfaFactors').first());
    // Stored encrypted, never as the plain secret.
    expect(row!.totpPendingSecret).not.toContain(started.secret.replace(/\s/g, ''));

    await expect(me.action(api.mfa.confirmTotp, { code: '000000' })).rejects.toThrow(
      'INVALID_CODE',
    );
    const { recoveryCodes } = await me.action(api.mfa.confirmTotp, {
      code: await codeFor(t, userId, true),
    });
    expect(recoveryCodes).toHaveLength(10);
    expect(await me.query(api.mfa.status, {})).toMatchObject({
      totp: true,
      recoveryRemaining: 10,
    });
    expect(await t.query(internal.users.queries.twoFactorEnabledForUser, { userId })).toBe(true);
    await expect(me.action(api.mfa.startTotp, {})).rejects.toThrow('TOTP_ALREADY_ON');

    const notes = await t.run((ctx) => ctx.db.query('notifications').collect());
    expect(notes.map((row) => row.title)).toContain('Authenticator app turned on');
    expect(
      notes.find((row) => row.title === 'Authenticator app turned on')?.body,
    ).toContain('10 recovery codes were created and shown once');
  });

  it('cannot activate a replacement enrollment with a previously verified secret', async () => {
    const { t, userId, me } = await fixture();
    await me.action(api.mfa.startTotp, {});
    const stalePendingSecret = (await t.run((ctx) => ctx.db.query('mfaFactors').first()))!
      .totpPendingSecret!;

    await me.action(api.mfa.startTotp, {});
    await expect(
      t.mutation(internal.mfa.activateTotp, {
        userId,
        pendingSecret: stalePendingSecret,
        step: currentStep(),
      }),
    ).rejects.toThrow('TOTP_ENROLLMENT_CHANGED');

    await expect(
      me.action(api.mfa.confirmTotp, { code: await codeFor(t, userId, true) }),
    ).resolves.toMatchObject({ recoveryCodes: expect.any(Array) });
  });

  it('needs a current code (not a replay) or a recovery code to change things, each usable once', async () => {
    const { t, userId, me } = await fixture();
    await me.action(api.mfa.startTotp, {});
    const first = await codeFor(t, userId, true);
    const { recoveryCodes } = await me.action(api.mfa.confirmTotp, { code: first });
    // The code that turned it on can't be reused.
    await expect(me.action(api.mfa.regenerateRecoveryCodes, { code: first })).rejects.toThrow(
      'INVALID_CODE',
    );
    // A recovery code works once.
    const fresh = await me.action(api.mfa.regenerateRecoveryCodes, { code: recoveryCodes![0]! });
    expect(fresh.recoveryCodes).toHaveLength(10);
    await expect(
      me.action(api.mfa.regenerateRecoveryCodes, { code: fresh.recoveryCodes[0]! }),
    ).resolves.toBeTruthy();
    await expect(
      me.action(api.mfa.regenerateRecoveryCodes, { code: fresh.recoveryCodes[0]! }),
    ).rejects.toThrow('INVALID_CODE');
    const regeneratedNotes = await t.run((ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('title'), 'Recovery codes regenerated'))
        .collect(),
    );
    expect(regeneratedNotes).toHaveLength(2);
    expect(regeneratedNotes.map((row) => row.body)).toEqual([
      expect.stringContaining('10 new recovery codes'),
      expect.stringContaining('10 new recovery codes'),
    ]);
    expect(regeneratedNotes.every((row) => row.body.includes('previous codes no longer work'))).toBe(
      true,
    );
    expect(regeneratedNotes.every((row) => row.body.includes('shown only once'))).toBe(true);
    const usedNotes = await t.run((ctx) =>
      ctx.db
        .query('notifications')
        .filter((q) => q.eq(q.field('title'), 'Recovery code used'))
        .collect(),
    );
    expect(usedNotes).toHaveLength(2);
    expect(usedNotes.every((row) => row.body.includes('9 recovery codes left'))).toBe(true);
    // Turning it off with the next code.
    await me.action(api.mfa.disableTotp, { code: await codeFor(t, userId, false, 1) });
    expect(await me.query(api.mfa.status, {})).toMatchObject({ totp: false });
    expect(await t.query(internal.users.queries.twoFactorEnabledForUser, { userId })).toBe(false);
  });
});

describe('sign-in challenges with other factors', () => {
  it('finds the user of an active challenge, settles it once, and counts failures', async () => {
    const { t, userId } = await fixture();
    const now = Date.now();
    await t.mutation(internal.authEmailChallenges.create, {
      userId,
      challengeIdHash: 'h1',
      codeHash: 'unused',
      now,
      emailSent: false,
    });
    expect(
      await t.query(internal.authEmailChallenges.activeUser, { challengeIdHash: 'h1', now }),
    ).toEqual({
      userId,
    });
    for (let i = 0; i < 4; i++)
      expect(
        await t.mutation(internal.authEmailChallenges.settle, {
          challengeIdHash: 'h1',
          ok: false,
          now,
        }),
      ).toBeNull();
    expect(
      await t.mutation(internal.authEmailChallenges.settle, {
        challengeIdHash: 'h1',
        ok: true,
        now,
      }),
    ).toEqual({
      userId,
    });
    expect(
      await t.query(internal.authEmailChallenges.activeUser, { challengeIdHash: 'h1', now }),
    ).toBeNull();
  });

  it('sends an email fallback for TOTP accounts supported by older email-only clients', async () => {
    const { t, userId } = await fixture();
    const password = 'runtime-test-password';
    const secret = await new Scrypt().hash(password);
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert('userSettings', {
        userId,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'system',
        notificationPreferences: {},
        appLockPreferences: { enabled: false, fallback: 'device-pin' },
        twoFactorEnabled: true,
        updatedAt: now,
      });
      await ctx.db.insert('mfaFactors', {
        userId,
        totpSecret: 'encrypted-secret',
        totpConfirmedAt: now,
        recoveryCodes: [],
        updatedAt: now,
      });
      await ctx.db.insert('authAccounts', {
        userId,
        provider: 'password',
        providerAccountId: 'olive@example.com',
        secret,
        emailVerified: '1',
      });
    });
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
    vi.stubEnv('JWT_PRIVATE_KEY', privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    vi.stubEnv('CONVEX_SITE_URL', 'https://unit-test.convex.site');
    const sendEmail = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', sendEmail);

    const challenge = await t.action(api.auth.requestEmailTwoFactor, {
      identifier: 'olive@example.com',
      password,
    });
    expect(challenge).toMatchObject({
      status: 'code-sent',
      preferred: 'email',
      methods: { totp: true, email: true, recovery: false },
    });
    if (challenge.status !== 'code-sent') throw new Error('Expected an email fallback challenge.');

    const payload = JSON.parse(sendEmail.mock.calls[0]![1]!.body as string);
    const code = payload.text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    if (!code) throw new Error('The email did not contain a code.');
    const result = await t.action(api.auth.signIn, {
      provider: 'password',
      params: {
        challengeId: challenge.challengeId,
        code,
        flow: 'twoFactorVerification',
      },
    });
    expect(result.tokens).toBeTruthy();
  });

  it('keeps the prior email code usable when resend delivery fails', async () => {
    const { t, userId } = await fixture();
    const challengeId = 'a'.repeat(64);
    const previousSentAt = Date.now() - 31_000;
    const { challengeIdHash, codeHash } = await createEmailChallenge(
      t,
      userId,
      challengeId,
      '123456',
      previousSentAt,
    );
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    await expect(t.action(api.auth.sendTwoFactorEmailCode, { challengeId })).rejects.toThrow(
      'Email delivery failed (503).',
    );
    const row = await t.run((ctx) =>
      ctx.db
        .query('authEmailChallenges')
        .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
        .unique(),
    );
    expect(row?.codeHash).toBe(codeHash);
    expect(row?.emailSentAt).toBe(previousSentAt);
    await expect(
      t.mutation(internal.authEmailChallenges.consume, {
        challengeIdHash,
        codeHash,
        now: Date.now(),
      }),
    ).resolves.toEqual({ userId });
  });

  it('allows an immediate retry after failed resend delivery', async () => {
    const { t, userId } = await fixture();
    const challengeId = 'b'.repeat(64);
    const originalCode = '123456';
    const previousSentAt = Date.now() - 31_000;
    const { challengeIdHash, codeHash: originalCodeHash } = await createEmailChallenge(
      t,
      userId,
      challengeId,
      originalCode,
      previousSentAt,
    );
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
    const sendEmail = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', sendEmail);

    await expect(t.action(api.auth.sendTwoFactorEmailCode, { challengeId })).rejects.toThrow(
      'Email delivery failed (503).',
    );
    await expect(
      t.action(api.auth.sendTwoFactorEmailCode, { challengeId }),
    ).resolves.toBeNull();

    const payload = JSON.parse(sendEmail.mock.calls[1]![1]!.body as string);
    const resentCode = payload.text.match(/\b(\d{6})\b/)?.[1];
    expect(resentCode).toMatch(/^\d{6}$/);
    if (!resentCode) throw new Error('The email did not contain a code.');
    await expect(
      t.mutation(internal.authEmailChallenges.consume, {
        challengeIdHash,
        codeHash: originalCodeHash,
        now: Date.now(),
      }),
    ).resolves.toBeNull();
    await expect(
      t.mutation(internal.authEmailChallenges.consume, {
        challengeIdHash,
        codeHash: await sha256(`${challengeId}:${resentCode}`),
        now: Date.now(),
      }),
    ).resolves.toEqual({ userId });
  });

  it('reserves and rate-limits an email code resend', async () => {
    const { t, userId } = await fixture();
    const now = Date.now();
    await t.mutation(internal.authEmailChallenges.create, {
      userId,
      challengeIdHash: 'h2',
      codeHash: 'unused',
      now,
      emailSent: false,
    });
    const reservation = await t.mutation(internal.authEmailChallenges.reserveCodeResend, {
      challengeIdHash: 'h2',
      now,
    });
    expect(reservation).toEqual({
      email: 'olive@example.com',
      reservedAt: now,
      previousEmailSentAt: null,
    });
    expect(
      await t.mutation(internal.authEmailChallenges.finishCodeResend, {
        challengeIdHash: 'h2',
        codeHash: 'c1',
        reservedAt: now,
        now,
      }),
    ).toBe(true);
    await expect(
      t.mutation(internal.authEmailChallenges.reserveCodeResend, {
        challengeIdHash: 'h2',
        now: now + 5_000,
      }),
    ).rejects.toThrow('TWO_FACTOR_RATE_LIMITED');
    expect(
      await t.mutation(internal.authEmailChallenges.consume, {
        challengeIdHash: 'h2',
        codeHash: 'c1',
        now,
      }),
    ).toEqual({ userId });
  });
});
