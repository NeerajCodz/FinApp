'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from './button';
import { Popover } from './overlay';

export type FilterOptionPopoverOption = { label: string; value: string };

export function FilterOptionPopover({
  label,
  title = label,
  options,
  value,
  displayValue,
  onChange,
}: {
  label: string;
  title?: string;
  options: readonly FilterOptionPopoverOption[];
  value: string;
  displayValue?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const currentLabel = displayValue ?? selected?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      rootRef.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="finapp-filter-option-popover" ref={rootRef}>
      <Button
        accessibilityLabel={`${label}: ${currentLabel}. Change ${label.toLowerCase()}`}
        accessibilityRole="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="finapp-filter-option-popover__trigger"
        onPress={() => setOpen((current) => !current)}
        variant="ghost"
        size="sm"
      >
        {label}: {currentLabel}
      </Button>
      <Popover visible={open} className="finapp-filter-option-popover__menu">
        <div role="menu" aria-label={title} className="finapp-filter-option-popover__options">
          {options.map((option) => (
            <Button
              key={option.value}
              role="menuitemradio"
              aria-checked={option.value === value}
              variant={option.value === value ? 'secondary' : 'ghost'}
              size="sm"
              className="finapp-filter-option-popover__option"
              onPress={() => {
                onChange(option.value);
                rootRef.current?.querySelector('button')?.focus();
                setOpen(false);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Popover>
    </div>
  );
}
