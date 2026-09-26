import { generateKeyPairSync } from 'node:crypto';
import { Scrypt } from 'lucia';
import { describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');
const identity = { subject: 'runtime-user', email: 'runtime@example.com', name: 'Runtime User' };

describe('Convex public runtime functions', () => {
  it('requires authentication for every public query', async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.accounts.queries.list, {})).rejects.toThrow('AUTH_REQUIRED');
    await expect(t.query(api.categories.queries.list, {})).rejects.toThrow('AUTH_REQUIRED');
  });

  it('resolves Convex Auth session subjects to profile users', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        email: 'auth-session@example.com',
        name: 'Auth Session User',
      }),
    );
    const authenticated = t.withIdentity({
      subject: `${userId}|session-id`,
      email: 'auth-session@example.com',
      name: 'Auth Session User',
    });

    expect(await authenticated.query(api.users.queries.current, {})).toMatchObject({
      _id: userId,
    });
    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'Auth Session Wallet',
      type: 'wallet',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
    expect(await authenticated.query(api.accounts.queries.list, {})).toMatchObject([
      { id: accountId, name: 'Auth Session Wallet' },
    ]);
  });

  it('persists a custom account type and rejects an unnamed custom type', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        email: 'custom-type@example.com',
        name: 'Custom Type User',
      }),
    );
    const authenticated = t.withIdentity({
      subject: `${userId}|session-id`,
      email: 'custom-type@example.com',
    });
    const draft = {
      name: 'Brokerage',
      type: 'other' as const,
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    };
    await expect(
      authenticated.mutation(api.accounts.mutations.create, {
        ...draft,
        customType: '  Investment  ',
      }),
    ).resolves.toBeTruthy();
    expect(await authenticated.query(api.accounts.queries.list, {})).toMatchObject([
      { name: 'Brokerage', type: 'other', customType: 'Investment' },
    ]);
    await expect(
      authenticated.mutation(api.accounts.mutations.create, { ...draft, customType: '   ' }),
    ).rejects.toThrow('INVALID_ACCOUNT');
  });

  it('resolves usernames through a non-public login lookup', async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: 'username-login-user',
        email: 'login-user@example.com',
        name: 'Login User',
        username: 'neeraj',
      }),
    );

    await expect(
      t.query(internal.users.queries.loginEmailForUsername, { username: '@NEERAJ' }),
    ).resolves.toBe('login-user@example.com');
  });

  it('requires a single-use email second factor for password sign-in', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        email: 'login-user@example.com',
        emailVerificationTime: 1,
        name: 'Login User',
        username: 'neeraj',
      }),
    );
    const secret = await new Scrypt().hash('runtime-test-password');
    await t.run((ctx) =>
      ctx.db.insert('authAccounts', {
        userId,
        provider: 'password',
        providerAccountId: 'login-user@example.com',
        secret,
        emailVerified: '1',
      }),
    );

    const previousPrivateKey = process.env.JWT_PRIVATE_KEY;
    const previousSiteUrl = process.env.CONVEX_SITE_URL;
    const previousResendKey = process.env.AUTH_RESEND_KEY;
    const previousEmailFrom = process.env.AUTH_EMAIL_FROM;
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.CONVEX_SITE_URL = 'https://unit-test.convex.site';
    process.env.AUTH_RESEND_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'Finapp <mail@example.com>';
    const resendFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', resendFetch);
    try {
      const challenge = await t.action(api.auth.requestEmailTwoFactor, {
        identifier: '@NEERAJ',
        password: 'runtime-test-password',
      });
      expect(challenge.status).toBe('code-sent');
      if (challenge.status !== 'code-sent') throw new Error('Expected a second-factor challenge.');

      const payload = JSON.parse(resendFetch.mock.calls[0]![1]!.body as string);
      expect(payload.to).toEqual(['login-user@example.com']);
      const code = payload.text.match(/\b(\d{6})\b/)?.[1];
      expect(code).toMatch(/^\d{6}$/);
      if (!code) throw new Error('The email did not contain a code.');

      const params = {
        provider: 'password',
        params: {
          challengeId: challenge.challengeId,
          code,
          flow: 'twoFactorVerification',
        },
      } as const;
      const result = await t.action(api.auth.signIn, params);
      expect(result.tokens).toBeTruthy();
      const replay = await t.action(api.auth.signIn, params);
      expect(replay.tokens).toBeNull();

      await expect(
        t.action(api.auth.signIn, {
          provider: 'password',
          params: {
            email: '@NEERAJ',
            password: 'runtime-test-password',
            flow: 'signIn',
          },
        }),
      ).rejects.toThrow('Use the email second-factor sign-in flow.');
      await expect(
        t.action(api.auth.signIn, {
          provider: 'password',
          params: { email: 'login-user@example.com', code: '123456', flow: 'email-verification' },
        }),
      ).rejects.toThrow('Email is already verified.');
    } finally {
      vi.unstubAllGlobals();
      if (previousPrivateKey === undefined) delete process.env.JWT_PRIVATE_KEY;
      else process.env.JWT_PRIVATE_KEY = previousPrivateKey;
      if (previousSiteUrl === undefined) delete process.env.CONVEX_SITE_URL;
      else process.env.CONVEX_SITE_URL = previousSiteUrl;
      if (previousResendKey === undefined) delete process.env.AUTH_RESEND_KEY;
      else process.env.AUTH_RESEND_KEY = previousResendKey;
      if (previousEmailFrom === undefined) delete process.env.AUTH_EMAIL_FROM;
      else process.env.AUTH_EMAIL_FROM = previousEmailFrom;
    }
  });

  it('requires verified identity and a fresh single-use OTP to reset app lock', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        email: 'lock@example.com',
        emailVerificationTime: 1,
        name: 'Lock User',
      }),
    );
    const authenticated = t.withIdentity({
      subject: `${userId}|session-id`,
      email: 'lock@example.com',
      name: 'Lock User',
    });
    const previousKey = process.env.AUTH_RESEND_KEY;
    const previousFrom = process.env.AUTH_EMAIL_FROM;
    process.env.AUTH_RESEND_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'Finapp <mail@example.com>';
    const email = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', email);
    try {
      await expect(t.action(api.auth.requestAppLockReset, {})).rejects.toThrow();
      const { challengeId } = await authenticated.action(api.auth.requestAppLockReset, {});
      expect(JSON.parse(email.mock.calls[0]![1]!.body as string).to).toEqual(['lock@example.com']);
      const code = (JSON.parse(email.mock.calls[0]![1]!.body as string).text as string).match(
        /\b(\d{6})\b/,
      )?.[1];
      expect(code).toMatch(/^\d{6}$/);
      if (!code) throw new Error('Reset email did not contain a code.');
      expect(
        await authenticated.action(api.auth.verifyAppLockReset, {
          challengeId,
          code: code === '000000' ? '111111' : '000000',
        }),
      ).toMatchObject({ verified: false });
      expect(
        await authenticated.action(api.auth.verifyAppLockReset, { challengeId, code }),
      ).toMatchObject({ verified: true, userId });
      expect(
        await authenticated.action(api.auth.verifyAppLockReset, { challengeId, code }),
      ).toMatchObject({ verified: false });
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('notifications')
            .withIndex('by_recipient_createdAt', (query) => query.eq('recipientId', userId))
            .collect(),
        ),
      ).toMatchObject([{ type: 'security', title: 'Email recovery code verified' }]);
      await t.run(async (ctx) => {
        const challenge = await ctx.db
          .query('appLockResetChallenges')
          .withIndex('by_user', (query) => query.eq('userId', userId))
          .unique();
        if (!challenge) throw new Error('Missing challenge.');
        await ctx.db.patch(challenge._id, { createdAt: Date.now() - 31_000 });
      });
      const expired = await authenticated.action(api.auth.requestAppLockReset, {});
      const expiredCode = (
        JSON.parse(email.mock.calls[1]![1]!.body as string).text as string
      ).match(/\b(\d{6})\b/)?.[1];
      if (!expiredCode) throw new Error('Second reset email did not contain a code.');
      await t.run(async (ctx) => {
        const challenge = await ctx.db
          .query('appLockResetChallenges')
          .withIndex('by_user', (query) => query.eq('userId', userId))
          .unique();
        if (!challenge) throw new Error('Missing challenge.');
        await ctx.db.patch(challenge._id, { expiresAt: Date.now() - 1 });
      });
      expect(
        await authenticated.action(api.auth.verifyAppLockReset, {
          challengeId: expired.challengeId,
          code: expiredCode,
        }),
      ).toMatchObject({ verified: false });
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('notifications')
            .withIndex('by_recipient_createdAt', (query) => query.eq('recipientId', userId))
            .collect(),
        ),
      ).toHaveLength(1);

      await t.run(async (ctx) => {
        await ctx.db.patch(userId, { emailVerificationTime: undefined });
      });
      await expect(authenticated.action(api.auth.requestAppLockReset, {})).rejects.toThrow(
        'verified email',
      );
    } finally {
      vi.unstubAllGlobals();
      if (previousKey === undefined) delete process.env.AUTH_RESEND_KEY;
      else process.env.AUTH_RESEND_KEY = previousKey;
      if (previousFrom === undefined) delete process.env.AUTH_EMAIL_FROM;
      else process.env.AUTH_EMAIL_FROM = previousFrom;
    }
  });

  it('locks an email second-factor challenge after five wrong codes', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        email: 'locked@example.com',
        emailVerificationTime: 1,
        name: 'Locked User',
      }),
    );
    const challengeIdHash = 'challenge-id-hash';
    await t.mutation(internal.authEmailChallenges.create, {
      userId,
      challengeIdHash,
      codeHash: 'correct-code-hash',
      now: Date.now(),
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await t.mutation(internal.authEmailChallenges.consume, {
        challengeIdHash,
        codeHash: 'wrong-code-hash',
        now: Date.now(),
      });
    }
    await expect(
      t.mutation(internal.authEmailChallenges.consume, {
        challengeIdHash,
        codeHash: 'correct-code-hash',
        now: Date.now(),
      }),
    ).resolves.toBeNull();
  });

  it('runs the account and category mutation lifecycles', async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
      }),
    );
    const authenticated = t.withIdentity(identity);

    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'HDFC',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 125000n,
      isIncludedInTotal: true,
    });
    expect(await authenticated.query(api.accounts.queries.list, {})).toMatchObject([
      { id: accountId, name: 'HDFC', currency: 'INR', balanceMinor: 125000n },
    ]);

    const categoryId = await authenticated.mutation(api.categories.mutations.create, {
      name: 'Food',
    });
    const createdCategories = await authenticated.query(api.categories.queries.list, {});
    expect(createdCategories).toMatchObject([{ _id: categoryId, name: 'Food', isSystem: false }]);
    expect(createdCategories[0]).not.toHaveProperty('kind');
    await authenticated.mutation(api.categories.mutations.rename, {
      categoryId,
      name: 'Groceries',
    });
    expect(await authenticated.query(api.categories.queries.list, {})).toMatchObject([
      { _id: categoryId, name: 'Groceries' },
    ]);

    await authenticated.mutation(api.users.mutations.setDefaultCategory, {
      transactionType: 'expense',
      categoryId,
    });
    await authenticated.mutation(api.users.mutations.setDefaultCategory, {
      transactionType: 'income',
      categoryId,
    });
    expect(await authenticated.mutation(api.categories.mutations.archive, { categoryId })).toBe(
      categoryId,
    );
    const categories = await authenticated.query(api.categories.queries.list, {});
    expect(categories).toEqual([]);
    const archivedUser = await authenticated.query(api.users.queries.current, {});
    expect(archivedUser?.defaultExpenseCategoryId).toBeUndefined();
    expect(archivedUser?.defaultIncomeCategoryId).toBeUndefined();

    await authenticated.mutation(api.users.mutations.setDefaultAccount, { accountId });
    expect(await authenticated.mutation(api.accounts.mutations.archive, { accountId })).toBe(
      accountId,
    );
    expect(await authenticated.query(api.accounts.queries.list, {})).toEqual([]);
    expect(
      (await authenticated.query(api.users.queries.current, {}))?.defaultAccountId,
    ).toBeUndefined();
  });

  it('persists defaults and limits while isolating monthly spending by owner', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
        defaultCurrency: 'INR',
      });
      await ctx.db.insert('users', {
        identityId: 'other-owner',
        email: 'other-owner@example.com',
        defaultCurrency: 'INR',
      });
    });
    const owner = t.withIdentity(identity);
    const other = t.withIdentity({ subject: 'other-owner', email: 'other-owner@example.com' });
    const accountId = await owner.mutation(api.accounts.mutations.create, {
      name: 'Cash',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 100000n,
      isIncludedInTotal: true,
    });
    const categoryId = await owner.mutation(api.categories.mutations.create, {
      name: 'Groceries',
    });
    await owner.mutation(api.users.mutations.setDefaultAccount, { accountId });
    await owner.mutation(api.users.mutations.setDefaultCategory, {
      transactionType: 'expense',
      categoryId,
    });
    await owner.mutation(api.users.mutations.setDefaultCategory, {
      transactionType: 'income',
      categoryId,
    });
    await owner.mutation(api.categories.mutations.setIcon, { categoryId, icon: '🛒' });
    expect((await owner.query(api.categories.queries.detail, { categoryId }))?.category.icon).toBe(
      '🛒',
    );
    await expect(
      other.mutation(api.categories.mutations.setIcon, { categoryId, icon: '🚕' }),
    ).rejects.toThrow('INVALID_CATEGORY');
    await owner.mutation(api.categories.mutations.setLimit, {
      categoryId,
      amountMinor: 50000n,
      currency: 'INR',
    });
    expect(await owner.query(api.users.queries.current, {})).toMatchObject({
      defaultAccountId: accountId,
      defaultExpenseCategoryId: categoryId,
      defaultIncomeCategoryId: categoryId,
    });
    await expect(
      other.mutation(api.categories.mutations.setLimit, {
        categoryId,
        amountMinor: 100n,
        currency: 'INR',
      }),
    ).rejects.toThrow('INVALID_CATEGORY');

    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    for (const [amountMinor, occurredAt, clientMutationId] of [
      [25000n, Date.now(), 'this-month'],
      [60000n, previousMonth.getTime(), 'previous-month'],
    ] as const) {
      await owner.mutation(api.transactions.mutations.create, {
        accountId,
        categoryId,
        type: 'expense',
        amountMinor,
        currency: 'INR',
        title: 'Groceries',
        occurredAt,
        clientMutationId,
      });
    }
    await owner.mutation(api.transactions.mutations.create, {
      accountId,
      categoryId,
      type: 'income',
      amountMinor: 12000n,
      currency: 'INR',
      title: 'Refund',
      occurredAt: Date.now(),
      clientMutationId: 'same-category-income',
    });
    const detail = await owner.query(api.categories.queries.detail, { categoryId });
    expect(detail?.monthSpentMinor).toBe(25000n);
    expect(detail?.monthReceivedMinor).toBe(12000n);
    expect(detail?.category.monthlyLimitMinor).toBe(50000n);
    expect(detail?.transactions).toHaveLength(3);
    const categoryOverview = await owner.query(api.categories.queries.overview, {});
    expect(categoryOverview.find((item) => item._id === categoryId)).toMatchObject({
      icon: '🛒',
      monthSpentMinor: 25000n,
      monthReceivedMinor: 12000n,
      monthCurrency: 'INR',
    });
    expect(await other.query(api.categories.queries.detail, { categoryId })).toBeNull();
    expect(await owner.query(api.accounts.queries.list, {})).toMatchObject([
      { id: accountId, balanceMinor: 27000n },
    ]);
    const startAt = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const summary = await owner.query(api.dashboard.queries.summary, { startAt, endAt });
    expect(summary?.spentMinor).toBe(25000n);
    expect(summary?.chart.reduce((total, value) => total + value, 0)).toBe(250);
    expect(summary?.recent).toHaveLength(3);
    expect((await other.query(api.dashboard.queries.summary, { startAt, endAt }))?.spentMinor).toBe(
      0n,
    );
    const analyticsStartAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const analyticsEndAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const previousStartAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const analyticsRange = {
      period: 'month' as const,
      startAt: analyticsStartAt,
      endAt: analyticsEndAt,
      previousStartAt,
    };
    expect(await owner.query(api.analytics.queries.summary, analyticsRange)).toMatchObject({
      currency: 'INR',
      spentMinor: 25000n,
      previousSpentMinor: 60000n,
      categoryBreakdown: [{ label: 'Groceries', amountMinor: 25000n }],
    });
    expect((await other.query(api.analytics.queries.summary, analyticsRange))?.spentMinor).toBe(0n);
    await owner.mutation(api.categories.mutations.setLimit, { categoryId, amountMinor: null });
    await owner.mutation(api.users.mutations.setDefaultCategory, {
      transactionType: 'expense',
      categoryId: null,
    });
    expect(
      (await owner.query(api.categories.queries.detail, { categoryId }))?.category
        .monthlyLimitMinor,
    ).toBeUndefined();
    expect(
      (await owner.query(api.users.queries.current, {}))?.defaultExpenseCategoryId,
    ).toBeUndefined();
    expect((await owner.query(api.users.queries.current, {}))?.defaultIncomeCategoryId).toBe(
      categoryId,
    );
  });
  it('keeps account detail and lifecycle actions owner-scoped', async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
        defaultCurrency: 'INR',
      }),
    );
    const owner = t.withIdentity(identity);
    const other = t.withIdentity({ subject: 'other-owner', email: 'other@example.com' });
    const accountId = await owner.mutation(api.accounts.mutations.create, {
      name: 'Daily account',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 10000n,
      isIncludedInTotal: true,
    });
    await owner.mutation(api.transactions.mutations.create, {
      accountId,
      type: 'expense',
      amountMinor: 2500n,
      currency: 'INR',
      title: 'Groceries',
      occurredAt: Date.now(),
      clientMutationId: 'account-detail-expense',
    });

    expect(await owner.query(api.accounts.queries.detail, { accountId })).toMatchObject({
      account: { name: 'Daily account' },
      balanceMinor: 7500n,
    });
    await expect(other.query(api.accounts.queries.detail, { accountId })).resolves.toBeNull();
    await expect(
      other.mutation(api.accounts.mutations.rename, { accountId, name: 'Stolen' }),
    ).rejects.toThrow('ACCOUNT_UNAVAILABLE');
    await owner.mutation(api.accounts.mutations.rename, { accountId, name: 'Everyday' });
    expect((await owner.query(api.accounts.queries.detail, { accountId }))?.account.name).toBe(
      'Everyday',
    );
    await owner.mutation(api.accounts.mutations.archive, { accountId });
    expect(await owner.query(api.accounts.queries.list, {})).toEqual([]);
  });
  it('creates and isolates database-backed budget totals and lifecycle', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
        defaultCurrency: 'INR',
      });
      await ctx.db.insert('users', {
        identityId: 'other-budget-owner',
        email: 'other-budget@example.com',
        defaultCurrency: 'INR',
      });
    });
    const owner = t.withIdentity(identity);
    const other = t.withIdentity({
      subject: 'other-budget-owner',
      email: 'other-budget@example.com',
    });
    const accountId = await owner.mutation(api.accounts.mutations.create, {
      name: 'Cash',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 100000n,
      isIncludedInTotal: true,
    });
    const categoryId = await owner.mutation(api.categories.mutations.create, {
      name: 'Groceries',
    });
    const now = new Date();
    const startAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const endAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const budgetId = await owner.mutation(api.budgets.mutations.create, {
      name: 'Groceries',
      amountMinor: 30000n,
      currency: 'INR',
      period: 'category',
      categoryId,
      startAt,
      endAt,
    });
    await owner.mutation(api.transactions.mutations.create, {
      accountId,
      categoryId,
      type: 'expense',
      amountMinor: 7500n,
      currency: 'INR',
      title: 'Market',
      occurredAt: Date.now(),
      clientMutationId: 'budget-market-expense',
    });
    await owner.mutation(api.transactions.mutations.create, {
      accountId,
      categoryId,
      type: 'income',
      amountMinor: 5000n,
      currency: 'INR',
      title: 'Refund',
      occurredAt: Date.now(),
      clientMutationId: 'budget-category-income',
    });
    expect(await owner.query(api.budgets.queries.detail, { budgetId })).toMatchObject({
      spentMinor: 7500n,
      remainingMinor: 22500n,
    });
    await expect(other.query(api.budgets.queries.detail, { budgetId })).resolves.toBeNull();
    await owner.mutation(api.budgets.mutations.archive, { budgetId });
    expect(await owner.query(api.budgets.queries.list, {})).toEqual([]);
  });

  it('persists a transaction and rejects replayed client mutation IDs', async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
      }),
    );
    const authenticated = t.withIdentity(identity);
    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'Cash',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });

    const input = {
      accountId,
      type: 'expense' as const,
      amountMinor: 42000n,
      currency: 'INR',
      title: 'Dinner',
      merchant: 'Local kitchen',
      occurredAt: Date.UTC(2026, 7, 27),
      clientMutationId: 'runtime-transaction-1',
    };
    const transactionId = await authenticated.mutation(api.transactions.mutations.create, input);
    const transferAccountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'Savings',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
    const transferId = await authenticated.mutation(api.transactions.mutations.create, {
      accountId,
      transferAccountId,
      type: 'transfer',
      amountMinor: 10000n,
      currency: 'INR',
      title: 'Move to savings',
      occurredAt: Date.UTC(2026, 7, 27),
      clientMutationId: 'runtime-transfer-1',
    });
    expect(await t.run((ctx) => ctx.db.get(transferId))).toMatchObject({
      accountId,
      transferAccountId,
      type: 'transfer',
      amountMinor: 10000n,
      status: 'posted',
    });
    expect(transactionId).toEqual(expect.any(String));
    await expect(authenticated.mutation(api.transactions.mutations.create, input)).resolves.toBe(
      transactionId,
    );

    const transaction = await t.run((ctx) => ctx.db.get(transactionId));
    expect(transaction).toMatchObject({
      ownerId: expect.any(String),
      accountId,
      type: 'expense',
      amountMinor: 42000n,
      status: 'posted',
      title: 'Dinner',
    });
  });
  it('updates profile identity and discovers tagged users', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
        phone: '+919876543210',
        phoneVerificationTime: 1234,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert('userSettings', {
        userId,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'dark',
        notificationPreferences: {},
        appLockPreferences: { enabled: false, fallback: 'device-pin' },
        updatedAt: Date.now(),
      }),
    );
    const otherUserId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: 'other-runtime-user',
        email: 'rahul@example.com',
        name: 'Rahul',
        username: 'rahul_42',
      }),
    );
    const authenticated = t.withIdentity(identity);

    const usernameUpdated = await authenticated.mutation(api.users.mutations.update, {
      username: '@Neeraj_27',
    });
    expect(usernameUpdated).toMatchObject({
      phone: '+919876543210',
      phoneVerificationTime: 1234,
    });
    const updated = await authenticated.mutation(api.users.mutations.update, {
      phone: '+91 (98765) 43210',
      defaultCurrency: 'USD',
      timezone: 'Asia/Kolkata',
    });
    expect(updated).toMatchObject({
      _id: userId,
      username: 'neeraj_27',
      phone: '+919876543210',
      phoneVerificationTime: 1234,
      defaultCurrency: 'USD',
      timezone: 'Asia/Kolkata',
    });
    expect(await authenticated.query(api.users.queries.current, {})).toMatchObject({
      username: 'neeraj_27',
      phone: '+919876543210',
      defaultCurrency: 'USD',
      timezone: 'Asia/Kolkata',
    });
    expect(await t.run((ctx) => ctx.db.get(userId))).toMatchObject({
      defaultCurrency: 'USD',
    });
    const updatedSettings = await t.run((ctx) =>
      ctx.db
        .query('userSettings')
        .withIndex('by_user', (query) => query.eq('userId', userId))
        .unique(),
    );
    expect(updatedSettings).toMatchObject({
      currency: 'USD',
      timezone: 'Asia/Kolkata',
    });
    await expect(
      authenticated.mutation(api.users.mutations.update, {
        timezone: 'Mars/Olympus_Mons',
      }),
    ).rejects.toThrow('INVALID_TIMEZONE');
    expect(await authenticated.query(api.users.queries.search, { query: '@rah' })).toEqual([
      {
        id: otherUserId,
        displayName: 'Rahul',
        username: 'rahul_42',
        image: undefined,
      },
    ]);
    await expect(
      authenticated.mutation(api.users.mutations.update, { username: '@rahul_42' }),
    ).rejects.toThrow('USERNAME_TAKEN');

    const changedPhone = await authenticated.mutation(api.users.mutations.update, {
      phone: '+91 99999 88888',
    });
    expect(changedPhone.phone).toBe('+919999988888');
    expect(changedPhone.phoneVerificationTime).toBeUndefined();
    const storedUser = await t.run((ctx) => ctx.db.get(userId));
    expect(storedUser?.phoneVerificationTime).toBeUndefined();
  });
  it('requires a manually verified phone before creating contact invites', async () => {
    const t = convexTest(schema, modules);
    const ownerId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
      }),
    );
    const authenticated = t.withIdentity(identity);
    const input = {
      name: 'Contact invite group',
      currency: 'INR',
      memberUsernames: [],
      memberPhones: ['+919111111111'],
    };

    await expect(authenticated.mutation(api.groups.mutations.create, input)).rejects.toThrow(
      'PHONE_UNVERIFIED',
    );
    expect(await t.run((ctx) => ctx.db.query('groups').collect())).toHaveLength(0);

    await t.run((ctx) =>
      ctx.db.patch(ownerId, { phone: '+919000000000', phoneVerificationTime: 1234 }),
    );
    const groupId = await authenticated.mutation(api.groups.mutations.create, input);
    expect(await t.run((ctx) => ctx.db.query('groupInvites').collect())).toMatchObject([
      { groupId, inviteePhone: '+919111111111', status: 'pending' },
    ]);
  });
  it('creates username groups and persists shared expenses', async () => {
    const t = convexTest(schema, modules);
    const ownerId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
        username: 'neeraj',
      }),
    );
    const memberId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: 'group-member',
        email: 'rahul@example.com',
        name: 'Rahul',
        username: 'rahul_42',
      }),
    );
    const authenticated = t.withIdentity(identity);
    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'HDFC',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 100000n,
      isIncludedInTotal: true,
    });
    const groupId = await authenticated.mutation(api.groups.mutations.create, {
      name: 'Goa Trip',
      currency: 'INR',
      memberUsernames: ['@rahul_42'],
    });
    expect(await authenticated.query(api.groups.queries.list, {})).toMatchObject([
      { _id: groupId, name: 'Goa Trip', currency: 'INR', ownerId },
    ]);
    const transactionId = await authenticated.mutation(api.groups.mutations.addExpense, {
      groupId,
      accountId,
      title: 'Hotel',
      amountMinor: 240000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 7, 27),
      participants: [
        { userId: ownerId, amountMinor: 120000n, method: 'equal' },
        { userId: memberId, amountMinor: 120000n, method: 'equal' },
      ],
    });
    const detail = await authenticated.query(api.groups.queries.detail, { groupId });
    expect(detail).toMatchObject({
      _id: groupId,
      members: [
        { id: ownerId, role: 'owner' },
        { id: memberId, username: 'rahul_42', role: 'member' },
      ],
      expenses: [{ _id: transactionId, title: 'Hotel', amountMinor: 240000n }],
    });
    expect(await t.run((ctx) => ctx.db.query('expenseParticipants').collect())).toMatchObject([
      { transactionId, userId: ownerId, amountMinor: 120000n, method: 'equal' },
      { transactionId, userId: memberId, amountMinor: 120000n, method: 'equal' },
    ]);
    expect(
      await authenticated.query(api.groups.queries.personTimeline, { username: '@rahul_42' }),
    ).toMatchObject([{ id: transactionId, title: 'Hotel', amountMinor: 240000n }]);
    const settlement = {
      groupId,
      fromUserId: memberId,
      toUserId: ownerId,
      accountId,
      amountMinor: 60000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 7, 28),
      clientMutationId: 'group-payment-1',
    };
    const settlementId = await authenticated.mutation(api.settlements.mutations.create, settlement);
    expect(await authenticated.mutation(api.settlements.mutations.create, settlement)).toBe(
      settlementId,
    );
    expect(await t.run((ctx) => ctx.db.query('settlements').collect())).toMatchObject([
      { _id: settlementId, fromUserId: memberId, toUserId: ownerId, amountMinor: 60000n },
    ]);
    await expect(
      authenticated.mutation(api.settlements.mutations.create, {
        ...settlement,
        clientMutationId: 'group-payment-2',
        amountMinor: 60001n,
      }),
    ).rejects.toThrow('SETTLEMENT_EXCEEDS_BALANCE');
  });

  it('rejects mutation attempts without an authenticated identity', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.accounts.mutations.create, {
        name: 'Cash',
        type: 'cash',
        currency: 'INR',
        openingBalanceMinor: 0n,
        isIncludedInTotal: true,
      }),
    ).rejects.toThrow('AUTH_REQUIRED');
  });
});
