'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import { Popover } from './overlay';
import type { QuickFilterGroup } from '../quickFilters';
export type { QuickFilterGroup, QuickFilterOption } from '../quickFilters';

export function QuickFiltersPopover({ groups }: { groups: readonly QuickFilterGroup[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  return (
    <div className="quick-filters-popover-root" ref={rootRef}>
      <button
        type="button"
        className="quick-filters-popover-trigger"
        aria-label="Filter"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Filter size={15} aria-hidden="true" />
        <span>Filter</span>
      </button>
      <Popover visible={open} className="quick-filters-popover-popup">
        <div role="dialog" aria-label="Filters" className="quick-filters-popover-groups">
          {groups.map((group) => (
            <section className="quick-filters-popover-group" key={group.id}>
              <strong>{group.label}</strong>
              <div>
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={option.value === group.value}
                    onClick={() => group.onChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Popover>
    </div>
  );
}
