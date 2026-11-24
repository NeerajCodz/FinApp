'use client';

import React from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ReceiptScanCard, type ReceiptReview } from '@finapp/ui/finance';
import {
  receiptDraftToForm,
  receiptFileProblem,
  receiptMimeType,
  useReceiptScan,
  type ReceiptFormFields,
} from '@finapp/ui/ai/receipt-scan';

/**
 * "Scan receipt" for the web composers: takes a file (picker, camera capture or drag-and-drop),
 * uploads it to Convex storage, parses it and hands back composer fields. Returns the card to
 * render in the composer's `receiptScan` slot.
 */
export function useReceiptScanner({
  currency,
  disabled,
  onFields,
}: {
  /** The composer's currency (account or group); also the parser's fallback currency. */
  currency: string;
  disabled?: boolean;
  onFields: (fields: ReceiptFormFields, review: ReceiptReview) => void;
}) {
  const generateUploadUrl = useMutation(api.ai.receipts.generateUploadUrl);
  const parse = useAction(api.ai.receipts.parse);
  const scanner = useReceiptScan({
    generateUploadUrl: () => generateUploadUrl({}),
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
