import React from 'react';
import { View } from 'react-native';
import { Avatar } from './feedback';
import { Button } from './button';
import { Typography } from './typography';

type AvatarChoice = { avatarId: string; url: string };

type ProfilePreviewProps = {
  displayName: string;
  username: string;
  avatarUrl?: string;
};

export function ProfilePreview({ displayName, username, avatarUrl }: ProfilePreviewProps) {
  const name = displayName.trim() || 'Your name';
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ffffff24',
        backgroundColor: '#ffffff08',
      }}
    >
      <Avatar initials={initials} label={name} imageUrl={avatarUrl} size={68} />
      <View style={{ flex: 1, gap: 4 }}>
        <Typography variant="caption" style={{ letterSpacing: 1.2 }}>
          PROFILE PREVIEW
        </Typography>
        <Typography variant="bodyLarge" numberOfLines={1}>
          {name}
        </Typography>
        <Typography variant="small">@{username || 'username'}</Typography>
      </View>
    </View>
  );
}

export function OnboardingAvatarPicker({
  choices,
  selectedId,
  onSelect,
}: {
  choices: AvatarChoice[];
  selectedId: string;
  onSelect: (avatarId: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {choices.map((avatar) => (
        <Button
          key={avatar.avatarId}
          variant={selectedId === avatar.avatarId ? 'primary' : 'outline'}
          accessibilityLabel={`Select avatar ${avatar.avatarId}`}
          accessibilityState={{ selected: selectedId === avatar.avatarId }}
          onPress={() => onSelect(avatar.avatarId)}
          style={{ width: 58, height: 58, padding: 3, borderRadius: 999 }}
        >
          <Avatar
            initials=""
            label={`Select avatar ${avatar.avatarId}`}
            imageUrl={avatar.url}
            size={48}
          />
        </Button>
      ))}
    </View>
  );
}
