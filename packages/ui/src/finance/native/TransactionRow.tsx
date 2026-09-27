import React from 'react';
import { TouchableOpacity, View, type PressableProps } from 'react-native';
import { Typography } from '@finapp/ui/native';
import { formatMinor } from '@convex/shared/money';
import { signedMinor } from '../money';
import { semanticLabels, type SemanticType, type TransactionType } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';
import { SemanticMarker } from './SemanticMarker';

export function TransactionRow({
  title,
  merchant,
  category,
  account,
  categoryIcon,
  date,
  status,
  amountMinor,
  currency,
  type,
  semanticType,
  onPress,
}: {
  title: string;
  merchant?: string;
  category?: string;
  categoryIcon?: string;
  account?: string;
  date?: string;
  status?: string;
  amountMinor: bigint;
  currency: string;
  semanticType?: SemanticType;
  type: TransactionType;
  onPress?: PressableProps['onPress'];
}) {
  const detail = [merchant ?? category, account].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${semanticLabels[semanticType ?? type]}, ${detail}, ${formatMinor(signedMinor(amountMinor, type), currency)}`}
      onPress={onPress ?? undefined}
      disabled={!onPress}
      activeOpacity={0.72}
      style={{
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <CategoryIcon label={category ?? title} icon={categoryIcon} />
      <View style={{ flex: 1, gap: 3 }}>
        <Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
          {title}
        </Typography>
        {!!detail && (
          <Typography variant="caption" numberOfLines={1}>
            {detail}
          </Typography>
        )}
        <SemanticMarker type={semanticType ?? type} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Money amountMinor={amountMinor} currency={currency} type={type} />
        <Typography variant="caption">{status ?? date}</Typography>
      </View>
    </TouchableOpacity>
  );
}
