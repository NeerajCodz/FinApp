/**
 * Receipt scanning: the client asks for an upload URL (with a single-use ticket), uploads the
 * photo to Convex storage, then calls `parse`. Parsing checks the ticket and the image, counts
 * against the user's daily OCR limit, sends the image to the `ocr` model with a strict response
 * schema, normalizes the answer into a draft whose items add up to the total and always deletes
 * the stored image.
 */
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { action, internalMutation, mutation } from '../_generated/server';
import { requireUser } from '../shared/auth';
import { minorDigits } from '../shared/money';
import { receiptUpload } from './config';
import { aiError } from './errors';
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
    await ctx.db.insert('aiReceiptUploads', { ticket, userId: user._id, createdAt: Date.now() });
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      ticket,
      maxBytes: receiptUpload.maxBytes,
      mimeTypes: [...receiptUpload.mimeTypes],
    };
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
    const [directMessage, groupMessage] = await Promise.all([
      ctx.db
        .query('directMessages')
        .withIndex('by_storage', (q) => q.eq('storageId', storageId))
        .first(),
      ctx.db
        .query('groupMessages')
        .withIndex('by_storage', (q) => q.eq('storageId', storageId))
        .first(),
    ]);
    if (directMessage || groupMessage) throw aiError('INVALID_UPLOAD_TICKET');
    await ctx.db.patch(upload._id, { usedAt: now });
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
      await ctx.runMutation(internal.ai.usage.recordTokens, {
        userId: begun.userId,
        kind: 'ocr',
        promptTokens: result.usage.promptTokens,
        outputTokens: result.usage.outputTokens,
      });
      return normalizeReceipt(result.data, { fallbackCurrency: hint });
    } finally {
      await ctx.storage.delete(storageId).catch(() => undefined);
    }
  },
});
