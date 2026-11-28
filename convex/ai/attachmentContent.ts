/**
 * Turns a message's attachments into model input: images and PDFs go inline (checked by their
 * bytes, not their names), spreadsheets and text files become compact text. Every attachment is
 * also described with its id so tools (e.g. the bulk import) can read the whole file later.
 */
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import type { AttachmentKind } from './attachments';
import { finaiAttachmentLimits } from './config';
import { bytesToBase64 } from './gemini';
import type { GeminiContentPart } from './geminiChat';
import { sniffImageType } from './receipts';
import { parseCsv, readXlsx, sheetForPrompt, type Sheet } from './spreadsheet';

export type ModelAttachment = {
  id: Id<'finaiAttachments'> | string;
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
  storageId?: Id<'_storage'>;
};

const isPdf = (bytes: Uint8Array) =>
  bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
const isZip = (bytes: Uint8Array) =>
  (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) ||
  (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x05 && bytes[3] === 0x06) ||
  (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x07 && bytes[3] === 0x08);

/** Keeps declared CSV/TSV files as text even when their bytes resemble a ZIP workbook. */
export function readSheets(bytes: Uint8Array, name: string): Sheet[] {
  const fileName = name.trim();
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase();
  const sheetName = fileName.replace(/\.[^.]+$/, '') || 'Sheet1';
  const isTextFile = extension === 'csv' || extension === 'tsv';
  if (!isTextFile && isZip(bytes)) return readXlsx(bytes);
  const text = new TextDecoder().decode(bytes);
  return [parseCsv(text, sheetName)];
}

async function bytesOf(ctx: ActionCtx, storageId: Id<'_storage'>) {
  const blob = await ctx.storage.get(storageId);
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/** Model parts for attachments sent with the current message. */
export async function attachmentParts(
  ctx: ActionCtx,
  attachments: ModelAttachment[],
): Promise<GeminiContentPart[]> {
  const parts: GeminiContentPart[] = [];
  const notes: string[] = [];
  let inlineBytes = 0;
  let textBudget: number = finaiAttachmentLimits.maxTextChars;
  for (const attachment of attachments) {
    const label = `Attachment "${attachment.name}" (id: ${attachment.id}, ${attachment.kind})`;
    const bytes = attachment.storageId ? await bytesOf(ctx, attachment.storageId) : null;
    if (!bytes) {
      notes.push(
        `${label}: the file has been deleted (attachments expire per the user's settings).`,
      );
      continue;
    }
    if (attachment.kind === 'image' || attachment.kind === 'pdf') {
      let mimeType =
        attachment.kind === 'pdf'
          ? isPdf(bytes)
            ? 'application/pdf'
            : null
          : sniffImageType(bytes);
      if (!mimeType) {
        notes.push(`${label}: not a readable ${attachment.kind === 'pdf' ? 'PDF' : 'image'}.`);
        continue;
      }
      let size = bytes.length;
      let data: string;
      if (mimeType === 'image/heic' || mimeType === 'image/heif') {
        try {
          const converted = await ctx.runAction(internal.ai.heicConversion.toJpeg, {
            bytes: bytes.buffer as ArrayBuffer,
            maxOutputBytes: finaiAttachmentLimits.maxInlineBytes - inlineBytes,
          });
          mimeType = 'image/jpeg';
          size = converted.byteSize;
          data = bytesToBase64(new Uint8Array(converted.data));
        } catch {
          notes.push(`${label}: couldn't convert this HEIC/HEIF image; save it as JPEG and try again.`);
          continue;
        }
      } else data = bytesToBase64(bytes);
      if (inlineBytes + size > finaiAttachmentLimits.maxInlineBytes) {
        notes.push(
          `${label}: too large to view together with the other files; ask the user to send it on its own.`,
        );
        continue;
      }
      inlineBytes += size;
      notes.push(`${label}: shown below.`);
      parts.push({ inlineData: { mimeType, data } });
      continue;
    }
    if (attachment.kind === 'spreadsheet') {
      let sheets: Sheet[];
      try {
        sheets = readSheets(bytes, attachment.name);
      } catch {
        notes.push(
          `${label}: couldn't read this spreadsheet (save it as .xlsx or .csv and try again).`,
        );
        continue;
      }
      const summary = sheets
        .map((sheet) => `"${sheet.name}" ${sheet.rows.length}${sheet.truncated ? '+' : ''} rows`)
        .join(', ');
      notes.push(
        `${label}: sheets ${summary}. To add its rows as transactions, call propose_import_transactions with this attachment id and the column names.`,
      );
      for (const sheet of sheets) {
        if (textBudget <= 200) break;
        const table = sheetForPrompt(sheet, Math.min(textBudget, 24_000));
        textBudget -= table.length;
        parts.push({ text: `Sheet "${sheet.name}" of "${attachment.name}" (CSV):\n${table}` });
      }
      continue;
    }
    // Plain text, Markdown, JSON.
    const text = new TextDecoder().decode(bytes);
    const shown = text.slice(0, Math.max(0, Math.min(textBudget, 24_000)));
    textBudget -= shown.length;
    notes.push(
      `${label}: ${text.length} characters${shown.length < text.length ? ` (first ${shown.length} shown)` : ''}.`,
    );
    if (shown) parts.push({ text: `Contents of "${attachment.name}":\n${shown}` });
  }
  return notes.length ? [{ text: `The user attached:\n- ${notes.join('\n- ')}` }, ...parts] : parts;
}
