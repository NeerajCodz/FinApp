import React from 'react';
import { TouchableOpacity, View, type PressableProps } from 'react-native';
import { Typography, useTheme } from '@finapp/ui/native';
import { CaretRight } from '@finapp/ui/icons/native';

export function GroupCard({
  name,
  meta,
  balance,
  meaning,
  onPress,
}: {
  name: string;
  meta: string;
  balance: string;
  meaning: string;
  onPress?: PressableProps['onPress'];
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meaning} ${balance}`}
      onPress={onPress ?? undefined}
      activeOpacity={0.78}
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceSubtle,
        padding: 18,
        gap: 20,
      }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View style={{ gap: 4 }}>
          <Typography variant="heading">{name}</Typography>
          <Typography variant="caption">{meta}</Typography>
        </View>
        <CaretRight size={18} color={tokens.foregroundSubtle} />
      </View>
      <View style={{ gap: 3 }}>
        <Typography variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
          {balance}
        </Typography>
        <Typography variant="caption">{meaning}</Typography>
      </View>
    </TouchableOpacity>
  );
}
