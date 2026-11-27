/**
 * Receipt scanning: the client asks for an upload URL (with a single-use ticket), uploads the
 * photo to Convex storage, then calls `parse`. Parsing checks the ticket and the image, counts
 * against the user's daily OCR limit, sends the image to the `ocr` model with a strict response
 * schema, normalizes the answer into a draft whose items add up to the total and always deletes
 * the stored image.
 */
import { v } from 'convex/values';
import { api, internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import {
  action,
  internalMutation,
  mutation,
  type ActionCtx,
  type MutationCtx,
} from '../_generated/server';
import { requireUser } from '../shared/auth';
import { minorDigits } from '../shared/money';
import { receiptUpload } from './config';
import { aiError } from './errors';
import { classifyReceiptCategory } from './decisions';
import { bytesToBase64, generateStructured, isGeminiConfigured } from './gemini';
import {
  normalizeReceipt,
  receiptResponseSchema,
  receiptSystemInstruction,
  type ReceiptDraft,
} from './receiptDomain';
import { consumeAiQuota } from './usage';

/**
 * Upload metadata check: size within limits and, when the upload declared a type, an accepted
 * image type. The bytes are checked again by `sniffImageType` before parsing.
 */
export function validateReceiptImage(
  metadata: { contentType?: string | null; size: number } | null,
): boolean {
  if (!metadata || !Number.isFinite(metadata.size) || metadata.size <= 0) return false;
  if (metadata.size > receiptUpload.maxBytes) return false;
  const declared = metadata.contentType?.split(';')[0]?.trim().toLowerCase();
  return !declared || (receiptUpload.mimeTypes as readonly string[]).includes(declared);
}

/** The image type from its magic bytes (JPEG, PNG, WebP, HEIC/HEIF), or null. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1', 'heif'].includes(brand)) return 'image/heif';
  }
  return null;
}

/** An upload URL plus a ticket that `parse` must present. Ask again for each image. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    if (!isGeminiConfigured()) throw aiError('AI_NOT_CONFIGURED');
    const ticket = crypto.randomUUID();
    const now = Date.now();
    const uploadId = await ctx.db.insert('aiReceiptUploads', {
      ticket,
      userId: user._id,
      createdAt: now,
    });
    // Tickets (and any image that never reached parsing) are cleaned up after they expire.
    await ctx.scheduler.runAt(
      now + receiptUpload.ticketTtlMs + 60_000,
      internal.ai.receipts.expireUpload,
      {
        uploadId,
      },
    );
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      ticket,
      maxBytes: receiptUpload.maxBytes,
      mimeTypes: [...receiptUpload.mimeTypes],
    };
  },
});

/**
 * Storage IDs referenced by any live app record are not scratch uploads and must not be deleted.
 */
const ORPHAN_STORAGE_GRACE_MS = 24 * 60 * 60 * 1000;
const ORPHAN_STORAGE_PAGE_SIZE = 64;

/** Returns whether any live app record still owns this stored file. */
export async function storageInUse(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  ignoredReceiptUploadId?: Id<'aiReceiptUploads'>,
): Promise<boolean> {
  const [
    receipt,
    directMessage,
    groupMessage,
    attachment,
    attachmentUpload,
    receiptUploads,
    avatar,
    user,
  ] = await Promise.all([
    ctx.db
      .query('receipts')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first(),
    ctx.db
      .query('directMessages')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first(),
    ctx.db
      .query('groupMessages')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first(),
    ctx.db
      .query('finaiAttachments')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first(),
    ctx.db
      .query('finaiAttachmentUploads')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first(),
    ctx.db
      .query('aiReceiptUploads')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .take(2),
    ctx.db
      .query('avatars')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first(),
    ctx.db
      .query('users')
      .withIndex('by_avatarStorageId', (q) => q.eq('avatarStorageId', String(storageId)))
      .first(),
  ]);
  return Boolean(
    receipt ||
      directMessage ||
      groupMessage ||
      attachment ||
      attachmentUpload ||
      receiptUploads.some((upload) => upload._id !== ignoredReceiptUploadId) ||
      avatar ||
      user,
  );
}

/** Removes files with no database owner once any issued upload URL has expired. */
export const purgeOrphanedStorage = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    olderThan: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, olderThan }) => {
    const cutoff = olderThan ?? Date.now() - ORPHAN_STORAGE_GRACE_MS;
    const page = await ctx.db.system
      .query('_storage')
      .order('asc')
      .paginate({ cursor: cursor ?? null, numItems: ORPHAN_STORAGE_PAGE_SIZE });
    for (const file of page.page) {
      if (file._creationTime >= cutoff) break;
      if (!(await storageInUse(ctx, file._id))) await ctx.storage.delete(file._id);
    }
    const last = page.page[page.page.length - 1];
    if (!page.isDone && last && last._creationTime < cutoff) {
      await ctx.scheduler.runAfter(0, internal.ai.receipts.purgeOrphanedStorage, {
        cursor: page.continueCursor,
        olderThan: cutoff,
      });
    }
  },
});

/**
 * Records the uploaded image on its ticket right after the upload, so an image whose parse
 * never arrives (app killed, connection lost, scan cancelled) can still be deleted.
 */
export const registerUpload = mutation({
  args: { ticket: v.string(), storageId: v.id('_storage') },
  handler: async (ctx, { ticket, storageId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const upload = await ctx.db
      .query('aiReceiptUploads')
      .withIndex('by_ticket', (q) => q.eq('ticket', ticket))
      .unique();
    const file = await ctx.db.system.get('_storage', storageId);
    if (
      !upload ||
      upload.userId !== user._id ||
      upload.usedAt !== undefined ||
      upload.storageId !== undefined ||
      Date.now() - upload.createdAt > receiptUpload.ticketTtlMs ||
      !file ||
      file._creationTime < upload.createdAt - 1000 ||
      (await storageInUse(ctx, storageId))
    )
      throw aiError('INVALID_UPLOAD_TICKET');
    await ctx.db.patch(upload._id, { storageId });
    return null;
  },
});

/** Deletes an expired ticket and, if it was never parsed, the image it uploaded. */
export const expireUpload = internalMutation({
  args: { uploadId: v.id('aiReceiptUploads') },
  handler: async (ctx, { uploadId }) => {
    const upload = await ctx.db.get(uploadId);
    if (!upload) return;
    if (
      upload.usedAt === undefined &&
      upload.storageId &&
      !(await storageInUse(ctx, upload.storageId, upload._id)) &&
      (await ctx.db.system.get('_storage', upload.storageId))
    )
      await ctx.storage.delete(upload.storageId);
    await ctx.db.delete(uploadId);
  },
});

/**
 * Claims the ticket, validates the stored image and counts one OCR request. Once the image is
 * known to be the caller's, failures are returned (not thrown) so the ticket claim and the image
 * deletion commit.
 */
export const beginParse = internalMutation({
  args: { storageId: v.id('_storage'), ticket: v.string() },
  handler: async (
    ctx,
    { storageId, ticket },
  ): Promise<
    { ok: true; userId: Id<'users'> } | { ok: false; code: 'INVALID_IMAGE' | 'AI_RATE_LIMITED' }
  > => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const upload = await ctx.db
      .query('aiReceiptUploads')
      .withIndex('by_ticket', (q) => q.eq('ticket', ticket))
      .unique();
    const now = Date.now();
    const file = await ctx.db.system.get('_storage', storageId);
    if (
      !upload ||
      upload.userId !== user._id ||
      upload.usedAt !== undefined ||
      now - upload.createdAt > receiptUpload.ticketTtlMs ||
      !file ||
      // The image must have been uploaded after this ticket was issued.
      file._creationTime < upload.createdAt - 1000
    )
      throw aiError('INVALID_UPLOAD_TICKET');
    if (
      (upload.storageId !== undefined && upload.storageId !== storageId) ||
      (await storageInUse(ctx, storageId, upload._id))
    )
      throw aiError('INVALID_UPLOAD_TICKET');
    await ctx.db.patch(upload._id, { usedAt: now, storageId });
    if (!validateReceiptImage({ contentType: file.contentType, size: file.size })) {
      await ctx.storage.delete(storageId);
      return { ok: false, code: 'INVALID_IMAGE' };
    }
    try {
      await consumeAiQuota(ctx, user._id, 'ocr', now);
    } catch {
      await ctx.storage.delete(storageId);
      return { ok: false, code: 'AI_RATE_LIMITED' };
    }
    return { ok: true, userId: user._id };
  },
});

/**
 * After OCR, `gemini-decision-1` picks the receipt's category among the user's own. Best
 * effort: quota, missing categories or a failed call simply leave the category empty.
 */
async function suggestCategory(
  ctx: ActionCtx,
  userId: Id<'users'>,
  draft: ReceiptDraft,
): Promise<{ categoryId?: string }> {
  try {
    const settings = await ctx.runQuery(internal.ai.settings.forUser, { userId });
    if (!settings.autoCategorizeReceipts) return {};
    const categories = await ctx.runQuery(api.categories.queries.list, {});
    if (!categories.length) return {};
    await ctx.runMutation(internal.ai.receipts.consumeDecision, { userId });
    const picked = await classifyReceiptCategory(
      draft,
      categories.map((category) => ({
        id: String(category._id),
        name: category.name,
        ...(category.notes ? { notes: category.notes } : {}),
      })),
    );
    return picked ? { categoryId: picked.categoryId } : {};
  } catch (cause) {
    console.warn('[ai] receipt category decision skipped', String(cause));
    return {};
  }
}

export const consumeDecision = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await consumeAiQuota(ctx, userId, 'decision');
  },
});

/**
 * Reads a receipt photo into a transaction draft whose items add up to its amount. `currency` is
 * the fallback when the receipt's own currency is missing or unsupported (the account currency).
 * Once the ticket checks out the image is deleted whatever happens.
 */
export const parse = action({
  args: {
    storageId: v.id('_storage'),
    ticket: v.string(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { storageId, ticket, currency }): Promise<ReceiptDraft> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('AUTH_REQUIRED');
    if (!isGeminiConfigured()) throw aiError('AI_NOT_CONFIGURED');
    const begun = await ctx.runMutation(internal.ai.receipts.beginParse, { storageId, ticket });
    if (!begun.ok) throw aiError(begun.code);
    try {
      const blob = await ctx.storage.get(storageId);
      if (!blob) throw aiError('INVALID_IMAGE');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const mimeType = sniffImageType(bytes);
      if (!mimeType) throw aiError('INVALID_IMAGE');
      const hint = currency && minorDigits(currency) !== null ? currency.toUpperCase() : 'INR';
      const result = await generateStructured({
        role: 'ocr',
        systemInstruction: receiptSystemInstruction(hint),
        parts: [
          { inlineData: { mimeType, data: bytesToBase64(bytes) } },
          { text: 'Extract this receipt.' },
        ],
        responseSchema: receiptResponseSchema,
      });
      // Usage accounting is best effort: never throw away a good scan because it failed.
      await ctx
        .runMutation(internal.ai.usage.recordTokens, {
          userId: begun.userId,
          kind: 'ocr',
          promptTokens: result.usage.promptTokens,
          outputTokens: result.usage.outputTokens,
        })
        .catch((cause: unknown) => console.warn('[ai] token accounting failed', String(cause)));
      const draft = normalizeReceipt(result.data, { fallbackCurrency: hint });
      return { ...draft, ...(await suggestCategory(ctx, begun.userId, draft)) };
    } finally {
      await ctx.storage.delete(storageId).catch(() => undefined);
    }
  },
});
