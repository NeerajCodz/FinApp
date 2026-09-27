import React from 'react';
import { View } from 'react-native';
import { Typography } from '@finapp/ui/native';

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Typography variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Typography>
      <Typography variant="caption">{label}</Typography>
    </View>
  );
}

export function MetricPair({
  left,
  right,
}: {
  left: { label: string; value: string };
  right: { label: string; value: string };
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 1 }}>
        <Metric {...left} />
      </View>
      <View style={{ flex: 1 }}>
        <Metric {...right} />
      </View>
    </View>
  );
}
