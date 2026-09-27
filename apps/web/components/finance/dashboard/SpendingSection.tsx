import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Button, IconButton, SectionHeader, Typography, useTheme } from '@finapp/ui/web';
import { SpendingLineChart } from '@finapp/ui/analytics';

export function SpendingSection({
  period,
  values,
  startAt,
  endAt,
  onChoosePeriod,
  loading,
}: {
  period: string;
  values?: readonly number[];
  startAt: number;
  endAt: number;
  onChoosePeriod: () => void;
  loading: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <SectionHeader
        title="Spending"
        action={
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button variant="ghost" size="sm" onPress={onChoosePeriod}>
              {period}
            </Button>
            <IconButton label="Choose date" variant="ghost" onPress={onChoosePeriod}>
              <CalendarDays size={19} color={tokens.foreground} />
            </IconButton>
          </span>
        }
      />
      {values ? (
        <SpendingLineChart
          values={values}
          labels={[
            new Date(startAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            new Date(endAt - 1).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          ]}
        />
      ) : loading ? (
        <Typography variant="small">Loading spending…</Typography>
      ) : null}
    </section>
  );
}
