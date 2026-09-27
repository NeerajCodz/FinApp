import React from 'react';
import { IconButton, Typography } from '@finapp/ui/web';

export function DashboardHeader({
  syncLabel,
  syncIcon,
  onOpenSync,
}: {
  syncLabel: string;
  syncIcon: React.ReactNode;
  onOpenSync: () => void;
}) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="label">Overview</Typography>
      <IconButton label={syncLabel} variant="ghost" onPress={onOpenSync}>
        {syncIcon}
      </IconButton>
    </header>
  );
}
