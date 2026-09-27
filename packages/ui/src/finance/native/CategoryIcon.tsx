import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from '@finapp/ui/native';
import { Car, Landmark, ReceiptText, ShoppingBag, Utensils } from '@finapp/ui/icons/native';

function resolveCategoryIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('food') || normalized.includes('coffee')) return Utensils;
  if (normalized.includes('transport') || normalized.includes('uber')) return Car;
  if (normalized.includes('shop')) return ShoppingBag;
  if (normalized.includes('bank') || normalized.includes('account')) return Landmark;
  return ReceiptText;
}

export function CategoryIcon({
  label,
  icon,
  selected = false,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
}) {
  const { tokens } = useTheme();
  const Icon = resolveCategoryIcon(label);
  return (
    <View
      accessibilityLabel={`${label} category`}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: selected ? tokens.primary : tokens.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? (
        <Text style={{ fontSize: 21, lineHeight: 26 }}>{icon}</Text>
      ) : (
        <Icon size={19} color={selected ? tokens.primaryForeground : tokens.foregroundMuted} />
      )}
    </View>
  );
}
