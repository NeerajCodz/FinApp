import React from 'react';
import { TouchableOpacity, View, type PressableProps } from 'react-native';
import { Card, Text, Typography, useTheme } from '@finapp/ui/native';
import { CaretRight, Landmark } from '@finapp/ui/icons/native';
import { Money } from './Money';

export function BrandMark() {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLabel="Finapp"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.primary }} />
      <Text
        style={{
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 19,
          lineHeight: 24,
          letterSpacing: -0.4,
        }}
      >
        finapp
      </Text>
    </View>
  );
}

export function DateSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Typography variant="caption" style={{ letterSpacing: 0.8 }}>
        {title.toUpperCase()}
      </Typography>
      <View>{children}</View>
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  onPress,
  leadingIcon,
}: {
  label: string;
  value?: string;
  onPress?: PressableProps['onPress'];
  leadingIcon?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={value ? [label, value].join(', ') : label}
      accessibilityRole={onPress ? 'button' : undefined}
      activeOpacity={onPress ? 0.72 : 1}
      disabled={!onPress}
      onPress={onPress ?? undefined}
      style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      {leadingIcon && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: tokens.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {leadingIcon}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="bodyLarge" style={{ fontSize: 15 }}>
          {label}
        </Typography>
        {value && <Typography variant="small">{value}</Typography>}
      </View>
      <View style={{ width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
        {onPress && <CaretRight size={18} color={tokens.foregroundSubtle} />}
      </View>
    </TouchableOpacity>
  );
}

export function AccountCard({
  name,
  balanceMinor,
  currency,
  kind = 'Account',
}: {
  name: string;
  balanceMinor: bigint;
  currency: string;
  kind?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Card style={{ width: 148, minHeight: 96, justifyContent: 'space-between', gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="small" style={{ color: tokens.foreground }}>
          {name}
        </Typography>
        <Landmark size={16} color={tokens.foregroundSubtle} />
      </View>
      <View style={{ gap: 2 }}>
        <Money amountMinor={balanceMinor} currency={currency} />
        <Typography variant="caption">{kind}</Typography>
      </View>
    </Card>
  );
}
