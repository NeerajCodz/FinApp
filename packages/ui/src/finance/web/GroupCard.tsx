import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Typography, useTheme } from '@finapp/ui/web';
import { EntityIcon } from './EntityIconPicker';

export function GroupCard({
  name,
  meta,
  balance,
  meaning,
  icon,
  onPress,
}: {
  name: string;
  meta: string;
  balance: string;
  meaning: string;
  icon?: string;
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
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            width: 44,
            height: 44,
            flex: '0 0 44px',
            placeItems: 'center',
            borderRadius: 15,
            background: tokens.surfaceRaised,
          }}
        >
          <EntityIcon value={icon ?? 'lucide:UsersRound'} size={23} color={tokens.primary} />
        </span>
        <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
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
