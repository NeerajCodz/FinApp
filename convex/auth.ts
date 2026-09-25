import { Password } from '@convex-dev/auth/providers/Password';
import type { ConvexCredentialsUserConfig } from '@convex-dev/auth/providers/ConvexCredentials';
import { convexAuth, retrieveAccount } from '@convex-dev/auth/server';
import type { DataModel } from './_generated/dataModel';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { generateOtp, resendOtpProvider, sendAppLockResetEmail, sendTwoFactorEmail } from './shared/email';
import { getOptionalUser } from './shared/auth';
import { normalizeUsername } from './users/domain';
import { action, internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordProvider = Password({
  verify: resendOtpProvider('resend-email-verification', 'verify'),
  reset: resendOtpProvider('resend-password-reset', 'reset'),
  validatePasswordRequirements: (password) => {
    if (password.length < 8) throw new Error('PASSWORD_TOO_SHORT');
  },
});
type PasswordOptions = ConvexCredentialsUserConfig<DataModel>;
// Password stores the underlying credentials config in this runtime field.
const wrappedPasswordProvider = passwordProvider as unknown as { options: PasswordOptions };
const passwordOptions = wrappedPasswordProvider.options;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomChallengeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const requestEmailTwoFactor = action({
  args: { identifier: v.string(), password: v.string() },
  handler: async (ctx, { identifier, password }) => {
    const normalizedParams = await normalizedPasswordParams(
      { email: identifier, password, flow: 'signIn' },
      ctx as unknown as Parameters<PasswordOptions['authorize']>[1],
    );
    const { account, user } = await retrieveAccount(ctx, {
      provider: 'password',
      account: {
        id: normalizedParams.email as string,
        secret: password,
      },
    });
    if (!account.emailVerified) {
      return { status: 'verification-required' as const, email: normalizedParams.email as string };
    }
    const challengeId = randomChallengeId();
    const code = generateOtp();
    const challengeIdHash = await sha256(challengeId);
    const codeHash = await sha256(`${challengeId}:${code}`);
    const { email } = await ctx.runMutation(internal.authEmailChallenges.create, {
      userId: user._id,
      challengeIdHash,
      codeHash,
      now: Date.now(),
    });
    try {
      await sendTwoFactorEmail(email, code);
    } catch (error) {
      await ctx.runMutation(internal.authEmailChallenges.revoke, { challengeIdHash });
      throw error;
    }
    return { status: 'code-sent' as const, challengeId };
  },
});
async function normalizedPasswordParams(
  params: Parameters<PasswordOptions['authorize']>[0],
  ctx: Parameters<PasswordOptions['authorize']>[1],
) {
  const identifier = typeof params.email === 'string' ? params.email.trim() : '';
  let email = identifier;
  if (
    (params.flow === 'signIn' || params.flow === 'email-verification') &&
    !emailPattern.test(identifier)
  ) {
    const username = normalizeUsername(identifier);
    if (/^[a-z0-9_]{3,32}$/.test(username)) {
      email =
        (await ctx.runQuery(internal.users.queries.loginEmailForUsername, { username })) ??
        identifier;
    }
  }
  return { ...params, email: email.toLowerCase() };
}

const usernameAuthorize: PasswordOptions['authorize'] = async (params, ctx) => {
  if (params.flow === 'signIn') {
    throw new Error('Use the email second-factor sign-in flow.');
  }

  if (params.flow === 'verification-required') {
    const normalizedParams = await normalizedPasswordParams({ ...params, flow: 'signIn' }, ctx);
    const account = await ctx.runQuery(internal.authEmailChallenges.emailStatus, {
      email: normalizedParams.email as string,
    });
    if (account?.verified) throw new Error('Use the email second-factor sign-in flow.');
    return passwordOptions.authorize(normalizedParams, ctx);
  }

  if (params.flow === 'twoFactorVerification') {
    if (typeof params.challengeId !== 'string' || typeof params.code !== 'string') {
      return null;
    }
    return ctx.runMutation(internal.authEmailChallenges.consume, {
      challengeIdHash: await sha256(params.challengeId),
      codeHash: await sha256(`${params.challengeId}:${params.code}`),
      now: Date.now(),
    });
  }

  const normalizedParams = await normalizedPasswordParams(params, ctx);
  if (params.flow === 'email-verification') {
    const email = normalizedParams.email as string;
    const account = await ctx.runQuery(internal.authEmailChallenges.emailStatus, { email });
    if (account?.verified) throw new Error('Email is already verified.');
  }
  return passwordOptions.authorize(normalizedParams, ctx);
};

const usernamePasswordProvider = {
  ...passwordProvider,
  options: { ...passwordOptions, authorize: usernameAuthorize },
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [usernamePasswordProvider],
});

export const appLockResetIdentity = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined || !user.email || !user.emailVerificationTime)
      throw new Error('A signed-in account with a verified email is required to reset the app passcode.');
    return { userId: user._id, email: user.email.toLowerCase() };
  },
});

export const createAppLockReset = internalMutation({
  args: { userId: v.id('users'), challengeIdHash: v.string(), codeHash: v.string(), now: v.number() },
  handler: async (ctx, { userId, challengeIdHash, codeHash, now }) => {
    const previous = await ctx.db
      .query('appLockResetChallenges')
      .withIndex('by_user', (query) => query.eq('userId', userId))
      .unique();
    if (previous && now - previous.createdAt < 30_000)
      throw new Error('Please wait 30 seconds before requesting another code.');
    const challenge = {
      challengeIdHash, codeHash, createdAt: now,
      expiresAt: now + 10 * 60_000, attempts: 0, consumedAt: undefined,
    };
    if (previous) await ctx.db.patch(previous._id, challenge);
    else await ctx.db.insert('appLockResetChallenges', { userId, ...challenge });
  },
});

export const revokeAppLockReset = internalMutation({
  args: { challengeIdHash: v.string() },
  handler: async (ctx, { challengeIdHash }) => {
    const challenge = await ctx.db.query('appLockResetChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash)).unique();
    if (challenge) await ctx.db.delete(challenge._id);
  },
});

export const requestAppLockReset = action({
  args: {},
  handler: async (ctx): Promise<{ challengeId: string; userId: Id<'users'> }> => {
    const { userId, email } = await ctx.runQuery(internal.auth.appLockResetIdentity, {});
    const challengeId = randomChallengeId();
    const code = generateOtp();
    const challengeIdHash = await sha256(challengeId);
    await ctx.runMutation(internal.auth.createAppLockReset, {
      userId, challengeIdHash, codeHash: await sha256(`${challengeId}:${code}`), now: Date.now(),
    });
    try {
      await sendAppLockResetEmail(email, code);
    } catch (error) {
      await ctx.runMutation(internal.auth.revokeAppLockReset, { challengeIdHash });
      throw error;
    }
    return { challengeId, userId };
  },
});

export const consumeAppLockReset = internalMutation({
  args: { userId: v.id('users'), challengeIdHash: v.string(), codeHash: v.string(), now: v.number() },
  handler: async (ctx, { userId, challengeIdHash, codeHash, now }) => {
    const challenge = await ctx.db.query('appLockResetChallenges')
      .withIndex('by_challenge', (query) => query.eq('challengeIdHash', challengeIdHash))
      .unique();
    if (!challenge || challenge.userId !== userId || challenge.consumedAt !== undefined)
      return false;
    if (challenge.expiresAt <= now || challenge.attempts >= 5) {
      await ctx.db.patch(challenge._id, { consumedAt: now });
      return false;
    }
    let mismatch = challenge.codeHash.length ^ codeHash.length;
    for (let index = 0; index < Math.max(challenge.codeHash.length, codeHash.length); index += 1)
      mismatch |= (challenge.codeHash.charCodeAt(index) || 0) ^ (codeHash.charCodeAt(index) || 0);
    if (mismatch !== 0) {
      const attempts = challenge.attempts + 1;
      await ctx.db.patch(challenge._id, {
        attempts, ...(attempts >= 5 ? { consumedAt: now } : {}),
      });
      return false;
    }
    await ctx.db.patch(challenge._id, { consumedAt: now });
    return true;
  },
});

export const verifyAppLockReset = action({
  args: { challengeId: v.string(), code: v.string() },
  handler: async (ctx, { challengeId, code }): Promise<{ verified: boolean; userId: Id<'users'> }> => {
    if (!/^[a-f0-9]{64}$/.test(challengeId) || !/^\d{6}$/.test(code))
      throw new Error('Invalid or expired reset code.');
    const { userId } = await ctx.runQuery(internal.auth.appLockResetIdentity, {});
    const verified = await ctx.runMutation(internal.auth.consumeAppLockReset, {
      userId, challengeIdHash: await sha256(challengeId),
      codeHash: await sha256(`${challengeId}:${code}`), now: Date.now(),
    });
    return { verified, userId };
  },
});
