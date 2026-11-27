import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';

import { OTP_MAX_AGE_SECONDS } from './shared/email';
const challengeLifetimeMs = OTP_MAX_AGE_SECONDS * 1000;
const minimumResendIntervalMs = 30 * 1000;
const maxVerificationAttempts = 5;

export const emailStatus = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('email', (query) => query.eq('email', email.toLowerCase()))
      .first();
    return user ? { verified: user.emailVerificationTime !== undefined } : null;
  },
});

export const create = internalMutation({
  args: {
    userId: v.id('users'),
    challengeIdHash: v.string(),
    codeHash: v.string(),
    now: v.number(),
    /** False when no email is sent yet (authenticator app first). */
    emailSent: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, challengeIdHash, codeHash, now, emailSent }) => {
    const user = await ctx.db.get(userId);
    if (
      !user ||
      user.deletedAt !== undefined ||
      !user.email ||
      user.emailVerificationTime === undefined
    ) {
      throw new Error('EMAIL_NOT_VERIFIED');
    }

    const previous = await ctx.db
      .query('authEmailChallenges')
      .withIndex('by_user', (query) => query.eq('userId', userId))
      .unique();
    if (previous && now - previous.createdAt < minimumResendIntervalMs) {
      throw new Error('TWO_FACTOR_RATE_LIMITED');
    }

    const challenge = {
      challengeIdHash,
      codeHash,
      createdAt: now,
      expiresAt: now + challengeLifetimeMs,
      attempts: 0,
      consumedAt: undefined,
      emailSentAt: emailSent === false ? undefined : now,
    };
    if (previous) {
      await ctx.db.patch(previous._id, challenge);
    } else {
      await ctx.db.insert('authEmailChallenges', { userId, ...challenge });
    }
    return { email: user.email.toLowerCase() };
  },
});

export const consume = internalMutation({
  args: {
    challengeIdHash: v.string(),
    codeHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, { challengeIdHash, codeHash, now }) => {
    const challenge = await ctx.db
      .query('authEmailChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
      .unique();
    if (!challenge || challenge.consumedAt !== undefined) return null;
    if (challenge.expiresAt <= now || challenge.attempts >= maxVerificationAttempts) {
      await ctx.db.patch(challenge._id, { consumedAt: now });
      return null;
    }
    if (!equalDigest(challenge.codeHash, codeHash)) {
      const attempts = challenge.attempts + 1;
      await ctx.db.patch(challenge._id, {
        attempts,
        ...(attempts >= maxVerificationAttempts ? { consumedAt: now } : {}),
      });
      return null;
    }
    await ctx.db.patch(challenge._id, { consumedAt: now });
    return { userId: challenge.userId };
  },
});

/**
 * Reserves an active challenge's email resend slot without replacing its current code. The slot
 * is rolled back if delivery fails, so the existing code stays usable and a retry can proceed.
 */
export const reserveCodeResend = internalMutation({
  args: { challengeIdHash: v.string(), now: v.number() },
  handler: async (ctx, { challengeIdHash, now }) => {
    const challenge = await ctx.db
      .query('authEmailChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
      .unique();
    if (
      !challenge ||
      challenge.consumedAt !== undefined ||
      challenge.expiresAt <= now ||
      challenge.attempts >= maxVerificationAttempts
    )
      return null;
    if (
      challenge.emailSentAt !== undefined &&
      now - challenge.emailSentAt < minimumResendIntervalMs
    )
      throw new Error('TWO_FACTOR_RATE_LIMITED');
    const user = await ctx.db.get(challenge.userId);
    if (!user?.email || user.deletedAt !== undefined) return null;
    const previousEmailSentAt = challenge.emailSentAt ?? null;
    await ctx.db.patch(challenge._id, { emailSentAt: now });
    return { email: user.email.toLowerCase(), reservedAt: now, previousEmailSentAt };
  },
});

/** Makes a delivered resend code current only while its reservation is still active. */
export const finishCodeResend = internalMutation({
  args: {
    challengeIdHash: v.string(),
    codeHash: v.string(),
    reservedAt: v.number(),
    now: v.number(),
  },
  handler: async (ctx, { challengeIdHash, codeHash, reservedAt, now }) => {
    const challenge = await ctx.db
      .query('authEmailChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
      .unique();
    if (
      !challenge ||
      challenge.consumedAt !== undefined ||
      challenge.expiresAt <= now ||
      challenge.attempts >= maxVerificationAttempts ||
      challenge.emailSentAt !== reservedAt
    )
      return false;
    await ctx.db.patch(challenge._id, {
      codeHash,
      expiresAt: Math.max(challenge.expiresAt, now + challengeLifetimeMs),
    });
    return true;
  },
});

/** Releases a failed delivery's rate-limit reservation without touching the working code. */
export const releaseCodeResend = internalMutation({
  args: {
    challengeIdHash: v.string(),
    reservedAt: v.number(),
    previousEmailSentAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, { challengeIdHash, reservedAt, previousEmailSentAt }) => {
    const challenge = await ctx.db
      .query('authEmailChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
      .unique();
    if (!challenge || challenge.emailSentAt !== reservedAt) return false;
    await ctx.db.patch(challenge._id, {
      emailSentAt: previousEmailSentAt === null ? undefined : previousEmailSentAt,
    });
    return true;
  },
});

/** The user an unexpired, unconsumed challenge belongs to (for authenticator/recovery codes). */
export const activeUser = internalQuery({
  args: { challengeIdHash: v.string(), now: v.number() },
  handler: async (ctx, { challengeIdHash, now }) => {
    const challenge = await ctx.db
      .query('authEmailChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
      .unique();
    if (
      !challenge ||
      challenge.consumedAt !== undefined ||
      challenge.expiresAt <= now ||
      challenge.attempts >= maxVerificationAttempts
    )
      return null;
    return { userId: challenge.userId };
  },
});

/** Closes a challenge after an authenticator/recovery check (or counts a failed attempt). */
export const settle = internalMutation({
  args: { challengeIdHash: v.string(), ok: v.boolean(), now: v.number() },
  handler: async (ctx, { challengeIdHash, ok, now }) => {
    const challenge = await ctx.db
      .query('authEmailChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
      .unique();
    if (!challenge || challenge.consumedAt !== undefined) return null;
    if (ok) {
      await ctx.db.patch(challenge._id, { consumedAt: now });
      return { userId: challenge.userId };
    }
    const attempts = challenge.attempts + 1;
    await ctx.db.patch(challenge._id, {
      attempts,
      ...(attempts >= maxVerificationAttempts ? { consumedAt: now } : {}),
    });
    return null;
  },
});

export const revoke = internalMutation({
  args: { challengeIdHash: v.string() },
  handler: async (ctx, { challengeIdHash }) => {
    const challenge = await ctx.db
      .query('authEmailChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
      .unique();
    if (challenge) await ctx.db.delete(challenge._id);
  },
});

function equalDigest(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
