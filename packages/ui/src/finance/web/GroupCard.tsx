import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Typography, useTheme } from '@finapp/ui/web';

export function GroupCard({
  name,
  meta,
  balance,
  meaning,
  onPress,
}: {
  name: string;
  meta: string;
  balance: string;
  meaning: string;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <button
      type="button"
      aria-label={`${name}, ${meaning} ${balance}`}
      onClick={onPress}
      style={{
        display: 'grid',
        width: '100%',
        border: `1px solid ${tokens.borderSubtle}`,
        borderRadius: 18,
        background: tokens.surfaceSubtle,
        color: tokens.foreground,
        padding: 18,
        gap: 20,
        textAlign: 'left',
        cursor: onPress ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <Typography variant="heading">{name}</Typography>
          <Typography variant="caption">{meta}</Typography>
        </div>
        <ChevronRight size={18} color={tokens.foregroundSubtle} aria-hidden="true" />
      </div>
      <div style={{ display: 'grid', gap: 3 }}>
        <Typography variant="heading" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {balance}
        </Typography>
        <Typography variant="caption">{meaning}</Typography>
      </div>
    </button>
  );
}
