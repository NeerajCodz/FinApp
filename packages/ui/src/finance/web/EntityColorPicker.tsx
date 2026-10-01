'use client';

import React, { useState } from 'react';
import { Button, Sheet, Text, useTheme } from '@finapp/ui/web';

const colorSwatches = ['#B7FF4A', '#71B8FF', '#FF7777', '#BA8AFF', '#FFD44F', '#FF9C5B', '#54D6A1', '#FF80B6'];

export function EntityColorPicker({
  value,
  onChange,
  compact = false,
  label,
}: {
  value?: string;
  onChange: (value?: string) => void;
  compact?: boolean;
  label?: string;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerLabel = label ?? (value ? 'Change color' : 'Choose color');

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        accessibilityLabel={triggerLabel}
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
        {!compact && <Text>{label ?? (value ? 'Change color' : 'Choose color')}</Text>}
      </Button>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Choose a color">
        <div style={{ display: 'grid', gap: 12, padding: 4 }}>
          <div
            role="grid"
            aria-label="Color swatches"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(36px, 1fr))', gap: 8 }}
          >
            {colorSwatches.map((color) => (
              <button
                key={color}
                type="button"
                role="gridcell"
                aria-label={color}
                aria-selected={value?.toLowerCase() === color.toLowerCase()}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 12,
                  border: `2px solid ${value?.toLowerCase() === color.toLowerCase() ? tokens.foreground : tokens.borderSubtle}`,
                  background: color,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: tokens.foreground }}>Custom color</span>
            <input
              aria-label="Custom color"
              type="color"
              value={/^#[\da-f]{6}$/i.test(value ?? '') ? value : '#000000'}
              onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
              style={{ width: 48, height: 40, border: 0, background: 'transparent', cursor: 'pointer' }}
            />
          </label>
          {value && (
            <Button
              variant="ghost"
              accessibilityLabel="Clear color"
              onPress={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Use default color
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}
