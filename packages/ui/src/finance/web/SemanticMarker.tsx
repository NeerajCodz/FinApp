import React from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  UsersRound,
} from 'lucide-react';
import { Typography, useTheme } from '@finapp/ui/web';
import { semanticLabels, type SemanticType } from '../types';

export function SemanticMarker({ type }: { type: SemanticType }) {
  const { tokens } = useTheme();
  const color =
    type === 'expense'
      ? tokens.expense
      : type === 'income' || type === 'refund'
        ? tokens.income
        : type === 'split'
          ? tokens.split
          : type === 'settlement'
            ? tokens.settlement
            : tokens.transfer;
  const Icon =
    type === 'expense'
      ? ArrowUpRight
      : type === 'income' || type === 'refund'
        ? ArrowDownRight
        : type === 'split'
          ? UsersRound
          : type === 'settlement'
            ? Check
            : ArrowLeftRight;
  return (
    <span
      role="text"
      aria-label={`${semanticLabels[type]} transaction type`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
    >
      <span
        style={{
          display: 'inline-flex',
          width: 22,
          height: 22,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 11,
          backgroundColor: `${color}24`,
        }}
      >
        <Icon size={13} color={color} strokeWidth={2.2} />
      </span>
      <Typography variant="caption" style={{ color, fontWeight: 600 }}>
        {semanticLabels[type]}
      </Typography>
    </span>
  );
}
