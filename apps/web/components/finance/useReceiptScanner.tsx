'use client';

import React from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ReceiptScanCard, type ReceiptReview } from '@finapp/ui/finance';
import {
  receiptDraftToForm,
  receiptReviewFor,
  receiptFileProblem,
  receiptMimeType,
  useReceiptScan,
  type ReceiptFormFields,
} from '@finapp/ui/ai/receipt-scan';
import type { ReceiptDraft } from '@convex/ai/receiptDomain';
import { minorDigits } from '@convex/shared/money';

/**
 * "Scan receipt" for the web composers: takes a file (picker, camera capture or drag-and-drop),
 * uploads it to Convex storage, parses it and hands back composer fields. Returns the card to
 * render in the composer's `receiptScan` slot.
 */
export function useReceiptScanner({
  currency,
  disabled,
  onFields,
  onReview,
}: {
  /** The composer's currency (account or group); also the parser's fallback currency. */
  currency: string;
  disabled?: boolean;
  onFields: (fields: ReceiptFormFields, review: ReceiptReview) => void;
  /** Called with a fresh review when the composer's currency changes after a scan. */
  onReview?: (review: ReceiptReview) => void;
}) {
  const generateUploadUrl = useMutation(api.ai.receipts.generateUploadUrl);
  const registerUpload = useMutation(api.ai.receipts.registerUpload);
  const parse = useAction(api.ai.receipts.parse);
  // The last scan, so switching account / group re-checks the bill's currency.
  const lastScan = React.useRef<{ draft: ReceiptDraft; currency: string } | null>(null);
  const onReviewRef = React.useRef(onReview);
  onReviewRef.current = onReview;
  const onFieldsRef = React.useRef(onFields);
  onFieldsRef.current = onFields;
  React.useEffect(() => {
    const last = lastScan.current;
    if (!last || !currency || last.currency === currency) return;
    const digitsChanged = (minorDigits(last.currency) ?? 2) !== (minorDigits(currency) ?? 2);
    last.currency = currency;
    // Amounts depend on the currency's decimals (e.g. KWD 3 → INR 2): rebuild them, not just
    // the review, so the rows stay valid for the new account.
    // Only then are the rows rewritten; otherwise the user's edits are kept.
    const review = receiptReviewFor(last.draft, currency);
    if (digitsChanged)
      onFieldsRef.current(receiptDraftToForm(last.draft, currency), {
        fields: review.fields,
        itemIds: review.itemIds,
        warnings: review.warnings,
      });
    onReviewRef.current?.(review);
  }, [currency]);
  const scanner = useReceiptScan({
    generateUploadUrl: () => generateUploadUrl({}),
    registerUpload: (args) =>
      registerUpload({ ticket: args.ticket, storageId: args.storageId as Id<'_storage'> }),
    parse: (args) => parse({ ...args, storageId: args.storageId as Id<'_storage'> }),
  });
  const { scan, fail } = scanner;

  async function scanFile(file: File) {
    const mimeType = receiptMimeType(file.type, file.name);
    const problem = receiptFileProblem({ mimeType, size: file.size });
    if (problem) {
      fail(problem);
      return;
    }
    const draft = await scan(async (uploadUrl) => {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType! },
        body: file,
      });
      if (!response.ok) throw new Error('Upload failed');
      return ((await response.json()) as { storageId: string }).storageId;
    }, currency || undefined);
    if (!draft) return;
    const fields = receiptDraftToForm(draft, currency || draft.currency);
    lastScan.current = { draft, currency: currency || draft.currency };
    onFields(fields, {
      fields: fields.review,
      itemIds: fields.reviewItemIds,
      warnings: fields.warnings,
    });
  }

  const card = (
    <ReceiptScanCard
      phase={scanner.phase}
      caption={scanner.caption}
      orbState={scanner.orbState}
      error={scanner.error}
      disabled={disabled || scanner.busy}
      onFile={(file) => void scanFile(file)}
      onDismissError={scanner.reset}
    />
  );
  return { card, busy: scanner.busy };
}
