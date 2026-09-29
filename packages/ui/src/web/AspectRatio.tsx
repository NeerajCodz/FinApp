'use client';

import React from 'react';

export type AspectRatioProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  ratio?: number;
  children: React.ReactNode;
};

export function AspectRatio({ ratio = 1, children, className, style, ...props }: AspectRatioProps) {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;

  return (
    <div
      {...props}
      className={['finapp-aspect-ratio', className].filter(Boolean).join(' ')}
      style={{
        aspectRatio: safeRatio,
        overflow: 'hidden',
        backgroundColor: 'var(--finapp-surface-raised, var(--finapp-card))',
        border: '1px solid var(--finapp-border-subtle)',
        borderRadius: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
