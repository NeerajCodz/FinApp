import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Button, Text, Typography, useTheme } from '@finapp/ui/web';
import { formatMinor, parseMinor } from '../money';
import { CurrencyInput } from './CurrencyInput';
import { SemanticMarker } from './SemanticMarker';

export function SettlementEditor({
  memberName,
  currency,
  direction,
  maxAmountMinor,
  disabledReason,
  saving = false,
  error,
  onSave,
}: {
  memberName: string;
  currency: string;
  direction: 'pay' | 'receive';
  maxAmountMinor: bigint;
  disabledReason?: string;
  saving?: boolean;
  error?: string;
  onSave: (amountMinor: bigint) => void;
}) {
  const [amount, setAmount] = useState('');
  const { tokens } = useTheme();
  let amountMinor: bigint | null = null;
  try {
    amountMinor = parseMinor(amount, currency);
  } catch {
    // Keep incomplete values editable; invalid values cannot be submitted.
  }
  const invalidAmount = amount.length > 0 && (amountMinor === null || amountMinor <= 0n);
  const tooMuch = amountMinor !== null && amountMinor > maxAmountMinor;
  const disabled =
    saving || !!disabledReason || amountMinor === null || amountMinor <= 0n || tooMuch;
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <SemanticMarker type="settlement" />
        <Typography variant="title">Record a settlement</Typography>
        <Typography variant="small">
          {maxAmountMinor > 0n
            ? direction === 'pay'
              ? `You paid ${memberName}. `
              : `${memberName} paid you. `
            : 'Choose a group and member with an outstanding balance. '}
          This records a payment already made; it does not send money.
        </Typography>
        {maxAmountMinor > 0n && (
          <Typography variant="caption">
            Outstanding up to {formatMinor(maxAmountMinor, currency)}
          </Typography>
        )}
      </div>
      <CurrencyInput currency={currency} value={amount} onChangeText={setAmount} />
      {disabledReason && (
        <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
          {disabledReason}
        </Typography>
      )}
      {invalidAmount && (
        <Typography variant="small" style={{ color: tokens.destructive }}>
          Enter a positive amount in {currency}.
        </Typography>
      )}
      {tooMuch && (
        <Typography variant="small" style={{ color: tokens.destructive }}>
          Amount exceeds the outstanding balance.
        </Typography>
      )}
      {!!error && (
        <div role="alert">
          <Typography variant="small" style={{ color: tokens.destructive }}>
            {error}
          </Typography>
        </div>
      )}
      <Button
        size="lg"
        disabled={disabled}
        onPress={() => amountMinor !== null && onSave(amountMinor)}
        accessibilityLabel={saving ? 'Saving settlement' : 'Record settlement'}
        style={!disabled ? { backgroundColor: tokens.settlement } : undefined}
      >
        <Check size={18} color={disabled ? tokens.controlDisabledForeground : tokens.background} />
        <Text
          style={{
            marginLeft: 8,
            color: disabled ? tokens.controlDisabledForeground : tokens.background,
            fontFamily: 'var(--font-space-grotesk, sans-serif)',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : 'Record settlement'}
        </Text>
      </Button>
    </div>
  );
}
