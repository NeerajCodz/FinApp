'use client';

import React, { useId, useRef } from 'react';
import { Label } from './fields';

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      className={['finapp-choice', disabled && 'is-disabled', className].filter(Boolean).join(' ')}
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="finapp-choice__indicator" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function RadioGroup({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: {
  options: { label: string; value: string }[];
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset
      aria-label={label ? undefined : 'Options'}
      className={['finapp-radio-group', className].filter(Boolean).join(' ')}
      disabled={disabled}
    >
      {label && <legend className="finapp-label">{label}</legend>}
      {options.map((option, index) => (
        <label className="finapp-choice" key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            tabIndex={value === undefined ? (index === 0 ? 0 : -1) : undefined}
          />
          <span className="finapp-choice__indicator" aria-hidden="true" />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Switch({
  value,
  onValueChange,
  label,
  disabled = false,
  className,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={['finapp-switch-row', className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onValueChange(!value)}
        className="finapp-switch"
      >
        <span className="finapp-switch__thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId().replace(/:/g, '');
  const selectByKeyboard: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || tabs.length === 0)
      return;
    event.preventDefault();
    const current = tabs.findIndex((tab) => tab.value === value);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const selected = tabs[next];
    if (!selected) return;
    onChange(selected.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label ?? 'Sections'}
      onKeyDown={selectByKeyboard}
      className={['finapp-tabs', className].filter(Boolean).join(' ')}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          id={`${id}-tab-${index}`}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          tabIndex={tab.value === value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          className="finapp-tab"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Select({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={['finapp-field', className].filter(Boolean).join(' ')}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="finapp-input finapp-select"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {!value && (
          <option value="" disabled>
            Select {label.toLowerCase()}
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
