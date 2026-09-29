'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';

export type SpinnerProps = {
  size?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
};

const animationStyle = `@keyframes finapp-spinner-rotate { to { transform: rotate(360deg); } }\n@media (prefers-reduced-motion: reduce) { .finapp-spinner-rotor { animation: none !important; } }`;

export function Spinner({ size = 24, label = 'Loading', className, style }: SpinnerProps) {
  const { tokens } = useTheme();
  const dimension = Math.max(12, size);
  const strokeWidth = Math.max(2, dimension / 10);
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuetext={label}
      aria-busy="true"
      className={className}
      style={{
        display: 'inline-flex',
        width: dimension,
        height: dimension,
        color: tokens.primary,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <style>{animationStyle}</style>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="100%" height="100%">
        <circle
          cx="12"
          cy="12"
          r={10 - strokeWidth / 2}
          fill="none"
          stroke={tokens.borderSubtle}
          strokeWidth={strokeWidth}
        />
        <circle
          className="finapp-spinner-rotor"
          cx="12"
          cy="12"
          r={10 - strokeWidth / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="38 24"
          style={{
            transformOrigin: 'center',
            animation: 'finapp-spinner-rotate 900ms linear infinite',
          }}
        />
      </svg>
    </span>
  );
}
