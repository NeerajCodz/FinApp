import { Password } from '@convex-dev/auth/providers/Password';
import type { ConvexCredentialsUserConfig } from '@convex-dev/auth/providers/ConvexCredentials';
import { convexAuth, retrieveAccount } from '@convex-dev/auth/server';
import type { DataModel } from './_generated/dataModel';
import { internal } from './_generated/api';
import { generateOtp, resendOtpProvider, sendTwoFactorEmail } from './shared/email';
import { normalizeUsername } from './users/domain';
import { action } from './_generated/server';
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
