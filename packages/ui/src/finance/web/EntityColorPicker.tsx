'use client';

import React, { useEffect, useState } from 'react';
import { Button, Text, useTheme } from '@finapp/ui/web';
import { entityColorSwatches, getColorToneSwatches } from '../color-picker-data';

export function EntityColorPicker({
  value,
  onChange,
  compact = false,
  label,
  disabled = false,
}: {
  value?: string;
  onChange: (value?: string) => void;
  compact?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customColor, setCustomColor] = useState(
    /^#[\da-f]{6}$/i.test(value ?? '') ? value!.toUpperCase() : '#000000',
  );
  const [customHue, setCustomHue] = useState(90);
  const triggerLabel = label ?? (value ? 'Change color' : 'Choose color');

  useEffect(() => {
    if (!open) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setCustomOpen(false);
      }
    };
    window.addEventListener('keydown', dismissOnEscape);
    return () => window.removeEventListener('keydown', dismissOnEscape);
  }, [open]);

  const close = () => {
    setOpen(false);
    setCustomOpen(false);
  };
  const showCustom = () => {
    setCustomColor(/^#[\da-f]{6}$/i.test(value ?? '') ? value!.toUpperCase() : '#000000');
    setCustomOpen(true);
  };
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 280,
    maxWidth: 'calc(100vw - 32px)',
    padding: 16,
    border: `1px solid ${tokens.borderSubtle}`,
    borderRadius: 16,
    background: tokens.popover,
    boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
    color: tokens.foreground,
  };

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        accessibilityLabel={triggerLabel}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={compact ? undefined : { alignSelf: 'flex-start', gap: 10 }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            border: `1px solid ${tokens.borderSubtle}`,
            background: value ?? 'transparent',
          }}
        />
        {!compact && <Text>{triggerLabel}</Text>}
      </Button>
      {open && (
        <div
          onClick={close}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(0,0,0,0.18)',
          }}
        >
          <div
            role="dialog"
            aria-label={customOpen ? 'Choose a custom color' : 'Choose a color'}
            onClick={(event) => event.stopPropagation()}
            style={popupStyle}
          >
            {customOpen ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <strong>Custom color</strong>
                  <button
                    type="button"
                    aria-label="Back to color choices"
                    onClick={() => setCustomOpen(false)}
                    style={plainButton(tokens.foreground)}
                  >
                    Back
                  </button>
                </div>
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  Hue · {customHue}°
                  <input
                    type="range"
                    aria-label="Color hue"
                    min={0}
                    max={360}
                    value={customHue}
                    onChange={(event) => setCustomHue(Number(event.currentTarget.value))}
                    style={{ width: '100%', accentColor: tokens.primary }}
                  />
                </label>
                <div
                  role="grid"
                  aria-label="Color tones"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}
                >
                  {getColorToneSwatches(customHue).map((color) => (
                    <button
                      key={color}
                      type="button"
                      role="gridcell"
                      aria-label={`${color} tone`}
                      aria-selected={customColor.toUpperCase() === color}
                      onClick={() => setCustomColor(color)}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        minWidth: 0,
                        borderRadius: 7,
                        border: `2px solid ${customColor.toUpperCase() === color ? tokens.foreground : tokens.borderSubtle}`,
                        background: color,
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
                <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                  Hex color
                  <input
                    aria-label="Hex color"
                    value={customColor}
                    onChange={(event) => setCustomColor(event.currentTarget.value)}
                    placeholder="#RRGGBB"
                    maxLength={7}
                    style={{
                      boxSizing: 'border-box',
                      width: '100%',
                      minHeight: 44,
                      padding: '8px 10px',
                      border: `1px solid ${tokens.borderSubtle}`,
                      borderRadius: 8,
                      background: tokens.surfaceRaised,
                      color: tokens.foreground,
                      font: 'inherit',
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={!/^#[\da-f]{6}$/i.test(customColor)}
                  onClick={() => {
                    onChange(customColor.toUpperCase());
                    close();
                  }}
                  style={{
                    ...plainButton(tokens.primaryForeground),
                    minHeight: 44,
                    borderRadius: 10,
                    background: tokens.primary,
                    color: tokens.primaryForeground,
                    fontWeight: 600,
                    opacity: /^#[\da-f]{6}$/i.test(customColor) ? 1 : 0.5,
                  }}
                >
                  Apply color
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <strong>Choose a color</strong>
                <div
                  role="grid"
                  aria-label="Color swatches"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}
                >
                  {entityColorSwatches.map(({ name, value: color }) => (
                    <button
                      key={color}
                      type="button"
                      role="gridcell"
                      aria-label={`${name} color`}
                      aria-selected={value?.toLowerCase() === color.toLowerCase()}
                      onClick={() => {
                        onChange(color);
                        close();
                      }}
                      style={{
                        minWidth: 48,
                        minHeight: 48,
                        borderRadius: 12,
                        border: `2px solid ${value?.toLowerCase() === color.toLowerCase() ? tokens.foreground : tokens.borderSubtle}`,
                        background: color,
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={showCustom}
                  style={{
                    ...plainButton(tokens.foreground),
                    minHeight: 44,
                    borderRadius: 10,
                    border: `1px solid ${tokens.borderSubtle}`,
                    fontWeight: 600,
                  }}
                >
                  Custom…
                </button>
                {value && (
                  <Button
                    variant="ghost"
                    accessibilityLabel="Clear color"
                    onPress={() => {
                      onChange(undefined);
                      close();
                    }}
                  >
                    Use default color
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function plainButton(color: string): React.CSSProperties {
  return {
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    color,
    font: 'inherit',
    cursor: 'pointer',
  };
}
