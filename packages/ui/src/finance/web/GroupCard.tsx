import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, Typography, useTheme } from '@finapp/ui/web';
import { EntityIcon } from './EntityIconPicker';

export function GroupCard({
  name,
  meta,
  balance,
  meaning,
  icon,
  color,
  onPress,
  onOpenChat,
}: {
  name: string;
  meta: string;
  balance: string;
  meaning: string;
  icon?: string;
  color?: string;
  onPress?: () => void;
  onOpenChat?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <div
      style={{
        border: `1px solid ${tokens.borderSubtle}`,
        borderRadius: 18,
        background: tokens.surfaceSubtle,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        aria-label={`${name}, ${meaning} ${balance}`}
        onClick={onPress}
        style={{
          display: 'grid',
          width: '100%',
          border: 0,
          background: 'transparent',
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
              background: color ?? tokens.surfaceRaised,
              color: color ? '#101510' : tokens.primary,
            }}
          >
            <EntityIcon
              value={icon ?? 'phosphor:UsersThree'}
              size={23}
              color={color ? '#101510' : tokens.primary}
            />
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
      {onOpenChat && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 18px 16px' }}>
          <Button size="sm" variant="outline" onPress={onOpenChat}>
            Open chat
          </Button>
        </div>
      )}
    </div>
  );
}
