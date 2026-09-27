import React from 'react';
import { View } from 'react-native';
import { Typography, useTheme } from '@finapp/ui/native';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  UsersThree,
} from '@finapp/ui/icons/native';
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
          ? UsersThree
          : type === 'settlement'
            ? Check
            : ArrowLeftRight;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${semanticLabels[type]} transaction type`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: `${color}24`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={13} color={color} strokeWidth={2.2} />
      </View>
      <Typography variant="caption" style={{ color, fontFamily: 'SpaceGrotesk_600SemiBold' }}>
        {semanticLabels[type]}
      </Typography>
    </View>
  );
}
