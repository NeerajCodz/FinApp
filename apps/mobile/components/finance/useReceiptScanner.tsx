import React, { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
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
 * "Scan receipt" for the mobile composers: picks a photo (camera or library) with
 * expo-image-picker, uploads it to Convex storage, parses it and hands back composer fields.
 * Returns the card to render in the composer's `receiptScan` slot.
 */
export function useReceiptScanner({
  currency,
  disabled,
  onFields,
  onCurrencyChange,
  onReview,
}: {
  /** The composer's currency (account or group); also the parser's fallback currency. */
  currency: string;
  disabled?: boolean;
  onFields: (fields: ReceiptFormFields, review: ReceiptReview) => void;
  /** Updates only monetary values when currency precision changes after scanning. */
  onCurrencyChange: (fields: Pick<ReceiptFormFields, 'amount' | 'rows'>) => void;
  /** Called with a fresh review when the composer's currency changes after a scan. */
  onReview?: (review: ReceiptReview) => void;
}) {
  const generateUploadUrl = useMutation(api.ai.receipts.generateUploadUrl);
  const registerUpload = useMutation(api.ai.receipts.registerUpload);
  const parse = useAction(api.ai.receipts.parse);
  const onCurrencyChangeRef = React.useRef(onCurrencyChange);
  onCurrencyChangeRef.current = onCurrencyChange;
  // The last scan, so switching account / group re-checks the bill's currency.
  const lastScan = React.useRef<{ draft: ReceiptDraft; currency: string } | null>(null);
  const onReviewRef = React.useRef(onReview);
  onReviewRef.current = onReview;
  React.useEffect(() => {
    const last = lastScan.current;
    if (!last || !currency || last.currency === currency) return;
    const digitsChanged = (minorDigits(last.currency) ?? 2) !== (minorDigits(currency) ?? 2);
    last.currency = currency;
    const review = receiptReviewFor(last.draft, currency);
    if (digitsChanged) {
      const fields = receiptDraftToForm(last.draft, currency);
      onCurrencyChangeRef.current({ amount: fields.amount, rows: fields.rows });
    }
    onReviewRef.current?.(review);
  }, [currency]);
  const scanner = useReceiptScan({
    generateUploadUrl: () => generateUploadUrl({}),
    registerUpload: (args) =>
      registerUpload({ ticket: args.ticket, storageId: args.storageId as Id<'_storage'> }),
    parse: (args) => parse({ ...args, storageId: args.storageId as Id<'_storage'> }),
  });
  const { scan, fail } = scanner;

  const pick = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            fail('Allow camera access in Settings to scan receipts, or choose a photo instead.');
            return;
          }
        }
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);
        const asset = result.canceled ? null : result.assets[0];
        if (!asset) return;
        const mimeType = receiptMimeType(asset.mimeType, asset.fileName ?? asset.uri);
        const image = await (await fetch(asset.uri)).blob();
        const problem = receiptFileProblem({ mimeType, size: image.size });
        if (problem) {
          fail(problem);
          return;
        }
        const draft = await scan(async (uploadUrl) => {
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': mimeType! },
            body: image,
          });
          if (!response.ok) throw new Error('Upload failed');
          return ((await response.json()) as { storageId: string }).storageId;
        }, currency || undefined);
        if (!draft) return;
        const fields = receiptDraftToForm(draft, currency || draft.currency);
        lastScan.current = { draft, currency: currency || draft.currency };
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onFields(fields, {
          fields: fields.review,
          itemIds: fields.reviewItemIds,
          warnings: fields.warnings,
        });
      } catch {
        fail('The photo couldn’t be opened. Try another one.');
      }
    },
    [currency, fail, onFields, scan],
  );

  const card = (
    <ReceiptScanCard
      phase={scanner.phase}
      caption={scanner.caption}
      orbState={scanner.orbState}
      error={scanner.error}
      disabled={disabled || scanner.busy}
      onTakePhoto={() => void pick('camera')}
      onChoosePhoto={() => void pick('library')}
      onDismissError={scanner.reset}
    />
  );
  return { card, busy: scanner.busy };
}
