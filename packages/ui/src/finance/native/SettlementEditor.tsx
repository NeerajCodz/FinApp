import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, IconTile, Text, Textarea, Typography, useTheme } from '@finapp/ui/native';
import { Check, NotePencil, TriangleAlert } from '@finapp/ui/icons/native';
import { space, withAlpha } from '../../tokens';
import { formatMinor, parseMinor } from '../money';
import { SETTLEMENT_NOTE_MAX } from '../groupSettle';
import { CurrencyInput } from './CurrencyInput';

/**
 * Partial or full payment with one member. Amounts above what is still open between the two
 * members are blocked inline with the same rule the server applies (SETTLEMENT_EXCEEDS_BALANCE).
 */
export function SettlementEditor({
  memberName,
  currency,
  direction,
  maxAmountMinor,
  suggestedMinor,
  disabledReason,
  saving = false,
  error,
  onSave,
}: {
  memberName: string;
  currency: string;
  direction: 'pay' | 'receive';
  maxAmountMinor: bigint;
  /** Amount from the suggested plan, offered as a quick fill. */
  suggestedMinor?: bigint;
  disabledReason?: string;
  saving?: boolean;
  error?: string;
  onSave: (amountMinor: bigint, note?: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const { tokens } = useTheme();
  let amountMinor: bigint | null = null;
  try {
    amountMinor = parseMinor(amount, currency);
  } catch {
    // Incomplete or invalid amounts remain editable, but cannot be submitted.
  }
  const invalidAmount = amount.length > 0 && (amountMinor === null || amountMinor <= 0n);
  const tooMuch = amountMinor !== null && amountMinor > maxAmountMinor;
  const noteTooLong = note.trim().length > SETTLEMENT_NOTE_MAX;
  const disabled =
    saving ||
    !!disabledReason ||
    amountMinor === null ||
    amountMinor <= 0n ||
    tooMuch ||
    noteTooLong;
  const fill = (value: bigint) => setAmount(formatMinor(value, currency).replace(/[^\d.]/g, ''));
  const quickFills = [
    { label: 'Full balance', value: maxAmountMinor },
    ...(suggestedMinor && suggestedMinor > 0n && suggestedMinor !== maxAmountMinor
      ? [{ label: 'Suggested', value: suggestedMinor }]
      : []),
    ...(maxAmountMinor > 1n ? [{ label: 'Half', value: maxAmountMinor / 2n }] : []),
  ];
  const tone = direction === 'pay' ? tokens.expense : tokens.income;
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Typography variant="heading">
          {direction === 'pay' ? `You paid ${memberName}` : `${memberName} paid you`}
        </Typography>
        <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
          {maxAmountMinor > 0n
            ? `Up to ${formatMinor(maxAmountMinor, currency)} is open between you. Record part of it or all of it.`
            : 'Choose someone with an open balance.'}{' '}
          This records a payment already made; it does not move money.
        </Typography>
      </View>
      <CurrencyInput currency={currency} value={amount} onChangeText={setAmount} />
      {maxAmountMinor > 0n && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {quickFills.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}: ${formatMinor(option.value, currency)}`}
              onPress={() => fill(option.value)}
              style={({ pressed }) => ({
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(tone, 0.4),
                backgroundColor: withAlpha(tone, pressed ? 0.2 : 0.08),
              })}
            >
              <Text style={{ color: tone, fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                {option.label} · {formatMinor(option.value, currency)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {noteOpen ? (
        <View style={{ gap: space.xs }}>
          <Textarea
            accessibilityLabel="Settlement note"
            placeholder="Add a note, e.g. “Paid via UPI”"
            value={note}
            onChangeText={setNote}
            maxLength={SETTLEMENT_NOTE_MAX + 20}
            style={{ minHeight: 72 }}
          />
          <Typography
            variant="caption"
            style={{
              alignSelf: 'flex-end',
              color: noteTooLong ? tokens.destructive : tokens.foregroundMuted,
            }}
          >
            {note.trim().length}/{SETTLEMENT_NOTE_MAX}
          </Typography>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setNoteOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
        >
          <IconTile tone="neutral" size={32}>
            <NotePencil size={16} color={tokens.foregroundMuted} />
          </IconTile>
          <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
            Add a note (optional)
          </Typography>
        </Pressable>
      )}
      {(!!disabledReason || invalidAmount || tooMuch || !!error) && (
        <View
          accessibilityRole={tooMuch || error ? 'alert' : undefined}
          style={{
            flexDirection: 'row',
            gap: space.sm,
            alignItems: 'flex-start',
            padding: space.md,
            borderRadius: 14,
            backgroundColor: withAlpha(
              tooMuch || error || invalidAmount ? tokens.destructive : tokens.warning,
              0.1,
            ),
          }}
        >
          <TriangleAlert
            size={16}
            color={tooMuch || error || invalidAmount ? tokens.destructive : tokens.warning}
          />
          <Typography variant="small" style={{ flex: 1 }}>
            {tooMuch
              ? `That is more than the ${formatMinor(maxAmountMinor, currency)} still open with ${memberName}. Lower the amount; balances may have changed.`
              : invalidAmount
                ? `Enter a positive amount in ${currency}.`
                : (error ?? disabledReason)}
          </Typography>
        </View>
      )}
      <Button
        size="lg"
        disabled={disabled}
        onPress={() => amountMinor !== null && onSave(amountMinor, note.trim() || undefined)}
        accessibilityLabel={saving ? 'Saving settlement' : 'Record settlement'}
        style={!disabled ? { backgroundColor: tokens.settlement } : undefined}
      >
        <Check size={18} color={disabled ? tokens.controlDisabledForeground : tokens.background} />
        <Text
          style={{
            marginLeft: 8,
            color: disabled ? tokens.controlDisabledForeground : tokens.background,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: 15,
          }}
        >
          {saving
            ? 'Saving…'
            : amountMinor && amountMinor > 0n && !tooMuch
              ? `Record ${formatMinor(amountMinor, currency)}`
              : 'Record settlement'}
        </Text>
      </Button>
    </View>
  );
}
