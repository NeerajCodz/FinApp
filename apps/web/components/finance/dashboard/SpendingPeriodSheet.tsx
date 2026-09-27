import React from 'react';
import { Button, Input, Sheet, Text, Typography, useTheme } from '@finapp/ui/web';

export function SpendingPeriodSheet({
  visible,
  period,
  customDate,
  dateError,
  onClose,
  onSelectPeriod,
  onDateChange,
  onApplyDate,
}: {
  visible: boolean;
  period: string;
  customDate: string;
  dateError: string;
  onClose: () => void;
  onSelectPeriod: (period: string) => void;
  onDateChange: (value: string) => void;
  onApplyDate: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Spending period">
      <div style={{ display: 'grid', gap: 8 }}>
        {['Today', 'This week', 'This month', 'Custom date'].map((option) => (
          <Button
            key={option}
            variant={period === option ? 'primary' : 'ghost'}
            onPress={() => onSelectPeriod(option)}
            style={{ justifyContent: 'flex-start', minHeight: 54 }}
          >
            {option}
          </Button>
        ))}
        {period === 'Custom date' && (
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            <Text style={{ color: tokens.foregroundMuted }}>
              Show spending for one date (YYYY-MM-DD).
            </Text>
            <Input
              accessibilityLabel="Custom date"
              placeholder="2026-08-27"
              value={customDate}
              onChangeText={onDateChange}
            />
            {!!dateError && <Typography style={{ color: tokens.expense }}>{dateError}</Typography>}
            <Button size="lg" disabled={!customDate.trim()} onPress={onApplyDate}>
              Apply date
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
