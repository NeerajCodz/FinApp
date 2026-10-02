'use client';

import React, { useState } from 'react';

export type ToggleGroupOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type ToggleGroupBaseProps = {
  options: ToggleGroupOption[];
  label: string;
  minSelected?: number;
  maxSelected?: number;
  className?: string;
  style?: React.CSSProperties;
};

export type SingleToggleGroupProps = ToggleGroupBaseProps & {
  type: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
};

export type MultipleToggleGroupProps = ToggleGroupBaseProps & {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

export type ToggleGroupProps = SingleToggleGroupProps | MultipleToggleGroupProps;

export function ToggleGroup(props: ToggleGroupProps) {
  const [internalValue, setInternalValue] = useState<string | string[] | undefined>(
    props.defaultValue ?? (props.type === 'single' ? undefined : []),
  );
  const controlled = Object.prototype.hasOwnProperty.call(props, 'value');
  const selected: string[] =
    props.type === 'multiple'
      ? controlled
        ? ((props.value as string[] | undefined) ?? [])
        : (internalValue as string[])
      : controlled
        ? props.value
          ? [props.value as string]
          : []
        : internalValue
          ? [internalValue as string]
          : [];
  const setSelection = (next: string[]) => {
    if (!controlled) setInternalValue(props.type === 'multiple' ? next : next[0]);
    if (props.type === 'multiple') props.onValueChange?.(next);
    else props.onValueChange?.(next[0]);
  };
  const activate = (value: string) => {
    const option = props.options.find((item) => item.value === value);
    if (!option || option.disabled) return;
    const next =
      props.type === 'single'
        ? selected.includes(value)
          ? []
          : [value]
        : selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value];
    const min = props.minSelected ?? 0;
    const max = props.maxSelected ?? (props.type === 'single' ? 1 : props.options.length);
    if (next.length < min || next.length > max) return;
    setSelection(next);
  };

  return (
    <div
      role={props.type === 'single' ? 'radiogroup' : 'group'}
      aria-label={props.label}
      className={props.className}
      style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, ...props.style }}
    >
      {props.options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role={props.type === 'single' ? 'radio' : undefined}
            aria-checked={props.type === 'single' ? isSelected : undefined}
            aria-pressed={props.type === 'multiple' ? isSelected : undefined}
            aria-label={typeof option.label === 'string' ? option.label : undefined}
            disabled={option.disabled}
            onClick={() => activate(option.value)}
            style={{
              minHeight: 40,
              padding: '0.55rem 0.9rem',
              border: `1px solid ${isSelected ? 'var(--finapp-primary)' : 'var(--finapp-border, #333)'}`,
              borderRadius: 999,
              background: isSelected
                ? 'var(--finapp-primary)'
                : 'var(--finapp-surface-subtle, #111)',
              color: isSelected
                ? 'var(--finapp-primary-foreground, #000)'
                : 'var(--finapp-foreground, #fff)',
              opacity: option.disabled ? 0.5 : 1,
              cursor: option.disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
