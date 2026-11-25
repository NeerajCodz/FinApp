/**
 * FinAI chat attachments: images, PDFs, spreadsheets (.xlsx / .csv / .tsv) and text files up to
 * 10MB. The client gets an upload URL, uploads to Convex storage and registers the file; it's
 * linked to the user message when sent. Files are deleted from storage when they expire (the
 * FinAI "delete attachments after" setting, default 24h; uploads never sent after 1h). The rows
 * stay so chats still show what was attached.
 */
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server';
import { requireUser } from '../shared/auth';
import { attachmentRetentionMs } from '../shared/finaiSettings';
import { finaiAttachmentLimits } from './config';
import { aiError } from './errors';
import { storageInUse } from './receipts';
import { loadFinaiSettings } from './settings';

export type AttachmentKind = Doc<'finaiAttachments'>['kind'];

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const BY_EXTENSION: Record<string, { kind: AttachmentKind; mimeType: string }> = {
  jpg: { kind: 'image', mimeType: 'image/jpeg' },
  jpeg: { kind: 'image', mimeType: 'image/jpeg' },
  png: { kind: 'image', mimeType: 'image/png' },
  webp: { kind: 'image', mimeType: 'image/webp' },
  heic: { kind: 'image', mimeType: 'image/heic' },
  heif: { kind: 'image', mimeType: 'image/heif' },
  pdf: { kind: 'pdf', mimeType: 'application/pdf' },
  xlsx: { kind: 'spreadsheet', mimeType: XLSX_MIME },
  csv: { kind: 'spreadsheet', mimeType: 'text/csv' },
  tsv: { kind: 'spreadsheet', mimeType: 'text/tab-separated-values' },
  txt: { kind: 'text', mimeType: 'text/plain' },
  md: { kind: 'text', mimeType: 'text/markdown' },
  json: { kind: 'text', mimeType: 'application/json' },
};

const BY_MIME: Record<string, { kind: AttachmentKind; mimeType: string }> = Object.fromEntries(
  Object.values(BY_EXTENSION).map((entry) => [entry.mimeType, entry]),
);

/** What an upload is, from its file name (preferred) or declared type; null if unsupported. */
export function attachmentKind(
  name: string,
  contentType?: string | null,
): { kind: AttachmentKind; mimeType: string } | null {
  const extension = /\.([a-z0-9]{1,5})$/i.exec(name.trim())?.[1]?.toLowerCase();
  if (extension && BY_EXTENSION[extension]) return BY_EXTENSION[extension]!;
  const declared = contentType?.split(';')[0]?.trim().toLowerCase();
  if (declared === 'application/vnd.ms-excel' && extension === 'csv') return BY_EXTENSION.csv!;
  return (declared && BY_MIME[declared]) || null;
}

/** File names are shown in chats and prompts: printable, single-line, bounded. */
export function cleanFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'file').slice(0, 120);
}

/** The attachment shape clients render (with a short-lived URL while the file still exists). */
export async function presentAttachment(ctx: QueryCtx, row: Doc<'finaiAttachments'>) {
  const available = row.storageId !== undefined && row.deletedAt === undefined;
  return {
    id: row._id,
    name: row.name,
    kind: row.kind,
    mimeType: row.mimeType,
    size: row.size,
    ...(row.expiresAt !== undefined ? { expiresAt: row.expiresAt } : {}),
    available,
    ...(available && row.kind === 'image' && row.storageId
      ? { url: (await ctx.storage.getUrl(row.storageId)) ?? undefined }
      : {}),
  };
}

/** An upload URL plus the limits the client should enforce before uploading. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const settings = await loadFinaiSettings(ctx, user._id);
    if (!settings.enabled) throw aiError('AI_DISABLED');
    if (!settings.allowAttachments) throw new Error('ATTACHMENTS_DISABLED');
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      maxBytes: finaiAttachmentLimits.maxBytes,
      perMessage: finaiAttachmentLimits.perMessage,
      extensions: Object.keys(BY_EXTENSION),
    };
  },
});

/**
 * Records an uploaded file for the signed-in user. Files that are too big, empty or of an
 * unsupported type are deleted and reported as `{ error }` (returned, not thrown, so the
 * deletion commits). Uploads that are too old or already used elsewhere are refused untouched.
 */
export const register = mutation({
  args: { storageId: v.id('_storage'), name: v.string() },
  handler: async (ctx, { storageId, name }) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const file = await ctx.db.system.get('_storage', storageId);
    if (!file) throw new Error('UPLOAD_NOT_FOUND');
    const now = Date.now();
    if (
      now - file._creationTime > finaiAttachmentLimits.registerWindowMs ||
      (await storageInUse(ctx, storageId))
    )
      throw new Error('INVALID_UPLOAD');
    const fileName = cleanFileName(name);
    const type = attachmentKind(fileName, file.contentType);
    const error =
      file.size > finaiAttachmentLimits.maxBytes
        ? 'FILE_TOO_LARGE'
        : file.size <= 0
          ? 'FILE_EMPTY'
          : !type
            ? 'UNSUPPORTED_FILE'
            : null;
    if (error || !type) {
      await ctx.storage.delete(storageId);
      return { error: error ?? 'UNSUPPORTED_FILE' } as const;
    }
    const id = await ctx.db.insert('finaiAttachments', {
      userId: user._id,
      storageId,
      name: fileName,
      mimeType: type.mimeType,
      kind: type.kind,
      size: file.size,
      createdAt: now,
      expiresAt: now + finaiAttachmentLimits.pendingTtlMs,
    });
    return { attachment: await presentAttachment(ctx, (await ctx.db.get(id))!) } as const;
  },
});

async function deleteFile(ctx: MutationCtx, row: Doc<'finaiAttachments'>) {
  if (row.storageId && (await ctx.db.system.get('_storage', row.storageId)))
    await ctx.storage.delete(row.storageId);
}

/** Removes an upload from the composer before it's sent. */
export const discard = mutation({
  args: { attachmentId: v.id('finaiAttachments') },
  handler: async (ctx, { attachmentId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const row = await ctx.db.get(attachmentId);
    if (!row || row.userId !== user._id || row.messageId !== undefined) return null;
    await deleteFile(ctx, row);
    await ctx.db.delete(attachmentId);
    return null;
  },
});

/**
 * Links composer uploads to the user message being sent and applies the retention setting.
 * Called from `ai.assistant.begin`; throws if any id isn't the user's unsent, live upload.
 */
export async function linkAttachments(
  ctx: MutationCtx,
  input: {
    userId: Id<'users'>;
    conversationId: Id<'finaiConversations'>;
    messageId: Id<'finaiMessages'>;
    attachmentIds: Id<'finaiAttachments'>[];
    now: number;
  },
): Promise<Id<'finaiAttachments'>[]> {
  const ids = [...new Set(input.attachmentIds)];
  if (ids.length > finaiAttachmentLimits.perMessage) throw new Error('TOO_MANY_ATTACHMENTS');
  if (!ids.length) return [];
  const settings = await loadFinaiSettings(ctx, input.userId);
  if (!settings.allowAttachments) throw new Error('ATTACHMENTS_DISABLED');
  const retention = attachmentRetentionMs(settings.attachmentRetention);
  for (const id of ids) {
    const row = await ctx.db.get(id);
    if (
      !row ||
      row.userId !== input.userId ||
      row.messageId !== undefined ||
      row.deletedAt !== undefined ||
      !row.storageId
    )
      throw new Error('ATTACHMENT_NOT_FOUND');
    await ctx.db.patch(id, {
      conversationId: input.conversationId,
      messageId: input.messageId,
      expiresAt: retention === null ? undefined : input.now + retention,
    });
  }
  return ids;
}

/** Deletes a conversation's attachments (files and rows), e.g. when the chat is deleted. */
export async function deleteConversationAttachments(
  ctx: MutationCtx,
  conversationId: Id<'finaiConversations'>,
) {
  const rows = await ctx.db
    .query('finaiAttachments')
    .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
    .collect();
  for (const row of rows) {
    await deleteFile(ctx, row);
    await ctx.db.delete(row._id);
  }
}

/** For the reply action: a user's attachments with their storage ids (live files only). */
export const forModel = internalQuery({
  args: { userId: v.id('users'), ids: v.array(v.id('finaiAttachments')) },
  handler: async (ctx, { userId, ids }) => {
    const rows = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return rows
      .filter((row): row is Doc<'finaiAttachments'> => !!row && row.userId === userId)
      .map((row) => ({
        id: row._id,
        name: row.name,
        kind: row.kind,
        mimeType: row.mimeType,
        size: row.size,
        storageId: row.deletedAt === undefined ? row.storageId : undefined,
      }));
  },
});

const PURGE_BATCH = 100;

/** Deletes expired attachment files (hourly). Rows stay, marked deleted, so chats show the name. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query('finaiAttachments')
      .withIndex('by_expiresAt', (q) => q.gt('expiresAt', 0).lte('expiresAt', now))
      .take(PURGE_BATCH);
    let purged = 0;
    for (const row of due) {
      await deleteFile(ctx, row);
      // Never-sent uploads have no chat to show them in: drop the row too.
      if (row.messageId === undefined) await ctx.db.delete(row._id);
      else
        await ctx.db.patch(row._id, { storageId: undefined, deletedAt: now, expiresAt: undefined });
      purged++;
    }
    if (due.length === PURGE_BATCH)
      await ctx.scheduler.runAfter(0, internal.ai.attachments.purgeExpired, {});
    return purged;
  },
});
