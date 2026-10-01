'use client';

import React from 'react';
import { Select, type SelectOption } from './choices';

export type NativeSelectOption = { value: string; label: string; disabled?: boolean };

export type NativeSelectProps = {
  options: readonly NativeSelectOption[];
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
  options, value, onChange, label, disabled = false, className, id, name, required,
  'aria-describedby': ariaDescribedBy,
}: NativeSelectProps) {
  return <Select
    options={options as readonly SelectOption[]}
    value={value}
    onChange={onChange}
    label={label}
    disabled={disabled}
    className={className}
    id={id}
    name={name}
    required={required}
    aria-describedby={ariaDescribedBy}
  />;
}
