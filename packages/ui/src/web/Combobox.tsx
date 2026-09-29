'use client';

import React from 'react';

export type ComboboxOption = { value: string; label: string; disabled?: boolean };

export type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noResultsText?: string;
};

export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder = 'Search options',
  disabled = false,
  className,
  noResultsText = 'No results found',
}: ComboboxProps) {
  const id = React.useId();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const optionRefs = React.useRef<Array<HTMLLIElement | null>>([]);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const enabledIndices = filtered.flatMap((option, index) => (option.disabled ? [] : [index]));

  React.useEffect(() => {
    if (!open) return;
    const handleOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  const choose = (option: ComboboxOption) => {
    if (option.disabled || disabled) return;
    onChange(option.value);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };
  const moveActive = (direction: 1 | -1) => {
    if (!enabledIndices.length) return;
    const position = enabledIndices.indexOf(activeIndex);
    const nextPosition =
      position < 0
        ? direction === 1
          ? 0
          : enabledIndices.length - 1
        : (position + direction + enabledIndices.length) % enabledIndices.length;
    const nextIndex = enabledIndices[nextPosition];
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div
      ref={rootRef}
      className={['finapp-combobox', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', width: '100%', color: 'var(--finapp-foreground)' }}
    >
      <label
        htmlFor={`${id}-input`}
        style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}
      >
        {label}
      </label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        aria-label={label}
        disabled={disabled}
        value={open ? query : (selected?.label ?? '')}
        placeholder={placeholder}
        onFocus={() => {
          if (!disabled) {
            setQuery('');
            setOpen(true);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) setOpen(true);
            moveActive(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            moveActive(-1);
          } else if (event.key === 'Home' && open && enabledIndices.length) {
            event.preventDefault();
            setActiveIndex(enabledIndices[0]);
          } else if (event.key === 'End' && open && enabledIndices.length) {
            event.preventDefault();
            setActiveIndex(enabledIndices[enabledIndices.length - 1]);
          } else if (event.key === 'Enter' && open && activeIndex >= 0) {
            event.preventDefault();
            const option = filtered[activeIndex];
            if (option) choose(option);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
            setQuery('');
            setActiveIndex(-1);
          } else if (event.key === 'Tab') {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minHeight: 44,
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid var(--finapp-border)',
          background: 'var(--finapp-input)',
          color: 'var(--finapp-foreground)',
          outlineColor: 'var(--finapp-ring)',
          font: 'inherit',
          opacity: disabled ? 0.55 : 1,
        }}
      />
      {open && !disabled && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-label={`${label} options`}
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: 'auto',
            margin: '6px 0 0',
            padding: 4,
            listStyle: 'none',
            border: '1px solid var(--finapp-border)',
            borderRadius: 10,
            background: 'var(--finapp-popover)',
            boxShadow: '0 12px 28px #0005',
          }}
        >
          {filtered.length ? (
            filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                onMouseMove={() => {
                  if (!option.disabled) setActiveIndex(index);
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                style={{
                  padding: '9px 10px',
                  borderRadius: 7,
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                  color: option.disabled
                    ? 'var(--finapp-muted-foreground)'
                    : 'var(--finapp-foreground)',
                  opacity: option.disabled ? 0.55 : 1,
                  background:
                    activeIndex === index
                      ? 'color-mix(in srgb, var(--finapp-accent) 14%, transparent)'
                      : 'transparent',
                }}
              >
                {option.label}
                {option.value === value ? (
                  <span
                    aria-hidden="true"
                    style={{ float: 'right', color: 'var(--finapp-accent)' }}
                  >
                    ✓
                  </span>
                ) : null}
              </li>
            ))
          ) : (
            <li
              role="status"
              aria-live="polite"
              style={{ padding: '9px 10px', color: 'var(--finapp-muted-foreground)' }}
            >
              {noResultsText}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
