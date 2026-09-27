'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Typography, useTheme } from '@finapp/ui/web';
import { Money } from './Money';

export function BalanceHero({
  label = 'Available',
  amountMinor,
  currency,
  delta,
}: {
  label?: string;
  amountMinor: bigint;
  currency: string;
  delta?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const { tokens } = useTheme();
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography variant="label">{label}</Typography>
        <button
          type="button"
          aria-label={hidden ? 'Show balance' : 'Hide balance'}
          onClick={() => setHidden((current) => !current)}
          style={{
            display: 'grid',
            width: 28,
            height: 28,
            placeItems: 'center',
            border: 0,
            padding: 0,
            background: 'transparent',
            color: tokens.foregroundSubtle,
            cursor: 'pointer',
          }}
        >
          {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <Money amountMinor={amountMinor} currency={currency} size="hero" hidden={hidden} />
      {delta && (
        <Typography variant="small" style={{ color: tokens.primary, fontWeight: 500 }}>
          {delta}
        </Typography>
      )}
    </div>
  );
}
