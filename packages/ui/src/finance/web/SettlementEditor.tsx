'use client';

import React, { useState } from 'react';
import { Check, NotebookPen, TriangleAlert } from 'lucide-react';
import { Button, IconTile, Textarea } from '@finapp/ui/web';
import { formatMinor, parseMinor } from '../money';
import { SETTLEMENT_NOTE_MAX } from '../groupSettle';
import { CurrencyInput } from './CurrencyInput';
import styles from './GroupSettle.module.css';

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
  suggestedMinor?: bigint;
  disabledReason?: string;
  saving?: boolean;
  error?: string;
  onSave: (amountMinor: bigint, note?: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  let amountMinor: bigint | null = null;
  try {
    amountMinor = parseMinor(amount, currency);
  } catch {
    // Keep incomplete values editable; invalid values cannot be submitted.
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
  const tone = direction === 'pay' ? 'var(--finapp-expense)' : 'var(--finapp-income)';
  const problem = tooMuch
    ? `That is more than the ${formatMinor(maxAmountMinor, currency)} still open with ${memberName}. Lower the amount; balances may have changed.`
    : invalidAmount
      ? `Enter a positive amount in ${currency}.`
      : (error ?? disabledReason);
  return (
    <form
      style={{ display: 'grid', gap: 16 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && amountMinor !== null) onSave(amountMinor, note.trim() || undefined);
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0 }}>
          {direction === 'pay' ? `You paid ${memberName}` : `${memberName} paid you`}
        </h3>
        <p className={styles.muted}>
          {maxAmountMinor > 0n
            ? `Up to ${formatMinor(maxAmountMinor, currency)} is open between you. Record part of it or all of it.`
            : 'Choose someone with an open balance.'}{' '}
          This records a payment already made; it does not move money.
        </p>
      </div>
      <CurrencyInput currency={currency} value={amount} onChangeText={setAmount} />
      {maxAmountMinor > 0n && (
        <div className={styles.chips} style={{ '--tone': tone } as React.CSSProperties}>
          {quickFills.map((option) => (
            <button
              key={option.label}
              type="button"
              className={styles.quick}
              onClick={() => fill(option.value)}
            >
              {option.label} · {formatMinor(option.value, currency)}
            </button>
          ))}
        </div>
      )}
      {noteOpen ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <Textarea
            aria-label="Settlement note"
            placeholder="Add a note, e.g. “Paid via UPI”"
            value={note}
            onChangeText={setNote}
            maxLength={SETTLEMENT_NOTE_MAX + 20}
            rows={3}
          />
          <span className={styles.counter} data-over={noteTooLong || undefined}>
            {note.trim().length}/{SETTLEMENT_NOTE_MAX}
          </span>
        </div>
      ) : (
        <button type="button" className={styles.noteToggle} onClick={() => setNoteOpen(true)}>
          <IconTile tone="neutral" size={32}>
            <NotebookPen size={16} />
          </IconTile>
          Add a note (optional)
        </button>
      )}
      {problem && (
        <p
          className={styles.notice}
          data-tone={tooMuch || invalidAmount || error ? 'error' : undefined}
          role={tooMuch || error ? 'alert' : 'status'}
        >
          <TriangleAlert size={16} />
          <span>{problem}</span>
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={disabled}
        accessibilityLabel={saving ? 'Saving settlement' : 'Record settlement'}
        style={
          !disabled
            ? {
                background: 'var(--finapp-settlement)',
                color: 'var(--finapp-background)',
              }
            : undefined
        }
      >
        <Check size={18} />{' '}
        {saving
          ? 'Saving…'
          : amountMinor && amountMinor > 0n && !tooMuch
            ? `Record ${formatMinor(amountMinor, currency)}`
            : 'Record settlement'}
      </Button>
    </form>
  );
}
