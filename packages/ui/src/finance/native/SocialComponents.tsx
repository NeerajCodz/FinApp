import React from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Text, Typography, useTheme } from '@finapp/ui/native';
import type { SocialProfileSummary } from '../social';

export function SocialPersonRow({
  profile,
  detail,
  action,
  onPress,
  compact = false,
}: {
  profile: SocialProfileSummary;
  detail?: string;
  action?: React.ReactNode;
  onPress?: () => void;
  compact?: boolean;
}) {
  const { tokens } = useTheme();
  const identity = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
      <Avatar
        label={profile.displayName}
        initials={profile.displayName.trim().slice(0, 2).toLocaleUpperCase() || 'F'}
        size={compact ? 40 : 58}
        avatarId={profile.avatarId}
        imageUrl={profile.avatarUrl ?? undefined}
      />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Typography variant="label" numberOfLines={1}>
          {profile.displayName}
        </Typography>
        {profile.username && (
          <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }} numberOfLines={1}>
            @{profile.username.replace(/^@+/, '')}
          </Text>
        )}
        {detail && (
          <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
    </View>
  );
  return (
    <View
      style={{
        minHeight: compact ? 58 : 86,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: compact ? 0 : 12,
        paddingVertical: compact ? 5 : 12,
        borderRadius: 14,
        borderWidth: compact ? 0 : 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: compact ? 'transparent' : tokens.surfaceSubtle,
      }}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${profile.displayName}'s profile`}
          onPress={onPress}
          style={{ flex: 1 }}
        >
          {identity}
        </Pressable>
      ) : (
        identity
      )}
      {action}
    </View>
  );
}

export function SocialSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Typography variant="label" style={{ flex: 1 }}>
          {title}
          {count !== undefined ? ` (${count})` : ''}
        </Typography>
        {action}
      </View>
      {children}
      <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
    </View>
  );
}
