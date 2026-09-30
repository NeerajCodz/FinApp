'use client';

import React from 'react';

export type NativeSelectOption = { value: string; label: string; disabled?: boolean };

export type NativeSelectProps = {
  options: NativeSelectOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  'aria-describedby'?: string;
};

export function NativeSelect({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
  id,
  name,
  required,
  'aria-describedby': ariaDescribedBy,
}: NativeSelectProps) {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;

  return (
    <label
      htmlFor={selectId}
      style={{
        display: 'grid',
        gap: '0.4rem',
        color: 'var(--finapp-foreground, #f5f5f5)',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      {label}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
        required={required}
        aria-describedby={ariaDescribedBy}
        className={className}
        style={{
          width: '100%',
          minHeight: 44,
          padding: '0.55rem 0.75rem',
          border: '1px solid var(--finapp-border-subtle, rgba(255,255,255,.14))',
          borderRadius: '0.7rem',
          color: 'var(--finapp-foreground, #f5f5f5)',
          background: 'var(--finapp-input, #191919)',
          font: 'inherit',
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {options.length === 0 ? (
          <option value="">No options available</option>
        ) : (
          options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
