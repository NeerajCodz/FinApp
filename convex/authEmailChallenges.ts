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
  },
  handler: async (ctx, { userId, challengeIdHash, codeHash, now }) => {
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
