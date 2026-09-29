import React from 'react';
import { Text, useTheme } from '@finapp/ui/native';
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
  const { tokens } = useTheme();
  const formatted = hidden
    ? `${currency === 'INR' ? '₹' : ''}••••••`
    : formatMinor(amount, currency);
  const sizeStyle =
    size === 'hero'
      ? { fontSize: 48, lineHeight: 52, letterSpacing: -2 }
      : size === 'display'
        ? { fontSize: 30, lineHeight: 34, letterSpacing: -0.9 }
        : { fontSize: 15, lineHeight: 20, letterSpacing: -0.1 };
  return (
    <Text
      accessibilityLabel={hidden ? 'Balance hidden' : `${type} ${amount.toString()} ${currency}`}
      style={{
        color: color ?? (emphasize ? tokens.primary : tokens.foreground),
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontVariant: ['tabular-nums'],
        ...sizeStyle,
      }}
    >
      {formatted}
    </Text>
  );
}

export function MoneyText(props: {
  amountMinor: bigint;
  currency: string;
  type?: TransactionType;
}) {
  return <Money {...props} />;
}
