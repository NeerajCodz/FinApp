import React from 'react';
import { Car, Landmark, ReceiptText, ShoppingBag, Utensils } from 'lucide-react';
import { useTheme } from '@finapp/ui/web';

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
    <span
      role="img"
      aria-label={`${label} category`}
      style={{
        display: 'inline-flex',
        width: 40,
        height: 40,
        flex: '0 0 40px',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: selected ? tokens.primary : tokens.surfaceRaised,
      }}
    >
      {icon ? (
        <span style={{ fontSize: 21, lineHeight: '26px' }}>{icon}</span>
      ) : (
        <Icon size={19} color={selected ? tokens.primaryForeground : tokens.foregroundMuted} />
      )}
    </span>
  );
}
