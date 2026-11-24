'use client';

/**
 * Thinking Orb for the web: Thinking Orbs (https://thinkingorbs.com, `@yogesharc/thinking-orbs`,
 * MIT, Copyright (c) 2026 Yogesh). The orb draws in `currentColor`, set here from the theme's
 * primary token. Same props as the native port.
 */
import React from 'react';
import { Orb } from '@yogesharc/thinking-orbs';
import type { ThinkingOrbProps } from '../ai/orbModel';

export type { ThinkingOrbProps, ThinkingOrbState } from '../ai/orbModel';

export function ThinkingOrb({
  state = 'reasoning',
  size = 20,
  label,
  caption,
  paused = false,
}: ThinkingOrbProps) {
  return (
    <span
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-busy={!paused}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--finapp-primary)' }}>
        <Orb state={state} size={size} paused={paused} />
      </span>
      {caption ? (
        <span aria-live="polite" style={{ color: 'var(--finapp-foreground-muted)' }}>
          {caption}
        </span>
      ) : null}
    </span>
  );
}
