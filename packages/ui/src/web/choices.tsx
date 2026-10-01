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

export type SelectOption = string | { value: string; label: string; disabled?: boolean };
export type SelectProps = {
  label: string;
  options: readonly SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export function Select({
  label, options, value = '', onChange, disabled = false, className, id, name, required,
  placeholder, style, 'aria-label': ariaLabel, 'aria-describedby': describedBy, 'aria-invalid': invalid,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const normalized = options.map((option) => typeof option === 'string'
    ? { value: option, label: option, disabled: false }
    : { ...option, disabled: option.disabled ?? false });
  const selectedIndex = normalized.findIndex((option) => option.value === value);
  const selected = normalized[selectedIndex];
  const enabled = normalized.flatMap((option, index) => option.disabled ? [] : [index]);
  const listboxId = `${selectId}-listbox`;
  const optionId = (index: number) => `${selectId}-option-${index}`;
  const close = () => { setOpen(false); setActiveIndex(-1); };
  const choose = (index: number) => {
    const option = normalized[index];
    if (!option || option.disabled || disabled) return;
    onChange(option.value);
    close();
    buttonRef.current?.focus();
  };
  const move = (direction: 1 | -1) => {
    if (!enabled.length) return;
    const current = enabled.indexOf(activeIndex >= 0 ? activeIndex : selectedIndex);
    const next = enabled[(current + direction + enabled.length) % enabled.length]!;
    setActiveIndex(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
  };
  React.useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !buttonRef.current?.parentElement?.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div className={['finapp-field', 'finapp-select-root', className].filter(Boolean).join(' ')} style={{ position: 'relative', minWidth: 0 }}>
      {label && <label htmlFor={selectId} className="finapp-select-label">{label}</label>}
      <button
        ref={buttonRef} id={selectId} type="button" role="combobox" aria-label={ariaLabel || (label || undefined)}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-describedby={describedBy} aria-invalid={invalid} disabled={disabled}
        onClick={() => { setOpen((current) => !current); setActiveIndex(selectedIndex >= 0 ? selectedIndex : enabled[0] ?? -1); }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) { setOpen(true); setActiveIndex(selectedIndex >= 0 ? selectedIndex : enabled[0] ?? -1); }
            else move(event.key === 'ArrowDown' ? 1 : -1);
          } else if (event.key === 'Home' && open && enabled.length) { event.preventDefault(); setActiveIndex(enabled[0]!); }
          else if (event.key === 'End' && open && enabled.length) { event.preventDefault(); setActiveIndex(enabled[enabled.length - 1]!); }
          else if ((event.key === 'Enter' || event.key === ' ') && open && activeIndex >= 0) { event.preventDefault(); choose(activeIndex); }
          else if (event.key === 'Escape' && open) { event.preventDefault(); close(); }
          else if (event.key === 'Tab') close();
          else if (event.key.length === 1) {
            const match = normalized.findIndex((option) => !option.disabled && option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
            if (match >= 0) { event.preventDefault(); choose(match); }
          }
        }}
        className="finapp-select-trigger"
        style={{
          boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, width: '100%', minHeight: 44, padding: '10px 12px', textAlign: 'left',
          border: '1px solid var(--finapp-border)', borderRadius: 10, background: 'var(--finapp-input)',
          color: 'var(--finapp-foreground)', font: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
          ...style,
        }}
      >
        <span>{selected?.label ?? placeholder ?? `Select ${label.toLowerCase()}`}</span>
        <span aria-hidden="true" style={{ color: 'var(--finapp-foreground-muted)' }}>▾</span>
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      {required && <select
        aria-hidden="true" tabIndex={-1} value={value} required disabled={disabled}
        onInvalid={(event) => { event.preventDefault(); buttonRef.current?.focus(); }}
        onChange={() => {}}
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
      ><option value="" />{normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
      {open && <ul id={listboxId} role="listbox" aria-label={label || ariaLabel} className="finapp-select-popup" style={{
        position: 'absolute', zIndex: 1000, insetInline: 0, top: 'calc(100% + 4px)', maxHeight: 280, overflowY: 'auto',
        margin: 0, padding: 4, listStyle: 'none', border: '1px solid var(--finapp-border)',
        borderRadius: 10, background: 'var(--finapp-surface-raised, var(--finapp-input))',
        color: 'var(--finapp-foreground)', boxShadow: '0 8px 24px rgba(0,0,0,.22)',
      }}>
        {normalized.map((option, index) => <li
          key={option.value} id={optionId(index)} role="option" aria-selected={option.value === value}
          aria-disabled={option.disabled || undefined}
          onMouseMove={() => !option.disabled && setActiveIndex(index)}
          onClick={() => choose(index)}
          style={{
            padding: '9px 10px', borderRadius: 7, cursor: option.disabled ? 'not-allowed' : 'pointer',
            opacity: option.disabled ? 0.5 : 1,
            background: index === activeIndex ? 'var(--finapp-hover, rgba(127,127,127,.16))' : 'transparent',
          }}
        >{option.label}</li>)}
      </ul>}
    </div>
  );
}

export type CustomSelectProps = Omit<SelectProps, 'options' | 'onChange' | 'label'> & {
  children: React.ReactNode;
  onChange: (event: { currentTarget: { value: string }; target: { value: string } }) => void;
};

/** Native-select-shaped API backed by the themed accessible listbox. */
export function CustomSelect({ children, onChange, ...props }: CustomSelectProps) {
  const options = React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<{ value?: string; disabled?: boolean; children?: React.ReactNode }>(child) || child.type !== 'option') return [];
    const value = child.props.value ?? '';
    const label = typeof child.props.children === 'string' || typeof child.props.children === 'number'
      ? String(child.props.children)
      : React.Children.toArray(child.props.children).map((part) => typeof part === 'string' || typeof part === 'number' ? String(part) : '').join('');
    return [{ value, label, disabled: child.props.disabled }];
  });
  return <Select {...props} label="" options={options} onChange={(value) => {
    const event = { currentTarget: { value }, target: { value } };
    onChange(event);
  }} />;
}
