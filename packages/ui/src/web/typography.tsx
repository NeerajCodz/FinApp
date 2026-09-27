'use client';

import React from 'react';
import type { ThemeMode } from '../tokens';

export type Appearance = ThemeMode | 'system';

export function getTouchTargetStyle(style: React.CSSProperties = {}): React.CSSProperties {
  return { minWidth: 44, minHeight: 44, ...style };
}

type TextProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
};

export function Text({
  as: Component = 'span',
  className,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  ...props
}: TextProps) {
  return (
    <Component
      className={['finapp-text', className].filter(Boolean).join(' ')}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-description={accessibilityHint}
      {...props}
    />
  );
}

export type TypographyVariant =
  'hero' | 'display' | 'title' | 'heading' | 'bodyLarge' | 'body' | 'small' | 'caption' | 'label';

type TypographyProps = TextProps & { variant?: TypographyVariant };
const typographyTags: Record<TypographyVariant, React.ElementType> = {
  hero: 'h1',
  display: 'h1',
  title: 'h2',
  heading: 'h3',
  bodyLarge: 'p',
  body: 'p',
  small: 'small',
  caption: 'small',
  label: 'span',
};

export function Typography({
  variant = 'body',
  as,
  className,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  ...props
}: TypographyProps) {
  const Component = as ?? typographyTags[variant];
  return (
    <Component
      className={['finapp-typography', `finapp-typography--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-description={accessibilityHint}
      {...props}
    />
  );
}
