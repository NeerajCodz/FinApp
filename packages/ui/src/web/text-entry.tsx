'use client';

import React, { useRef } from 'react';

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onChangeText?: (value: string) => void;
  error?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
};

export function Textarea({
  onChange,
  onChangeText,
  error = false,
  className,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  'aria-label': ariaLabel,
  role,
  'aria-description': ariaDescription,
  'aria-invalid': ariaInvalid,
  ...props
}: TextareaProps) {
  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    onChange?.(event);
    onChangeText?.(event.currentTarget.value);
  };
  return (
    <textarea
      {...props}
      onChange={handleChange}
      role={accessibilityRole ?? role}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-description={accessibilityHint ?? ariaDescription}
      aria-invalid={ariaInvalid ?? (error || undefined)}
      className={['finapp-input', 'finapp-textarea', error && 'is-error', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function InputOTP({
  value,
  onChangeText,
  length = 6,
  className,
  label = 'One-time password',
}: {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  className?: string;
  label?: string;
}) {
  const digits = value.replace(/\D/g, '').slice(0, length);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={['finapp-otp', className].filter(Boolean).join(' ')}>
      <div
        className="finapp-otp__cells"
        aria-hidden="true"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }, (_, index) => (
          <span className="finapp-otp__cell" key={index}>
            {digits[index] ?? ''}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        className="finapp-otp__input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        aria-label={label}
        value={digits}
        maxLength={length}
        onChange={(event) =>
          onChangeText(event.currentTarget.value.replace(/\D/g, '').slice(0, length))
        }
      />
    </div>
  );
}
