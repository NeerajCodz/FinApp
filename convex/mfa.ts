/**
 * Multi-factor sign-in: authenticator apps (TOTP) and recovery codes, next to the email code.
 *
 * Enrollment: `startTotp` makes a secret (encrypted at rest with the key vault) and returns the
 * QR code; `confirmTotp` turns it on once the app's first code checks out and hands back recovery
 * codes (shown once, stored as hashes). Turning the app off or making new recovery codes needs a
 * current code. Sign-in uses `verifySecondFactor` (see `auth.ts`).
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { decryptSecret, encryptSecret, isVaultConfigured } from './ai/keyVault';
import { createNotification } from './notifications/mutations';
import { qrPath } from './qr';
import { getOptionalUser } from './shared/auth';
import {
  groupSecret,
  hashRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  normalizeRecoveryCode,
  otpauthUri,
  verifyTotp,
} from './mfaDomain';

async function factorsRow(ctx: { db: QueryCtx['db'] }, userId: Id<'users'>) {
  return ctx.db
    .query('mfaFactors')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

function summarize(row: Doc<'mfaFactors'> | null) {
  const codes = row?.recoveryCodes ?? [];
  return {
    totp: Boolean(row?.totpSecret && row.totpConfirmedAt !== undefined),
    totpSince: row?.totpConfirmedAt ?? null,
    recoveryTotal: codes.length,
    recoveryRemaining: codes.filter((code) => code.usedAt === undefined).length,
    recoveryCreatedAt: row?.recoveryCreatedAt ?? null,
  };
}

/** Whether any extra factor is on for a user (TOTP), for the sign-in gate. */
export async function hasTotp(ctx: { db: QueryCtx['db'] }, userId: Id<'users'>) {
  return summarize(await factorsRow(ctx, userId)).totp;
}

/** Your sign-in factors (Settings → Security). */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    return { ...summarize(await factorsRow(ctx, user._id)), available: isVaultConfigured() };
  },
});

// ---------- Internal state ----------

export type Factors = {
  email: string | null;
  username: string | null;
  totpSecret: string | null;
  totpPendingSecret: string | null;
  totpLastStep: number | null;
  recoveryHashes: string[];
  totp: boolean;
  totpSince: number | null;
  recoveryTotal: number;
  recoveryRemaining: number;
  recoveryCreatedAt: number | null;
};

export const factorsFor = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<Factors> => {
    const user = await ctx.db.get(userId);
    const row = await factorsRow(ctx, userId);
    return {
      email: user?.email ?? null,
      username: user?.username ?? null,
      totpSecret: row?.totpConfirmedAt !== undefined ? (row?.totpSecret ?? null) : null,
      totpPendingSecret: row?.totpPendingSecret ?? null,
      totpLastStep: row?.totpLastStep ?? null,
      recoveryHashes: (row?.recoveryCodes ?? [])
        .filter((code) => code.usedAt === undefined)
        .map((code) => code.hash),
      ...summarize(row),
    };
  },
});

async function upsert(ctx: MutationCtx, userId: Id<'users'>, patch: Partial<Doc<'mfaFactors'>>) {
  const row = await factorsRow(ctx, userId);
  const now = Date.now();
  if (row) await ctx.db.patch(row._id, { ...patch, updatedAt: now });
  else await ctx.db.insert('mfaFactors', { userId, ...patch, updatedAt: now });
}

export const savePending = internalMutation({
  args: { userId: v.id('users'), secret: v.string() },
  handler: async (ctx, { userId, secret }) => {
    await upsert(ctx, userId, { totpPendingSecret: secret });
  },
});

export const activateTotp = internalMutation({
  args: {
    userId: v.id('users'),
    pendingSecret: v.string(),
    step: v.number(),
    recoveryHashes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { userId, pendingSecret, step, recoveryHashes }) => {
    const row = await factorsRow(ctx, userId);
    if (!row?.totpPendingSecret || row.totpPendingSecret !== pendingSecret)
      throw new Error('TOTP_ENROLLMENT_CHANGED');
    const now = Date.now();
    const recoveryDetail = recoveryHashes
      ? ` ${recoveryHashes.length} recovery code${recoveryHashes.length === 1 ? '' : 's'} were created and shown once.`
      : '';
    await upsert(ctx, userId, {
      totpSecret: row.totpPendingSecret,
      totpPendingSecret: undefined,
      totpConfirmedAt: now,
      totpLastStep: step,
      ...(recoveryHashes
        ? { recoveryCodes: recoveryHashes.map((hash) => ({ hash })), recoveryCreatedAt: now }
        : {}),
    });
    await createNotification(
      ctx,
      userId,
      `security:totp-on:${now}`,
      'security',
      'account',
      String(userId),
      'Authenticator app turned on',
      `Sign-in now asks for a code from your authenticator app.${recoveryDetail} If this wasn’t you, change your password and turn it off in Settings → Security.`,
    );
  },
});

export const deactivateTotp = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    await upsert(ctx, userId, {
      totpSecret: undefined,
      totpPendingSecret: undefined,
      totpConfirmedAt: undefined,
      totpLastStep: undefined,
    });
    await createNotification(
      ctx,
      userId,
      `security:totp-off:${now}`,
      'security',
      'account',
      String(userId),
      'Authenticator app turned off',
      'Sign-in no longer asks for an authenticator code. If this wasn’t you, change your password now.',
    );
  },
});

export const replaceRecoveryCodes = internalMutation({
  args: { userId: v.id('users'), hashes: v.array(v.string()) },
  handler: async (ctx, { userId, hashes }) => {
    const now = Date.now();
    await upsert(ctx, userId, {
      recoveryCodes: hashes.map((hash) => ({ hash })),
      recoveryCreatedAt: now,
    });
    const count = hashes.length;
    await createNotification(
      ctx,
      userId,
      `security:recovery-codes:${now}:${hashes[0] ?? 'empty'}`,
      'security',
      'account',
      String(userId),
      'Recovery codes regenerated',
      `${count} new recovery code${count === 1 ? '' : 's'} were created. Your previous codes no longer work; save the new codes now. They are shown only once.`,
    );
  },
});

/** Records a successful factor: the TOTP step (no replay) or the recovery code used up. */
export const recordFactorUse = internalMutation({
  args: {
    userId: v.id('users'),
    totpStep: v.optional(v.number()),
    recoveryHash: v.optional(v.string()),
    notifyRecoverySignIn: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, totpStep, recoveryHash, notifyRecoverySignIn }) => {
    const row = await factorsRow(ctx, userId);
    if (!row) return false;
    if (totpStep !== undefined) {
      if (row.totpLastStep !== undefined && totpStep <= row.totpLastStep) return false;
      await ctx.db.patch(row._id, { totpLastStep: totpStep, updatedAt: Date.now() });
      return true;
    }
    if (recoveryHash) {
      const codes = row.recoveryCodes ?? [];
      const index = codes.findIndex(
        (code) => code.hash === recoveryHash && code.usedAt === undefined,
      );
      if (index < 0) return false;
      const now = Date.now();
      const next = codes.map((code, i) => (i === index ? { ...code, usedAt: now } : code));
      await ctx.db.patch(row._id, { recoveryCodes: next, updatedAt: now });
      if (notifyRecoverySignIn ?? true) {
        const left = next.filter((code) => code.usedAt === undefined).length;
        await createNotification(
          ctx,
          userId,
          `security:recovery-used:${recoveryHash}`,
          'security',
          'account',
          String(userId),
          'Recovery code used',
          `${left} recovery code${left === 1 ? '' : 's'} left. Make new ones in Settings → Security if you’re running low.`,
        );
      }
      return true;
    }
    return false;
  },
});

// ---------- Verification (sign-in and sensitive changes) ----------

export type SecondFactor = 'totp' | 'recovery';

/**
 * Checks a TOTP or recovery code for a user and records its use. Returns false for a wrong,
 * reused or unavailable code.
 */
export async function verifySecondFactor(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>,
  userId: Id<'users'>,
  method: SecondFactor,
  code: string,
  context: 'sign-in' | 'settings' = 'sign-in',
): Promise<boolean> {
  const factors: Factors = await ctx.runQuery(internal.mfa.factorsFor, { userId });
  if (method === 'totp') {
    if (!factors.totpSecret) return false;
    const secret = await decryptSecret(factors.totpSecret, String(userId));
    const step = await verifyTotp(secret, code, {
      ...(factors.totpLastStep !== null ? { lastUsedStep: factors.totpLastStep } : {}),
    });
    if (step === null) return false;
    const used: boolean = await ctx.runMutation(internal.mfa.recordFactorUse, {
      userId,
      totpStep: step,
    });
    return used;
  }
  if (normalizeRecoveryCode(code).length !== 12) return false;
  const hash = await hashRecoveryCode(String(userId), code);
  if (!factors.recoveryHashes.includes(hash)) return false;
  const used: boolean = await ctx.runMutation(internal.mfa.recordFactorUse, {
    userId,
    recoveryHash: hash,
    notifyRecoverySignIn: context === 'sign-in',
  });
  return used;
}

async function signedInUser(ctx: ActionCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('AUTH_REQUIRED');
  return userId;
}

async function hashedCodes(userId: Id<'users'>) {
  const codes = newRecoveryCodes();
  return {
    codes,
    hashes: await Promise.all(codes.map((code) => hashRecoveryCode(String(userId), code))),
  };
}

// ---------- Enrollment ----------

/** Starts adding an authenticator app: a new secret, its QR code and the key to type by hand. */
export const startTotp = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ secret: string; uri: string; qr: { size: number; path: string } }> => {
    const userId = await signedInUser(ctx);
    if (!isVaultConfigured()) throw new Error('MFA_UNAVAILABLE');
    const factors: Factors = await ctx.runQuery(internal.mfa.factorsFor, { userId });
    if (factors.totp) throw new Error('TOTP_ALREADY_ON');
    const secret = newTotpSecret();
    await ctx.runMutation(internal.mfa.savePending, {
      userId,
      secret: await encryptSecret(secret, String(userId)),
    });
    const uri = otpauthUri(
      secret,
      factors.username ? `@${factors.username}` : (factors.email ?? 'account'),
    );
    return { secret: groupSecret(secret), uri, qr: qrPath(uri) };
  },
});

/** Turns the authenticator app on after its first code checks out; returns recovery codes once. */
export const confirmTotp = action({
  args: { code: v.string() },
  handler: async (ctx, { code }): Promise<{ recoveryCodes: string[] | null }> => {
    const userId = await signedInUser(ctx);
    const factors: Factors = await ctx.runQuery(internal.mfa.factorsFor, { userId });
    if (!factors.totpPendingSecret) throw new Error('TOTP_NOT_STARTED');
    const secret = await decryptSecret(factors.totpPendingSecret, String(userId));
    const step = await verifyTotp(secret, code);
    if (step === null) throw new Error('INVALID_CODE');
    // First factor: give recovery codes too (keep existing ones otherwise).
    const fresh = factors.recoveryRemaining === 0 ? await hashedCodes(userId) : null;
    await ctx.runMutation(internal.mfa.activateTotp, {
      userId,
      pendingSecret: factors.totpPendingSecret,
      step,
      ...(fresh ? { recoveryHashes: fresh.hashes } : {}),
    });
    return { recoveryCodes: fresh?.codes ?? null };
  },
});

/** Turns the authenticator app off; needs a current authenticator or recovery code. */
export const disableTotp = action({
  args: { code: v.string() },
  handler: async (ctx, { code }): Promise<null> => {
    const userId = await signedInUser(ctx);
    const method: SecondFactor = /^\d{6}$/.test(code.trim()) ? 'totp' : 'recovery';
    if (!(await verifySecondFactor(ctx, userId, method, code, 'settings')))
      throw new Error('INVALID_CODE');
    await ctx.runMutation(internal.mfa.deactivateTotp, { userId });
    return null;
  },
});

/**
 * New recovery codes (the old ones stop working). With an authenticator app on, a current code
 * from it (or an unused recovery code) is required.
 */
export const regenerateRecoveryCodes = action({
  args: { code: v.optional(v.string()) },
  handler: async (ctx, { code }): Promise<{ recoveryCodes: string[] }> => {
    const userId = await signedInUser(ctx);
    const factors: Factors = await ctx.runQuery(internal.mfa.factorsFor, { userId });
    if (factors.totp) {
      const method: SecondFactor = /^\d{6}$/.test((code ?? '').trim()) ? 'totp' : 'recovery';
      if (!code || !(await verifySecondFactor(ctx, userId, method, code, 'settings')))
        throw new Error('INVALID_CODE');
    }
    const { codes, hashes } = await hashedCodes(userId);
    await ctx.runMutation(internal.mfa.replaceRecoveryCodes, { userId, hashes });
    return { recoveryCodes: codes };
  },
});
