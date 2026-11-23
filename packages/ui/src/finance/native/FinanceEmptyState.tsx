import React from 'react';
import { View } from 'react-native';
import { Text, Typography, useTheme } from '@finapp/ui/native';
import { Illustration } from '../../illustrations/native';
import type { IllustrationScene } from '../../illustrations/scenes';

export type FinanceEmptyKind =
  | 'account'
  | 'budget'
  | 'transaction'
  | 'analytics'
  | 'goal'
  | 'category'
  | 'activity'
  | 'group'
  | 'recurring'
  | 'search'
  | 'contribution'
  | 'invitation'
  | 'people'
  | 'message';

export type FinanceEmptyStateProps = {
  kind: FinanceEmptyKind;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
  /** Overrides the illustration; defaults to the scene matching `kind`. */
  scene?: IllustrationScene;
};

export function FinanceEmptyState({
  kind,
  title,
  description,
  action,
  compact = false,
  scene,
}: FinanceEmptyStateProps) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 7 : 12,
        minHeight: compact ? undefined : 250,
        paddingVertical: compact ? 10 : 24,
        paddingHorizontal: compact ? 8 : 18,
        borderWidth: compact ? 0 : 1,
        borderColor: tokens.borderSubtle,
        borderRadius: 14,
        backgroundColor: compact ? 'transparent' : tokens.surfaceSubtle,
      }}
    >
      <Illustration scene={scene ?? kind} size={compact ? 96 : 156} />
      <View style={{ alignItems: 'center', gap: compact ? 3 : 6, maxWidth: 340 }}>
        <Typography
          variant={compact ? 'bodyLarge' : 'heading'}
          style={{ fontSize: compact ? 15 : 21, fontWeight: '600', textAlign: 'center' }}
        >
          {title}
        </Typography>
        <Text
          style={{
            color: tokens.foregroundMuted,
            fontSize: compact ? 12 : 14,
            lineHeight: compact ? 18 : 21,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      </View>
      {action}
    </View>
  );
}
