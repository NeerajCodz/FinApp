/** FinAI preferences: read, update (partial, validated) and clear history. */
import { v } from 'convex/values';
import { internalQuery, mutation, query, type QueryCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { getOptionalUser, requireUser } from '../shared/auth';
import { deleteConversationAttachments } from './attachments';
import {
  FINAI_ATTACHMENT_RETENTIONS,
  FINAI_DATA_SCOPES,
  FINAI_LANGUAGES,
  FINAI_LENGTHS,
  FINAI_LIMITS,
  FINAI_TONES,
  resolveFinaiSettings,
  type FinaiSettings,
} from '../shared/finaiSettings';

async function stored(ctx: QueryCtx, userId: Id<'users'>) {
  return ctx.db
    .query('finaiSettings')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

export async function loadFinaiSettings(ctx: QueryCtx, userId: Id<'users'>) {
  const row = await stored(ctx, userId);
  return resolveFinaiSettings(row?.settings as Partial<FinaiSettings> | undefined);
}

/** The signed-in user's FinAI settings (defaults when signed out or never saved). */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return resolveFinaiSettings(null);
    return loadFinaiSettings(ctx, user._id);
  },
});

/** For actions (assistant, mentions, receipts): one user's resolved settings. */
export const forUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => loadFinaiSettings(ctx, userId),
});

const literalUnion = <T extends readonly string[]>(values: T) =>
  v.union(...(values.map((value) => v.literal(value)) as [ReturnType<typeof v.literal>]));

export const update = mutation({
  args: {
    enabled: v.optional(v.boolean()),
    tone: v.optional(literalUnion(FINAI_TONES)),
    length: v.optional(literalUnion(FINAI_LENGTHS)),
    language: v.optional(literalUnion(FINAI_LANGUAGES)),
    customInstructions: v.optional(v.string()),
    aboutMe: v.optional(v.string()),
    useEmoji: v.optional(v.boolean()),
    dataScopes: v.optional(
      v.object({
        money: v.optional(v.boolean()),
        planning: v.optional(v.boolean()),
        groups: v.optional(v.boolean()),
        people: v.optional(v.boolean()),
      }),
    ),
    allowActions: v.optional(v.boolean()),
    allowChatMentions: v.optional(v.boolean()),
    autoCategorizeReceipts: v.optional(v.boolean()),
    showSteps: v.optional(v.boolean()),
    showLauncher: v.optional(v.boolean()),
    allowAttachments: v.optional(v.boolean()),
    attachmentRetention: v.optional(literalUnion(FINAI_ATTACHMENT_RETENTIONS)),
  },
  handler: async (ctx, patch) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if ((patch.customInstructions?.length ?? 0) > FINAI_LIMITS.customInstructions)
      throw new Error('TEXT_TOO_LONG');
    if ((patch.aboutMe?.length ?? 0) > FINAI_LIMITS.aboutMe) throw new Error('TEXT_TOO_LONG');
    const row = await stored(ctx, user._id);
    const current = resolveFinaiSettings(row?.settings as Partial<FinaiSettings> | undefined);
    const { dataScopes, ...rest } = patch;
    const scopes = { ...current.dataScopes };
    if (dataScopes)
      for (const scope of FINAI_DATA_SCOPES)
        if (typeof dataScopes[scope] === 'boolean') scopes[scope] = dataScopes[scope]!;
    const next = resolveFinaiSettings({
      ...current,
      ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
      dataScopes: scopes,
    });
    if (row) await ctx.db.patch(row._id, { settings: next, updatedAt: Date.now() });
    else
      await ctx.db.insert('finaiSettings', {
        userId: user._id,
        settings: next,
        updatedAt: Date.now(),
      });
    return next;
  },
});

/** Deletes every FinAI conversation (and their prepared cards) for the signed-in user. */
export const clearHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const conversations = await ctx.db
      .query('finaiConversations')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', user._id))
      .take(100);
    let deleted = 0;
    for (const conversation of conversations) {
      const rows = await ctx.db
        .query('finaiMessages')
        .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversation._id))
        .collect();
      for (const row of rows) {
        const actions = await ctx.db
          .query('finaiActions')
          .withIndex('by_message', (q) => q.eq('messageId', String(row._id)))
          .collect();
        for (const action of actions) await ctx.db.delete(action._id);
        await ctx.db.delete(row._id);
      }
      await deleteConversationAttachments(ctx, conversation._id);
      await ctx.db.delete(conversation._id);
      deleted += 1;
    }
    // More than 100 threads: the client calls again until `more` is false.
    return { deleted, more: conversations.length === 100 };
  },
});
