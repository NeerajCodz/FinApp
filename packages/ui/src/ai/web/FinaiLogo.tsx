'use client';

import React from 'react';
import { FINAI_LOGO } from '../logo';

/**
 * The FinAI mark in theme colours. The Thinking Orb stays for thinking and working states;
 * this is FinAI's identity (launcher, header, idle avatar).
 */
export function FinaiLogo({
  size = 24,
  title,
  ringColor = 'var(--finapp-foreground)',
  accentColor = 'var(--finapp-primary)',
}: {
  size?: number;
  /** Accessible name; omit when decorative. */
  title?: string;
  ringColor?: string;
  accentColor?: string;
}) {
  const { viewBox, ring, ringWidth, spark, dot } = FINAI_LOGO;
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={ring} stroke={ringColor} strokeWidth={ringWidth} strokeLinecap="round" />
      <path d={spark} fill={accentColor} />
      <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={accentColor} />
    </svg>
  );
}
