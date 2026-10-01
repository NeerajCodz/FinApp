import React from 'react';
import { TouchableOpacity, View, type PressableProps } from 'react-native';
import { Button, Typography, useTheme } from '@finapp/ui/native';
import { EntityIcon } from './EntityIconPicker';
import { CaretRight } from '@finapp/ui/icons/native';

export function GroupCard({
  name,
  meta,
  balance,
  meaning,
  icon,
  color,
  onPress,
  onOpenChat,
}: {
  name: string;
  meta: string;
  balance: string;
  meaning: string;
  icon?: string;
  color?: string;
  onPress?: PressableProps['onPress'];
  onOpenChat?: PressableProps['onPress'];
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceSubtle,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${meaning} ${balance}`}
        onPress={onPress ?? undefined}
        activeOpacity={0.78}
        style={{ padding: 18, gap: 20 }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 15,
              backgroundColor: color ?? tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EntityIcon
              value={icon ?? 'phosphor:UsersThree'}
              size={23}
              color={color ? '#101510' : tokens.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
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
      {onOpenChat && (
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 16 }}>
          <Button size="sm" variant="outline" onPress={onOpenChat}>
            Open chat
          </Button>
        </View>
      )}
    </View>
  );
}
