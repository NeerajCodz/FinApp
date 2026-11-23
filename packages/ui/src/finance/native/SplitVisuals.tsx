import React from 'react';
import { Pressable, View } from 'react-native';
import { StatusPill, Typography, useTheme, type VisualTone } from '@finapp/ui/native';
import { withAlpha } from '../../tokens';
import type { AllocationTone } from '../groupExpenseDraft';
import { GroupAvatar } from './GroupPrimitives';

export function allocationVisualTone(tone: AllocationTone): VisualTone {
  return tone === 'positive' ? 'income' : tone === 'warning' ? 'warning' : 'destructive';
}

/** Numbered progress across the composer steps; completed steps can be revisited. */
export function StepProgress({
  steps,
  current,
  completed,
  onSelect,
}: {
  steps: readonly { key: string; label: string }[];
  current: number;
  completed: readonly boolean[];
  onSelect: (index: number) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      {steps.map((step, index) => {
        const active = index === current;
        const done = completed[index] && !active;
        const reachable = index <= current || completed.slice(0, index).every(Boolean);
        const color = active ? tokens.primary : done ? tokens.income : tokens.foregroundMuted;
        return (
          <Pressable
            key={step.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !reachable }}
            accessibilityLabel={`Step ${index + 1}: ${step.label}${done ? ', done' : ''}`}
            disabled={!reachable}
            onPress={() => onSelect(index)}
            style={{ flex: 1, gap: 6 }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: active || done ? color : withAlpha(tokens.foregroundMuted, 0.2),
              }}
            />
            <Typography
              variant="caption"
              style={{ color, fontFamily: active ? 'SpaceGrotesk_600SemiBold' : undefined }}
            >
              {step.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One person's line in a split: avatar, name, optional detail, amount and status. */
export function MemberShareRow({
  name,
  avatarId,
  avatarUrl,
  detail,
  amount,
  status,
  children,
}: {
  name: string;
  avatarId?: string;
  avatarUrl?: string | null;
  detail?: string;
  amount?: string;
  status?: { label: string; tone: VisualTone };
  children?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: tokens.borderSubtle,
      }}
    >
      <GroupAvatar name={name} avatarId={avatarId} avatarUrl={avatarUrl} size={38} />
      <View style={{ flex: 1, gap: 4 }}>
        <Typography variant="label" numberOfLines={1}>
          {name}
        </Typography>
        {detail ? <Typography variant="caption">{detail}</Typography> : null}
        {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
      </View>
      {children}
      {amount ? (
        <Typography variant="label" style={{ fontVariant: ['tabular-nums'] }}>
          {amount}
        </Typography>
      ) : null}
    </View>
  );
}
