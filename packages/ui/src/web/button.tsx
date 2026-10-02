'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

type ButtonAction = (event: React.MouseEvent<HTMLButtonElement>) => unknown;

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: ButtonAction;
  onClick?: ButtonAction;
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
  const [pending, setPending] = React.useState(false);
  const pendingRef = React.useRef(false);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (pendingRef.current || props.disabled) return;
    const results = [onPress?.(event), onClick?.(event)].filter(
      (result): result is PromiseLike<unknown> =>
        typeof result === 'object' && result !== null && 'then' in result,
    );
    if (!results.length) return;
    pendingRef.current = true;
    setPending(true);
    const release = () => {
      pendingRef.current = false;
      setPending(false);
    };
    void Promise.all(results.map((result) => Promise.resolve(result))).finally(release);
  };
  return (
    <button
      {...props}
      type={type}
      disabled={pending || props.disabled}
      aria-busy={pending || props['aria-busy'] || undefined}
      onClick={handleClick}
      role={accessibilityRole ?? role}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-description={accessibilityHint ?? ariaDescription}
      className={['finapp-button', `finapp-button--${variant}`, `finapp-button--${size}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
      {pending && (
        <span aria-hidden="true" style={{ marginInlineStart: 6 }}>
          …
        </span>
      )}
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
