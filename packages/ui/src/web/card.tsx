'use client';

import React from 'react';

export function Card({
  children,
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'subtle' | 'outline' }) {
  return (
    <div
      {...props}
      className={['finapp-card', `finapp-card--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
