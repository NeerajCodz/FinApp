import { mutation } from '../_generated/server';
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { validateBillImageMetadata } from '../groups/domain';

async function getConversationForParticipant(
  ctx: MutationCtx,
  conversationId: Id<'directConversations'>,
  userId: Id<'users'>,
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || (conversation.userLowId !== userId && conversation.userHighId !== userId))
    throw new Error('CONVERSATION_UNAVAILABLE');
  return conversation;
}

export const startConversation = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    if (actor._id === userId) throw new Error('CANNOT_MESSAGE_SELF');
    const other = await ctx.db.get(userId);
    if (!other || other.deletedAt !== undefined) throw new Error('USER_UNAVAILABLE');
    const low = String(actor._id) < String(userId) ? actor._id : userId;
    const high = low === actor._id ? userId : actor._id;
    const friendship = await ctx.db
      .query('friendships')
      .withIndex('by_pair', (q) => q.eq('userLowId', low).eq('userHighId', high))
      .unique();
    if (!friendship) throw new Error('FRIENDSHIP_REQUIRED');
    const existing = await ctx.db
      .query('directConversations')
      .withIndex('by_pair', (q) => q.eq('userLowId', low).eq('userHighId', high))
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert('directConversations', {
      userLowId: low,
      userHighId: high,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createImageUpload = mutation({
  args: { conversationId: v.id('directConversations') },
  handler: async (ctx, { conversationId }) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    await getConversationForParticipant(ctx, conversationId, actor._id);
    const ticket = crypto.randomUUID();
    await ctx.db.insert('directUploadTickets', {
      ticket,
      userId: actor._id,
      conversationId,
      createdAt: Date.now(),
    });
    return { uploadUrl: await ctx.storage.generateUploadUrl(), ticket };
  },
});

export const sendText = mutation({
  args: { conversationId: v.id('directConversations'), text: v.string() },
  handler: async (ctx, { conversationId, text }) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const conversation = await getConversationForParticipant(ctx, conversationId, actor._id);
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 4000) throw new Error('INVALID_CHAT_TEXT');
    const createdAt = Date.now();
    const messageId = await ctx.db.insert('directMessages', {
      conversationId,
      senderId: actor._id,
      kind: 'text',
      text: trimmed,
      createdAt,
    });
    await ctx.db.patch(conversation._id, { updatedAt: createdAt });
    return messageId;
  },
});

export const sendImage = mutation({
  args: {
    conversationId: v.id('directConversations'),
    storageId: v.id('_storage'),
    ticket: v.string(),
  },
  handler: async (ctx, { conversationId, storageId, ticket }) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const conversation = await getConversationForParticipant(ctx, conversationId, actor._id);
    const upload = await ctx.db
      .query('directUploadTickets')
      .withIndex('by_ticket', (q) => q.eq('ticket', ticket))
      .unique();
    if (
      !upload ||
      upload.userId !== actor._id ||
      upload.conversationId !== conversationId ||
      upload.usedAt !== undefined
    )
      throw new Error('INVALID_UPLOAD_TICKET');
    const metadata = await ctx.storage.getMetadata(storageId);
    if (!metadata) throw new Error('INVALID_IMAGE');
    const mimeType = validateBillImageMetadata(metadata);
    if (!mimeType) {
      await ctx.storage.delete(storageId);
      throw new Error('INVALID_IMAGE');
    }
    const [existingDirect, existingGroup] = await Promise.all([
      ctx.db
        .query('directMessages')
        .withIndex('by_storage', (q) => q.eq('storageId', storageId))
        .unique(),
      ctx.db
        .query('groupMessages')
        .withIndex('by_storage', (q) => q.eq('storageId', storageId))
        .unique(),
    ]);
    if (existingDirect || existingGroup) throw new Error('IMAGE_ALREADY_ATTACHED');
    const createdAt = Date.now();
    const messageId = await ctx.db.insert('directMessages', {
      conversationId,
      senderId: actor._id,
      kind: 'image',
      storageId,
      mimeType,
      size: metadata.size,
      createdAt,
    });
    await ctx.db.patch(upload._id, { usedAt: createdAt });
    await ctx.db.patch(conversation._id, { updatedAt: createdAt });
    return messageId;
  },
});
