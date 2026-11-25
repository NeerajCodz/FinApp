/**
 * BYOK keys: add (checked against the provider, then encrypted), list (no secrets), choose the
 * active one, re-check, remove. `chatForUser` builds the agent's chat function from the active
 * key; with no active key FinAI runs on Finapp's built-in model.
 */
import { v } from 'convex/values';
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from '../_generated/server';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { getOptionalUser, requireUser } from '../shared/auth';
import {
  AI_KEY_LIMITS,
  AI_PROVIDERS,
  isAiProviderId,
  keyHint,
  validCustomBaseUrl,
  type AiProviderId,
} from '../shared/aiProviders';
import { decryptSecret, encryptSecret, isVaultConfigured } from './keyVault';
import { checkProviderKey, providerChat, type ChatFn } from './providers';

const statusOf = (result: Awaited<ReturnType<typeof checkProviderKey>>) =>
  result === null
    ? ('ok' as const)
    : result === 'AI_KEY_INVALID'
      ? ('invalid' as const)
      : ('unreachable' as const);

/** Your keys, newest first, without the secret. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return { keys: [], vault: isVaultConfigured() };
    const rows = await ctx.db
      .query('aiProviderKeys')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .take(AI_KEY_LIMITS.keys);
    return {
      vault: isVaultConfigured(),
      keys: rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((row) => ({
          id: row._id,
          provider: row.provider as AiProviderId,
          label: row.label,
          model: row.model,
          baseUrl: row.baseUrl,
          keyHint: row.keyHint,
          active: row.active,
          status: row.status,
          lastCheckedAt: row.lastCheckedAt,
          createdAt: row.createdAt,
        })),
    };
  },
});

export const insertKey = internalMutation({
  args: {
    provider: v.string(),
    label: v.string(),
    model: v.string(),
    baseUrl: v.optional(v.string()),
    encryptedKey: v.string(),
    keyHint: v.string(),
    status: v.union(v.literal('ok'), v.literal('invalid'), v.literal('unreachable')),
    makeActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const rows = await ctx.db
      .query('aiProviderKeys')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    if (rows.length >= AI_KEY_LIMITS.keys) throw new Error('TOO_MANY_KEYS');
    if (args.makeActive)
      for (const row of rows) if (row.active) await ctx.db.patch(row._id, { active: false });
    const now = Date.now();
    const { makeActive, ...fields } = args;
    return ctx.db.insert('aiProviderKeys', {
      userId: user._id,
      ...fields,
      active: makeActive,
      lastCheckedAt: now,
      createdAt: now,
    });
  },
});

/** The signed-in user's id inside an action. */
async function actionUserId(ctx: ActionCtx): Promise<Id<'users'>> {
  const user = await ctx.runQuery(internal.ai.keys.me, {});
  if (!user) throw new Error('AUTH_REQUIRED');
  return user;
}

export const me = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    return user && user.deletedAt === undefined ? user._id : null;
  },
});

/** Adds a key: validates the inputs, checks the key with the provider, then encrypts it. */
export const add = action({
  args: {
    provider: v.string(),
    apiKey: v.string(),
    model: v.string(),
    label: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    makeActive: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ id: Id<'aiProviderKeys'>; status: 'ok' | 'invalid' | 'unreachable' }> => {
    const userId = await actionUserId(ctx);
    if (!isVaultConfigured()) throw new Error('AI_KEYS_NOT_CONFIGURED');
    if (!isAiProviderId(args.provider)) throw new Error('UNKNOWN_PROVIDER');
    const apiKey = args.apiKey.trim();
    const model = args.model.trim();
    if (!apiKey || apiKey.length > AI_KEY_LIMITS.key || /\s/.test(apiKey))
      throw new Error('INVALID_KEY');
    if (!model || model.length > AI_KEY_LIMITS.model) throw new Error('INVALID_MODEL');
    const baseUrl = args.baseUrl?.trim() || undefined;
    if (
      args.provider === 'custom'
        ? !baseUrl || !validCustomBaseUrl(baseUrl)
        : baseUrl && !validCustomBaseUrl(baseUrl)
    )
      throw new Error('INVALID_BASE_URL');
    const check = await checkProviderKey({ provider: args.provider, apiKey, baseUrl });
    if (check === 'AI_KEY_INVALID') throw new Error('AI_KEY_INVALID');
    const label = (args.label?.trim() || `${AI_PROVIDERS[args.provider].label} · ${model}`).slice(
      0,
      AI_KEY_LIMITS.label,
    );
    const id = await ctx.runMutation(internal.ai.keys.insertKey, {
      provider: args.provider,
      label,
      model,
      ...(baseUrl ? { baseUrl } : {}),
      encryptedKey: await encryptSecret(apiKey, String(userId)),
      keyHint: keyHint(apiKey),
      status: statusOf(check),
      makeActive: args.makeActive ?? true,
    });
    return { id, status: statusOf(check) };
  },
});

/** Makes a key the one FinAI uses, or (null) switches back to Finapp's built-in model. */
export const setActive = mutation({
  args: { keyId: v.union(v.id('aiProviderKeys'), v.null()) },
  handler: async (ctx, { keyId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const rows = await ctx.db
      .query('aiProviderKeys')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    if (keyId && !rows.some((row) => row._id === keyId)) throw new Error('KEY_NOT_FOUND');
    for (const row of rows) {
      const active = row._id === keyId;
      if (row.active !== active) await ctx.db.patch(row._id, { active });
    }
    return null;
  },
});

export const update = mutation({
  args: {
    keyId: v.id('aiProviderKeys'),
    label: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, { keyId, label, model }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const row = await ctx.db.get(keyId);
    if (!row || row.userId !== user._id) throw new Error('KEY_NOT_FOUND');
    const patch: { label?: string; model?: string } = {};
    if (label !== undefined) {
      if (!label.trim() || label.length > AI_KEY_LIMITS.label) throw new Error('INVALID_LABEL');
      patch.label = label.trim();
    }
    if (model !== undefined) {
      if (!model.trim() || model.length > AI_KEY_LIMITS.model) throw new Error('INVALID_MODEL');
      patch.model = model.trim();
    }
    await ctx.db.patch(keyId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { keyId: v.id('aiProviderKeys') },
  handler: async (ctx, { keyId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const row = await ctx.db.get(keyId);
    if (!row || row.userId !== user._id) throw new Error('KEY_NOT_FOUND');
    await ctx.db.delete(keyId);
    return null;
  },
});

export const record = internalQuery({
  args: { keyId: v.id('aiProviderKeys') },
  handler: async (ctx, { keyId }) => ctx.db.get(keyId),
});

export const activeRecord = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('aiProviderKeys')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return rows.find((row) => row.active) ?? null;
  },
});

export const setStatus = internalMutation({
  args: {
    keyId: v.id('aiProviderKeys'),
    status: v.union(v.literal('ok'), v.literal('invalid'), v.literal('unreachable')),
  },
  handler: async (ctx, { keyId, status }) => {
    if (await ctx.db.get(keyId)) await ctx.db.patch(keyId, { status, lastCheckedAt: Date.now() });
  },
});

/** Re-checks a saved key with its provider. */
export const test = action({
  args: { keyId: v.id('aiProviderKeys') },
  handler: async (ctx, { keyId }): Promise<'ok' | 'invalid' | 'unreachable'> => {
    const userId = await actionUserId(ctx);
    const row = await ctx.runQuery(internal.ai.keys.record, { keyId });
    if (!row || row.userId !== userId || !isAiProviderId(row.provider))
      throw new Error('KEY_NOT_FOUND');
    const apiKey = await decryptSecret(row.encryptedKey, String(userId));
    const status = statusOf(
      await checkProviderKey({
        provider: row.provider,
        apiKey,
        ...(row.baseUrl ? { baseUrl: row.baseUrl } : {}),
      }),
    );
    await ctx.runMutation(internal.ai.keys.setStatus, { keyId, status });
    return status;
  },
});

/**
 * The chat function for a user's active key, or undefined (built-in model). Also returns a
 * callback that marks the key invalid when the provider rejects it mid-chat.
 */
export async function chatForUser(
  ctx: ActionCtx,
  userId: Id<'users'>,
): Promise<{ chat?: ChatFn; markInvalid: () => Promise<void> }> {
  const none = { markInvalid: async () => undefined };
  if (!isVaultConfigured()) return none;
  const row = await ctx.runQuery(internal.ai.keys.activeRecord, { userId });
  if (!row || !isAiProviderId(row.provider)) return none;
  let apiKey: string;
  try {
    apiKey = await decryptSecret(row.encryptedKey, String(userId));
  } catch {
    return none;
  }
  return {
    chat: providerChat({
      provider: row.provider,
      apiKey,
      model: row.model,
      ...(row.baseUrl ? { baseUrl: row.baseUrl } : {}),
    }),
    markInvalid: async () => {
      await ctx.runMutation(internal.ai.keys.setStatus, { keyId: row._id, status: 'invalid' });
    },
  };
}
