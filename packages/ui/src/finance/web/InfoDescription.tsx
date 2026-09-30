'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { useTheme } from '@finapp/ui/web';

export type InfoDescriptionProps = {
  title: string;
  description: string;
};

export function InfoDescription({ title, description }: InfoDescriptionProps) {
  const { tokens } = useTheme();
  const id = useId();
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const dismissOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More about ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((visible) => !visible)}
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: 28,
          height: 28,
          padding: 0,
          border: `1px solid ${tokens.borderSubtle}`,
          borderRadius: '50%',
          background: 'transparent',
          color: tokens.foregroundMuted,
          cursor: 'pointer',
        }}
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {open && (
        <section
          id={id}
          role="dialog"
          aria-label={`${title} information`}
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 8px)',
            left: 0,
            width: 'min(320px, calc(100vw - 40px))',
            display: 'grid',
            gap: 10,
            padding: 16,
            border: `1px solid ${tokens.borderSubtle}`,
            borderRadius: 14,
            background: tokens.popover,
            color: tokens.popoverForeground,
            boxShadow: '0 12px 32px rgb(0 0 0 / 0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <strong style={{ fontSize: 14 }}>{title}</strong>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close information"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              style={{
                display: 'grid',
                placeItems: 'center',
                flex: '0 0 auto',
                width: 28,
                height: 28,
                margin: -6,
                padding: 0,
                border: 0,
                borderRadius: 8,
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p style={{ margin: 0, color: tokens.foregroundMuted, fontSize: 13, lineHeight: 1.5 }}>
            {description}
          </p>
        </section>
      )}
    </span>
  );
}
