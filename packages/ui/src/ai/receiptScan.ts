/**
 * Platform-neutral receipt scanning: file checks, error copy, staged loading copy, a hook that
 * runs upload → parse, and turning the server's draft into composer fields (title, merchant,
 * date, amount, line item rows) plus what to highlight for review. Shared by mobile and web.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReceiptDraft, ReceiptField } from '@convex/ai/receiptDomain';
import { receiptUpload } from '@convex/ai/config';
import { minorDigits } from '@convex/shared/money';
import type { LineItemDraft } from '../finance/lineItems';
import type { ThinkingOrbState } from './orbModel';

export type { ReceiptDraft, ReceiptField };

export const RECEIPT_MAX_BYTES = receiptUpload.maxBytes;
export const RECEIPT_MIME_TYPES: readonly string[] = receiptUpload.mimeTypes;
/** For `<input accept>`. */
export const RECEIPT_ACCEPT = RECEIPT_MIME_TYPES.join(',');

const extensionTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** The image's MIME type from what the picker reports, falling back to the file extension. */
export function receiptMimeType(mimeType?: string | null, fileName?: string | null): string | null {
  const declared = mimeType?.split(';')[0]?.trim().toLowerCase();
  if (declared && RECEIPT_MIME_TYPES.includes(declared)) return declared;
  if (declared === 'image/jpg') return 'image/jpeg';
  const extension = fileName?.split('.').pop()?.toLowerCase();
  return extension ? (extensionTypes[extension] ?? null) : null;
}

/** A problem with the chosen file, or '' when it can be scanned. */
export function receiptFileProblem(file: { mimeType: string | null; size: number }): string {
  if (!file.mimeType || !RECEIPT_MIME_TYPES.includes(file.mimeType))
    return 'Choose a photo (JPEG, PNG, WebP or HEIC).';
  if (!file.size) return 'That image looks empty. Try another one.';
  if (file.size > RECEIPT_MAX_BYTES) return 'Choose an image up to 8 MB.';
  return '';
}

const errorCopy: Record<string, string> = {
  AI_NOT_CONFIGURED: 'Receipt scanning isn’t switched on for this server yet.',
  AI_RATE_LIMITED: 'You’ve scanned a lot of receipts today. Try again tomorrow.',
  AI_BUSY: 'The scanner is busy right now. Try again in a moment.',
  AI_UNAVAILABLE: 'The scanner is unavailable right now. Try again in a moment.',
  AI_TIMEOUT: 'Reading the bill took too long. Try again.',
  AI_BLOCKED: 'This image couldn’t be processed. Try a different photo.',
  AI_TRUNCATED: 'This bill was too long to read in one go. Try a closer photo.',
  AI_BAD_RESPONSE: 'We couldn’t make sense of this bill. Try again.',
  AI_REQUEST_REJECTED: 'Receipt scanning is misconfigured on this server.',
  INVALID_IMAGE: 'Choose a JPEG, PNG, WebP or HEIC image up to 8 MB.',
  INVALID_UPLOAD_TICKET: 'That upload expired. Choose the photo again.',
  RECEIPT_UNREADABLE: 'We couldn’t find a total on this image. Try a clearer, flatter photo.',
  AUTH_REQUIRED: 'Sign in to scan receipts.',
};

/** The error code carried by a Convex error (`ConvexError` data or a code in the message). */
export function receiptScanErrorCode(error: unknown): string | null {
  const data = (error as { data?: unknown } | null)?.data;
  if (data && typeof data === 'object' && typeof (data as { code?: unknown }).code === 'string')
    return (data as { code: string }).code;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return Object.keys(errorCopy).find((code) => new RegExp(`\\b${code}\\b`).test(message)) ?? null;
}

export function receiptScanErrorMessage(error: unknown): string {
  const code = receiptScanErrorCode(error);
  if (code && errorCopy[code]) return errorCopy[code];
  if (error instanceof Error && /network|fetch|upload/i.test(error.message))
    return 'The photo couldn’t be uploaded. Check your connection and try again.';
  return 'Something went wrong while reading the bill. Try again.';
}

export type ReceiptScanPhase = 'idle' | 'uploading' | 'reading' | 'finding' | 'error';

export const receiptScanStages: Record<
  Exclude<ReceiptScanPhase, 'idle' | 'error'>,
  { caption: string; orb: ThinkingOrbState }
> = {
  uploading: { caption: 'Uploading your photo…', orb: 'working' },
  reading: { caption: 'Reading your bill…', orb: 'reasoning' },
  finding: { caption: 'Finding items…', orb: 'searching' },
};

export type ReceiptUploadTicket = { uploadUrl: string; ticket: string };
export type UseReceiptScanOptions = {
  generateUploadUrl: () => Promise<ReceiptUploadTicket>;
  parse: (args: { storageId: string; ticket: string; currency?: string }) => Promise<ReceiptDraft>;
};

/**
 * Runs a scan: `scan(upload, currency)` asks for a ticket, calls `upload(uploadUrl)` (which
 * POSTs the image and resolves to the storage id), then parses. Resolves to the draft, or null on
 * failure/cancel (with `error` set on failure).
 */
export function useReceiptScan({ generateUploadUrl, parse }: UseReceiptScanOptions) {
  const [phase, setPhase] = useState<ReceiptScanPhase>('idle');
  const [error, setError] = useState('');
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const scan = useCallback(
    async (upload: (uploadUrl: string) => Promise<string>, currency?: string) => {
      const id = ++run.current;
      const current = () => id === run.current;
      setError('');
      setPhase('uploading');
      try {
        const { uploadUrl, ticket } = await generateUploadUrl();
        const storageId = await upload(uploadUrl);
        if (!current()) return null;
        setPhase('reading');
        clearTimer();
        timer.current = setTimeout(() => current() && setPhase('finding'), 2500);
        const draft = await parse({ storageId, ticket, ...(currency ? { currency } : {}) });
        clearTimer();
        if (!current()) return null;
        setPhase('idle');
        return draft;
      } catch (cause) {
        clearTimer();
        if (!current()) return null;
        setError(receiptScanErrorMessage(cause));
        setPhase('error');
        return null;
      }
    },
    [generateUploadUrl, parse],
  );
  const fail = useCallback((message: string) => {
    run.current++;
    clearTimer();
    setError(message);
    setPhase('error');
  }, []);
  const reset = useCallback(() => {
    run.current++;
    clearTimer();
    setError('');
    setPhase('idle');
  }, []);
  const stage = phase === 'idle' || phase === 'error' ? null : receiptScanStages[phase];
  return {
    phase,
    busy: stage !== null,
    caption: stage?.caption ?? '',
    orbState: stage?.orb ?? ('idle' as ThinkingOrbState),
    error,
    scan,
    fail,
    reset,
  };
}

/** Minor units to an editable decimal in `currency` ("12050" INR → "120.50"). */
export function minorToInput(amount: bigint, currency: string): string {
  const digits = minorDigits(currency) ?? 2;
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const scale = 10n ** BigInt(digits);
  const fraction = digits ? `.${(absolute % scale).toString().padStart(digits, '0')}` : '';
  return `${negative ? '-' : ''}${absolute / scale}${fraction}`;
}

export type ReceiptFormFields = {
  title: string;
  merchant: string;
  /** Local noon on the receipt's date, or null to keep the composer's date. */
  occurredAt: number | null;
  amount: string;
  rows: LineItemDraft[];
  /** Composer fields to highlight. */
  review: ReceiptField[];
  /** Row ids to highlight. */
  reviewItemIds: string[];
  warnings: string[];
};

/**
 * Composer fields for a draft. Amounts are written in the composer's currency digits; when the
 * receipt's currency differs from the account's that is flagged for review.
 */
export function receiptDraftToForm(
  draft: ReceiptDraft,
  composerCurrency: string,
): ReceiptFormFields {
  const review = new Set<ReceiptField>(draft.lowConfidence);
  const warnings = [...draft.warnings];
  const target = composerCurrency.toUpperCase();
  if (draft.currency !== target) {
    review.add('currency');
    warnings.unshift(
      `This bill is in ${draft.currency} but the account uses ${target}. Amounts are copied as printed.`,
    );
  }
  const amountText = (minor: bigint) => {
    const printed = minorToInput(minor, draft.currency);
    const targetDigits = minorDigits(target) ?? 2;
    const [whole, fraction = ''] = printed.split('.');
    if (fraction.length <= targetDigits) return printed;
    // e.g. a KWD bill (3 decimals) into an INR account: keep the account's precision.
    const rounded = Number(printed).toFixed(targetDigits);
    return targetDigits ? rounded : String(Math.round(Number(`${whole}.${fraction}`)));
  };
  const occurred =
    draft.occurredAt === null
      ? null
      : (() => {
          const utc = new Date(draft.occurredAt);
          return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12).getTime();
        })();
  return {
    title: draft.title,
    merchant: draft.merchant ?? '',
    occurredAt: occurred,
    amount: amountText(draft.amountMinor),
    rows: draft.items.map((item) => ({
      id: item.id,
      title: item.title,
      amount: amountText(item.amountMinor),
      quantity: item.quantity === undefined ? '' : String(item.quantity),
      participantIds: null,
    })),
    review: [...review],
    reviewItemIds: draft.items.filter((item) => item.lowConfidence).map((item) => item.id),
    warnings,
  };
}
