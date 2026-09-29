'use client';

import React from 'react';
import { formatMinor } from '@convex/shared/money';
import { signedMinor } from '../money';
import type { MoneySize, TransactionType } from '../types';

export function Money({
  amountMinor,
  currency,
  type = 'income',
  size = 'body',
  hidden = false,
  emphasize = false,
  color,
}: {
  amountMinor: bigint;
  currency: string;
  type?: TransactionType;
  size?: MoneySize;
  hidden?: boolean;
  emphasize?: boolean;
  color?: string;
}) {
  const amount = signedMinor(amountMinor, type);
  const formatted = hidden
    ? `${currency === 'INR' ? '₹' : ''}••••••`
    : formatMinor(amount, currency);
  const sizeStyle =
    size === 'hero'
      ? { fontSize: 48, lineHeight: '52px', letterSpacing: -2 }
      : size === 'display'
        ? { fontSize: 30, lineHeight: '34px', letterSpacing: -0.9 }
        : { fontSize: 15, lineHeight: '20px', letterSpacing: -0.1 };
  return (
    <span
      aria-label={hidden ? 'Balance hidden' : `${type} ${amount.toString()} ${currency}`}
      style={{
        color: color ?? (emphasize ? 'var(--finapp-primary)' : 'var(--finapp-foreground)'),
        fontFamily: 'var(--finapp-font-sans)',
        fontSize: sizeStyle.fontSize,
        lineHeight: sizeStyle.lineHeight,
        letterSpacing: sizeStyle.letterSpacing,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatted}
    </span>
  );
}

export function MoneyText(props: {
  amountMinor: bigint;
  currency: string;
  type?: TransactionType;
}) {
  return <Money {...props} />;
}
