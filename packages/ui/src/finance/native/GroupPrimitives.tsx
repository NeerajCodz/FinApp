import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { Avatar, Button, IconButton, Input, Label, Typography, useTheme } from '@finapp/ui/native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { EntityIcon } from './EntityIconPicker';

export function GroupPanel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        {
          padding: 18,
          gap: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceSubtle,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function GroupTile({
  icon = 'phosphor:UsersThree',
  color,
  size = 52,
}: {
  icon?: string;
  color?: string;
  size?: number;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(18, size / 4),
        backgroundColor: color ?? tokens.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <EntityIcon value={icon} size={size * 0.54} color={tokens.primaryForeground} />
    </View>
  );
}

export function GroupAvatar({
  name,
  avatarUrl,
  avatarId,
  size = 34,
}: {
  name: string;
  avatarUrl?: string | null;
  avatarId?: string;
  size?: number;
}) {
  return (
    <Avatar
      size={size}
      label={name}
      imageUrl={avatarUrl ?? undefined}
      avatarId={avatarId}
      initials={name
        .split(/\s+/)
        .map((part) => part[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()}
    />
  );
}

export function GroupHeading({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {onBack && (
        <View style={{ alignSelf: 'flex-start' }}>
          <IconButton label="Go back" variant="ghost" onPress={onBack}>
            <ArrowLeft size={20} color={tokens.foreground} />
          </IconButton>
        </View>
      )}
      <Typography variant="title">{title}</Typography>
      {subtitle && (
        <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
          {subtitle}
        </Typography>
      )}
    </View>
  );
}

export function GroupMetric({
  title,
  value,
  detail,
  icon,
  color,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: string;
  color?: string;
}) {
  const { tokens } = useTheme();
  return (
    <GroupPanel style={{ flexGrow: 1, flexBasis: '46%', padding: 16, gap: 7 }}>
      <GroupTile icon={icon} color={color} size={42} />
      <Typography variant="caption">{title}</Typography>
      <Typography
        variant="heading"
        style={{ fontVariant: ['tabular-nums'], color: color ?? tokens.foreground }}
      >
        {value}
      </Typography>
      {detail && <Typography variant="caption">{detail}</Typography>}
    </GroupPanel>
  );
}

export function GroupNote({
  title,
  text,
  icon = 'phosphor:Lightbulb',
  color,
}: {
  title: string;
  text: string;
  icon?: string;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4 }}>
      <GroupTile icon={icon} color={color} size={36} />
      <View style={{ flex: 1, gap: 4 }}>
        <Typography variant="label">{title}</Typography>
        <Typography variant="caption">{text}</Typography>
      </View>
    </View>
  );
}

export type GroupMetadata = {
  description?: string;
  groupType?: string;
  purpose?: string;
  location?: string;
  startAt?: number;
  endAt?: number;
};

export type GroupMetadataFieldsProps = {
  description?: string;
  onDescriptionChange?: (value: string) => void;
  groupType?: string;
  onGroupTypeChange?: (value: string) => void;
  purpose?: string;
  onPurposeChange?: (value: string) => void;
  location?: string;
  onLocationChange?: (value: string) => void;
  startDate?: string;
  onStartDateChange?: (value: string) => void;
  endDate?: string;
  onEndDateChange?: (value: string) => void;
};

export function GroupMetadataFields(p: GroupMetadataFieldsProps & { disabled?: boolean }) {
  return (
    <View style={{ gap: 10 }}>
      {p.onDescriptionChange && (
        <View>
          <Label>Description</Label>
          <Input
            accessibilityLabel="Group description"
            value={p.description ?? ''}
            onChangeText={p.onDescriptionChange}
            placeholder="What is this group for? (optional)"
            multiline
            maxLength={200}
            editable={!p.disabled}
          />
          <Typography variant="caption" style={{ textAlign: 'right' }}>
            {p.description?.length ?? 0}/200
          </Typography>
        </View>
      )}
      {p.onGroupTypeChange && (
        <View style={{ gap: 6 }}>
          <Label>Group type</Label>
          <Input
            accessibilityLabel="Group type"
            value={p.groupType ?? ''}
            onChangeText={p.onGroupTypeChange}
            placeholder="Trip, Flatmates, Office, Event, Custom"
            editable={!p.disabled}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['Trip', 'Flatmates', 'Office', 'Event', 'Custom'].map((type) => (
              <Button
                key={type}
                size="sm"
                variant={
                  p.groupType?.toLowerCase() === type.toLowerCase() ? 'secondary' : 'outline'
                }
                disabled={p.disabled}
                onPress={() => p.onGroupTypeChange?.(type)}
              >
                {type}
              </Button>
            ))}
          </View>
        </View>
      )}
      {p.onPurposeChange && (
        <View>
          <Label>Purpose (optional)</Label>
          <Input
            accessibilityLabel="Group purpose"
            value={p.purpose ?? ''}
            onChangeText={p.onPurposeChange}
            placeholder="Travel, rent, food, activities"
            editable={!p.disabled}
          />
        </View>
      )}
      {p.onLocationChange && (
        <View>
          <Label>Location (optional)</Label>
          <Input
            accessibilityLabel="Group location"
            value={p.location ?? ''}
            onChangeText={p.onLocationChange}
            placeholder="City or place"
            editable={!p.disabled}
          />
        </View>
      )}
      {p.onStartDateChange && (
        <View>
          <Label>Start date (optional)</Label>
          <Input
            accessibilityLabel="Group start date"
            value={p.startDate ?? ''}
            onChangeText={p.onStartDateChange}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            maxLength={10}
            editable={!p.disabled}
          />
        </View>
      )}
      {p.onEndDateChange && (
        <View>
          <Label>End date (optional)</Label>
          <Input
            accessibilityLabel="Group end date"
            value={p.endDate ?? ''}
            onChangeText={p.onEndDateChange}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            maxLength={10}
            editable={!p.disabled}
          />
        </View>
      )}
    </View>
  );
}

export function GroupMetadataSummary({ group }: { group: GroupMetadata }) {
  const dates = [group.startAt, group.endAt]
    .filter((date): date is number => date !== undefined && Number.isFinite(date))
    .map((date) => new Date(date).toLocaleDateString());
  if (!group.description && !group.groupType && !group.purpose && !group.location && !dates.length)
    return null;
  return (
    <View style={{ gap: 6 }}>
      {!!group.description && <Typography variant="small">{group.description}</Typography>}
      {!!group.groupType && (
        <Typography variant="caption">Group type · {group.groupType}</Typography>
      )}
      {!!group.purpose && <Typography variant="caption">Purpose · {group.purpose}</Typography>}
      {!!group.location && <Typography variant="caption">Location · {group.location}</Typography>}
      {!!dates.length && <Typography variant="caption">Dates · {dates.join(' – ')}</Typography>}
    </View>
  );
}
