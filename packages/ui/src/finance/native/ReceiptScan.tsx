/**
 * Receipt scanning UI for the native composers: the "Scan receipt" card (camera / photos, the
 * Thinking Orb with staged copy while parsing, errors with a retry) and the review notice shown
 * once a draft is filled in. Picking images and calling Convex stay in the app.
 */
import React from 'react';
import { View } from 'react-native';
import { ReceiptText } from '@finapp/ui/icons/native';
import {
  Button,
  IconTile,
  StatusPill,
  ThinkingOrb,
  Typography,
  useTheme,
  type ThinkingOrbState,
} from '@finapp/ui/native';
import { Illustration } from '@finapp/ui/illustrations';
import { withAlpha } from '../../tokens';
import type { ReceiptField, ReceiptScanPhase } from '../../ai/receiptScan';

export type ReceiptScanCardProps = {
  phase: ReceiptScanPhase;
  caption: string;
  orbState: ThinkingOrbState;
  error: string;
  disabled?: boolean;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onDismissError: () => void;
};

export function ReceiptScanCard(p: ReceiptScanCardProps) {
  const { tokens } = useTheme();
  const frame = {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
    backgroundColor: tokens.card,
  } as const;
  if (p.phase === 'uploading' || p.phase === 'reading' || p.phase === 'finding')
    return (
      <View style={[frame, { alignItems: 'center', paddingVertical: 22 }]}>
        <ThinkingOrb state={p.orbState} size={64} label={p.caption} />
        <Typography variant="label" accessibilityLiveRegion="polite">
          {p.caption}
        </Typography>
        <Typography variant="caption">This usually takes a few seconds.</Typography>
      </View>
    );
  if (p.phase === 'error')
    return (
      <View style={[frame, { alignItems: 'center' }]}>
        <Illustration scene="error" size={96} />
        <Typography accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {p.error}
        </Typography>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button size="sm" variant="ghost" onPress={p.onDismissError}>
            Enter manually
          </Button>
          <Button size="sm" variant="outline" disabled={p.disabled} onPress={p.onChoosePhoto}>
            Try another photo
          </Button>
        </View>
      </View>
    );
  return (
    <View style={frame}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile tone="accent" size={40}>
          <ReceiptText size={20} color={tokens.primary} />
        </IconTile>
        <View style={{ flex: 1 }}>
          <Typography variant="label">Scan receipt</Typography>
          <Typography variant="caption">
            Fill this in from a photo of the bill, items included.
          </Typography>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          size="sm"
          variant="outline"
          disabled={p.disabled}
          onPress={p.onTakePhoto}
          style={{ flex: 1 }}
          accessibilityLabel="Scan receipt with the camera"
        >
          Camera
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={p.disabled}
          onPress={p.onChoosePhoto}
          style={{ flex: 1 }}
          accessibilityLabel="Scan receipt from your photos"
        >
          Photos
        </Button>
      </View>
    </View>
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
  const { tokens } = useTheme();
  const flagged = review.fields.map((field) => fieldLabels[field]);
  const clean = !flagged.length && !review.itemIds.length && !review.warnings.length;
  return (
    <View
      accessibilityRole="summary"
      style={{
        gap: 6,
        padding: 12,
        borderRadius: 14,
        backgroundColor: withAlpha(clean ? tokens.positive : tokens.warning, 0.1),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StatusPill label="Scanned" tone={clean ? 'income' : 'warning'} />
        <Typography variant="label" style={{ flex: 1 }}>
          {clean ? 'Filled in from your receipt' : 'Check the highlighted details'}
        </Typography>
        {onDismiss ? (
          <Button size="sm" variant="ghost" onPress={onDismiss}>
            Done
          </Button>
        ) : null}
      </View>
      {flagged.length ? (
        <Typography variant="caption">Not sure about the {flagged.join(', ')}.</Typography>
      ) : null}
      {review.warnings.slice(0, 3).map((warning) => (
        <Typography key={warning} variant="caption">
          • {warning}
        </Typography>
      ))}
    </View>
  );
}

/** Small "Check" marker beside a field label the scan was unsure about. */
export function ReviewMark({ show }: { show: boolean }) {
  return show ? <StatusPill label="Check" tone="warning" /> : null;
}
