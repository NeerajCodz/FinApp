import React from 'react';
import { Button } from '@finapp/ui/native';

export function PeriodSelector({ label = 'This month' }: { label?: string }) {
  return (
    <Button variant="ghost" size="sm">
      {label}
    </Button>
  );
}
