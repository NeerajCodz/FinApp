import React from 'react';
import { Card, Separator, Text, Typography, useTheme } from '@finapp/ui/native';

export function InsightCard({ title, body }: { title: string; body: string }) {
  const { tokens } = useTheme();
  return (
    <Card style={{ gap: 8 }}>
      <Typography variant="heading">{title}</Typography>
      <Text style={{ color: tokens.foregroundMuted }}>{body}</Text>
      <Separator />
    </Card>
  );
}
