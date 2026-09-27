'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
};

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  type = 'button',
  className,
  onPress,
  onClick,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  'aria-label': ariaLabel,
  role,
  'aria-description': ariaDescription,
  ...props
}: ButtonProps) {
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onPress?.(event);
    onClick?.(event);
  };
  return (
    <button
      {...props}
      type={type}
      onClick={handleClick}
      role={accessibilityRole ?? role}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-description={accessibilityHint ?? ariaDescription}
      className={['finapp-button', `finapp-button--${variant}`, `finapp-button--${size}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  label,
  variant = 'outline',
  ...props
}: Omit<ButtonProps, 'children'> & { children: React.ReactNode; label: string }) {
  return (
    <Button
      aria-label={label}
      variant={variant}
      size="icon"
      {...props}
      className={['finapp-icon-button', props.className].filter(Boolean).join(' ')}
    >
      {children}
    </Button>
  );
}
