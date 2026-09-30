import React, { useState } from 'react';
import { TouchableOpacity, View, type PressableProps } from 'react-native';
import { Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@convex/shared/money';
import { signedMinor } from '../money';
import { semanticLabels, type SemanticType, type TransactionType } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';
export function TransactionRow({
  title,
  merchant,
  category,
  account,
  categoryIcon,
  date,
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
  const { tokens } = useTheme();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const categoryDetails = [
    category ? `Category · ${category}` : undefined,
    merchant ? `Merchant · ${merchant}` : undefined,
    account ? `Account · ${account}` : undefined,
  ].filter((item): item is string => Boolean(item));
  const amountColor =
    type === 'expense'
      ? tokens.expense
      : type === 'income' || type === 'refund'
        ? tokens.income
        : tokens.transfer;
  const accessibleLabel = `${title}, ${date ?? 'Date unavailable'}, ${semanticLabels[semanticType ?? type]}, ${category ?? 'Uncategorized'}${merchant ? `, ${merchant}` : ''}${account ? `, ${account}` : ''}, ${formatMinor(signedMinor(amountMinor, type), currency)}`;
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        zIndex: detailsOpen ? 10 : 0,
      }}
    >
      <View style={{ position: 'relative', zIndex: 11 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Show category details for ${category ?? title}`}
          accessibilityState={{ expanded: detailsOpen }}
          onPress={() => setDetailsOpen((open) => !open)}
          onLongPress={() => setDetailsOpen(true)}
          delayLongPress={350}
          activeOpacity={0.8}
        >
          <CategoryIcon label={category ?? title} icon={categoryIcon} />
        </TouchableOpacity>
        {detailsOpen && categoryDetails.length > 0 && (
          <View
            accessibilityRole="summary"
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 46,
              left: 0,
              zIndex: 20,
              minWidth: 180,
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
              elevation: 8,
            }}
          >
            {categoryDetails.map((detail) => (
              <Typography key={detail} variant="caption">
                {detail}
              </Typography>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibleLabel}
        onPress={onPress ?? undefined}
        disabled={!onPress}
        activeOpacity={0.72}
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Typography
          variant="bodyLarge"
          numberOfLines={1}
          style={{ flex: 1, fontSize: 15, lineHeight: 20 }}
        >
          {title}
        </Typography>
        <Typography variant="caption" numberOfLines={1}>
          {date ?? 'Date unavailable'}
        </Typography>
        <Money amountMinor={amountMinor} currency={currency} type={type} color={amountColor} />
      </TouchableOpacity>
    </View>
  );
}
