'use client';

import React from 'react';

export type DirectionProps = {
  dir: 'ltr' | 'rtl';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/** Sets bidirectional text and layout direction for all descendants. */
export function Direction({ dir, children, className, style }: DirectionProps) {
  return (
    <div dir={dir} className={className} style={{ ...style, direction: dir }}>
      {children}
    </div>
  );
}
