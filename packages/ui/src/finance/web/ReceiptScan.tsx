'use client';

/**
 * Receipt scanning UI for the web composers: a drop zone with "Take photo" (camera capture on
 * phones) and "Choose image" buttons, the Thinking Orb with staged copy while parsing, errors
 * with a retry, and the review notice shown once a draft is filled in.
 */
import React from 'react';
import { Camera, ImageUp, ReceiptText } from 'lucide-react';
import { Button, IconTile, StatusPill, ThinkingOrb, type ThinkingOrbState } from '@finapp/ui/web';
import { Illustration } from '@finapp/ui/illustrations';
import { RECEIPT_ACCEPT, type ReceiptField, type ReceiptScanPhase } from '../../ai/receiptScan';
import styles from './ReceiptScan.module.css';

export type ReceiptScanCardProps = {
  phase: ReceiptScanPhase;
  caption: string;
  orbState: ThinkingOrbState;
  error: string;
  disabled?: boolean;
  onFile: (file: File) => void;
  onDismissError: () => void;
};

export function ReceiptScanCard(p: ReceiptScanCardProps) {
  const camera = React.useRef<HTMLInputElement>(null);
  const library = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const busy = p.phase === 'uploading' || p.phase === 'reading' || p.phase === 'finding';
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) p.onFile(file);
  };
  const inputs = (
    <>
      <input
        ref={camera}
        type="file"
        accept={RECEIPT_ACCEPT}
        capture="environment"
        hidden
        onChange={pick}
      />
      <input ref={library} type="file" accept={RECEIPT_ACCEPT} hidden onChange={pick} />
    </>
  );
  if (busy)
    return (
      <section className={styles.card} data-state="busy" aria-busy="true">
        <ThinkingOrb state={p.orbState} size={64} label={p.caption} />
        <p className={styles.title} aria-live="polite">
          {p.caption}
        </p>
        <p className={styles.hint}>This usually takes a few seconds.</p>
      </section>
    );
  if (p.phase === 'error')
    return (
      <section className={styles.card} data-state="error">
        {inputs}
        <Illustration scene="error" size={96} />
        <p className={styles.error} role="alert">
          {p.error}
        </p>
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" onPress={p.onDismissError}>
            Enter manually
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={p.disabled}
            onPress={() => library.current?.click()}
          >
            Try another image
          </Button>
        </div>
      </section>
    );
  return (
    <section
      className={styles.card}
      data-dragging={dragging ? '' : undefined}
      aria-label="Scan receipt"
      onDragOver={(event) => {
        if (p.disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file && !p.disabled) p.onFile(file);
      }}
    >
      {inputs}
      <div className={styles.row}>
        <IconTile tone="accent" size={40}>
          <ReceiptText size={20} aria-hidden />
        </IconTile>
        <div className={styles.copy}>
          <p className={styles.title}>Scan receipt</p>
          <p className={styles.hint}>
            Drop a photo of the bill here, or pick one. Items are filled in for you.
          </p>
        </div>
      </div>
      <div className={styles.actions}>
        <Button
          size="sm"
          variant="outline"
          disabled={p.disabled}
          onPress={() => camera.current?.click()}
          aria-label="Scan receipt with the camera"
        >
          <Camera size={16} aria-hidden /> Take photo
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={p.disabled}
          onPress={() => library.current?.click()}
          aria-label="Scan receipt from an image file"
        >
          <ImageUp size={16} aria-hidden /> Choose image
        </Button>
      </div>
    </section>
  );
}

const fieldLabels: Record<ReceiptField, string> = {
  merchant: 'merchant',
  occurredAt: 'date',
  currency: 'currency',
  amount: 'total',
  items: 'items',
};

export type ReceiptReview = {
  fields: readonly ReceiptField[];
  itemIds: readonly string[];
  warnings: readonly string[];
};

/** "Check the highlighted details" notice after a scan. */
export function ReceiptReviewNotice({
  review,
  onDismiss,
}: {
  review: ReceiptReview;
  onDismiss?: () => void;
}) {
  const flagged = review.fields.map((field) => fieldLabels[field]);
  const clean = !flagged.length && !review.itemIds.length && !review.warnings.length;
  return (
    <section className={styles.review} data-clean={clean ? '' : undefined} role="status">
      <div className={styles.row}>
        <StatusPill label="Scanned" tone={clean ? 'income' : 'warning'} />
        <p className={styles.title}>
          {clean ? 'Filled in from your receipt' : 'Check the highlighted details'}
        </p>
        {onDismiss ? (
          <Button size="sm" variant="ghost" onPress={onDismiss}>
            Done
          </Button>
        ) : null}
      </div>
      {flagged.length ? (
        <p className={styles.hint}>Not sure about the {flagged.join(', ')}.</p>
      ) : null}
      {review.warnings.length ? (
        <ul className={styles.warnings}>
          {review.warnings.slice(0, 3).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Small "Check" marker beside a field label the scan was unsure about. */
export function ReviewMark({ show }: { show: boolean }) {
  return show ? <StatusPill label="Check" tone="warning" /> : null;
}
