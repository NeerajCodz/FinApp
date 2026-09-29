import React from 'react';
import { Button, Typography } from '@finapp/ui/web';

export function DateTimePicker({
  value,
  onChange,
  showTime = false,
}: {
  value: number;
  onChange: (timestamp: number) => void;
  showTime?: boolean;
}) {
  const date = new Date(value);
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const localTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const updateDate = (next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    const [year, month, day] = next.split('-').map(Number);
    const updated = new Date(value);
    updated.setFullYear(year!, month! - 1, day!);
    onChange(updated.getTime());
  };
  const updateTime = (next: string) => {
    if (!/^\d{2}:\d{2}$/.test(next)) return;
    const [hour, minute] = next.split(':').map(Number);
    const updated = new Date(value);
    updated.setHours(hour!, minute!, 0, 0);
    onChange(updated.getTime());
  };

  return (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      <Typography variant="label">Choose date{showTime ? ' and time' : ''}</Typography>
      <input
        aria-label="Transaction date"
        type="date"
        value={localDate}
        onChange={(event) => updateDate(event.currentTarget.value)}
        style={{
          minHeight: 44,
          padding: '0 12px',
          borderRadius: 10,
          border: '1px solid var(--finance-line)',
          background: 'var(--finapp-surface-raised)',
          color: 'var(--finance-text)',
          font: 'inherit',
        }}
      />
      {showTime && (
        <input
          aria-label="Transaction time"
          type="time"
          value={localTime}
          onChange={(event) => updateTime(event.currentTarget.value)}
          style={{
            minHeight: 44,
            padding: '0 12px',
            borderRadius: 10,
            border: '1px solid var(--finance-line)',
            background: 'var(--finapp-surface-raised)',
            color: 'var(--finance-text)',
            font: 'inherit',
          }}
        />
      )}
      <Button
        type="button"
        variant="outline"
        onPress={() => {
          const today = new Date();
          if (!showTime) today.setHours(12, 0, 0, 0);
          onChange(today.getTime());
        }}
      >
        Today{showTime ? ' · Now' : ''}
      </Button>
    </div>
  );
}
