import { v } from 'convex/values';
import { mutation, type MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { requireUser } from '../shared/auth';
import { recordAudit } from '../publicApi/audit';
import { isActiveUser, MAX_ACTIVE_TOKENS } from '../publicApi/principal';
import { parseScopes } from '../publicApi/scopes';
import { hashToken, randomToken, resolveExpiry, tokenPrefix } from '../publicApi/tokens';

const expiryValidator = v.union(
  v.object({
    preset: v.union(v.literal('never'), v.literal('7d'), v.literal('30d'), v.literal('90d')),
  }),
  v.object({ customAt: v.number() }),
);

const DAY = 86_400_000;

async function activeUser(ctx: MutationCtx) {
  const user = await requireUser(ctx);
  if (!isActiveUser(user)) throw new Error('AUTH_REQUIRED');
  return user;
}

function cleanName(name: string) {
  const value = name.trim();
  if (!value || value.length > 80) throw new Error('INVALID_TOKEN_NAME');
  return value;
}

async function ownedToken(ctx: MutationCtx, userId: Id<'users'>, tokenId: string) {
  const id = ctx.db.normalizeId('personalAccessTokens', tokenId);
  const token = id ? await ctx.db.get(id) : null;
  if (!token || token.userId !== userId) throw new Error('TOKEN_NOT_FOUND');
  return token;
}

function isLive(token: Doc<'personalAccessTokens'>, now: number) {
  return token.revokedAt === undefined && (token.expiresAt === undefined || token.expiresAt > now);
}

/** Creates a token and returns its plaintext once; only the digest and prefix are stored. */
export const create = mutation({
  args: { name: v.string(), scopes: v.array(v.string()), expiry: expiryValidator },
  handler: async (ctx, args) => {
    const user = await activeUser(ctx);
    const name = cleanName(args.name);
    const parsed = parseScopes(args.scopes);
    if (!parsed.ok || parsed.scopes.length === 0) throw new Error('INVALID_SCOPE');
    const now = Date.now();
    const existing = await ctx.db
      .query('personalAccessTokens')
      .withIndex('by_user_createdAt', (index) => index.eq('userId', user._id))
      .collect();
    if (existing.filter((token) => isLive(token, now)).length >= MAX_ACTIVE_TOKENS)
      throw new Error('TOO_MANY_TOKENS');
    const expiresAt = resolveExpiry(args.expiry, now);
    const token = randomToken('pat');
    const tokenId = await ctx.db.insert('personalAccessTokens', {
      userId: user._id,
      name,
      tokenPrefix: tokenPrefix(token),
      tokenHash: await hashToken(token),
      scopes: parsed.scopes,
      ...(expiresAt === undefined
        ? {}
        : { expiresAt, expiryDays: Math.max(1, Math.round((expiresAt - now) / DAY)) }),
      createdAt: now,
    });
    await recordAudit(ctx, user._id, {
      kind: 'token.created',
      actorType: 'user',
      tokenId,
      label: name,
    });
    return { id: tokenId, token, tokenPrefix: tokenPrefix(token), expiresAt };
  },
});

/** Replaces the secret of a live token (same name and scopes); the old value stops working. */
export const regenerate = mutation({
  args: { tokenId: v.string() },
  handler: async (ctx, { tokenId }) => {
    const user = await activeUser(ctx);
    const existing = await ownedToken(ctx, user._id, tokenId);
    if (existing.revokedAt !== undefined) throw new Error('TOKEN_REVOKED');
    const now = Date.now();
    const token = randomToken('pat');
    const expiresAt =
      existing.expiryDays === undefined ? undefined : now + existing.expiryDays * DAY;
    await ctx.db.patch(existing._id, {
      tokenPrefix: tokenPrefix(token),
      tokenHash: await hashToken(token),
      expiresAt,
      regeneratedAt: now,
      lastUsedAt: undefined,
      lastUsedIpHash: undefined,
    });
    await recordAudit(ctx, user._id, {
      kind: 'token.regenerated',
      actorType: 'user',
      tokenId: existing._id,
      label: existing.name,
    });
    return { id: existing._id, token, tokenPrefix: tokenPrefix(token), expiresAt };
  },
});

export const revoke = mutation({
  args: { tokenId: v.string() },
  handler: async (ctx, { tokenId }) => {
    const user = await activeUser(ctx);
    const token = await ownedToken(ctx, user._id, tokenId);
    if (token.revokedAt === undefined) {
      await ctx.db.patch(token._id, { revokedAt: Date.now() });
      await recordAudit(ctx, user._id, {
        kind: 'token.revoked',
        actorType: 'user',
        tokenId: token._id,
        label: token.name,
      });
    }
    return { revoked: true };
  },
});

export const rename = mutation({
  args: { tokenId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const user = await activeUser(ctx);
    const token = await ownedToken(ctx, user._id, args.tokenId);
    await ctx.db.patch(token._id, { name: cleanName(args.name) });
    return { renamed: true };
  },
});
