import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ChartLineUp, NotePencil, UsersThree } from '@finapp/ui/icons/native';
import {
  Avatar,
  Button,
  Card,
  Empty,
  IconButton,
  Input,
  Separator,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIcon, EntityIconPicker } from './EntityIconPicker';

export type GroupEditMember = {
  id: string;
  userId?: string;
  memberId?: string;
  name: string;
  username?: string;
  role: string;
  avatarUrl?: string;
};
export type GroupEditScreenProps = {
  group?: {
    id: string;
    name: string;
    currency: string;
    ownerId?: string;
    archived: boolean;
    icon?: string;
    color?: string;
  };
  members: readonly GroupEditMember[];
  currentRole: string;
  canManage: boolean;
  loading: boolean;
  membersLoading: boolean;
  loadError?: string;
  error?: string;
  saving: string | null;
  cloudGroupId: string;
  name: string;
  onNameChange: (value: string) => void;
  onSaveName: () => void;
  icon?: string;
  onIconChange: (value?: string) => void;
  color?: string;
  onColorChange: (value?: string) => void;
  onSaveAppearance: () => void;
  retention: number | null;
  onRetentionChange: (value: number | null) => void;
  onSaveRetention: () => void;
  memberInput: string;
  onMemberInputChange: (value: string) => void;
  onAddMember: () => void;
  onChangeRole: (member: GroupEditMember, makeAdmin: boolean) => void;
  onRemoveMember: (member: GroupEditMember) => void;
  onRetry: () => void;
  onBack: () => void;
  onOpenAnalytics: () => void;
};

export function GroupEditScreen({
  group,
  members,
  currentRole,
  canManage,
  loading,
  membersLoading,
  loadError,
  error,
  saving,
  cloudGroupId,
  name,
  onNameChange,
  onSaveName,
  icon,
  onIconChange,
  color,
  onColorChange,
  onSaveAppearance,
  retention,
  onRetentionChange,
  onSaveRetention,
  memberInput,
  onMemberInputChange,
  onAddMember,
  onChangeRole,
  onRemoveMember,
  onRetry,
  onBack,
  onOpenAnalytics,
}: GroupEditScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [editingName, setEditingName] = useState(false);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 36,
        gap: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Back to group" variant="ghost" onPress={onBack}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="caption" style={{ color: tokens.primary }}>
            GROUP MANAGEMENT
          </Typography>
          <Typography variant="title">Edit group</Typography>
        </View>
        <IconButton label="Group analytics" variant="ghost" onPress={onOpenAnalytics}>
          <ChartLineUp size={20} color={tokens.foreground} />
        </IconButton>
      </View>
      {!!error && (
        <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {error}
        </Typography>
      )}
      {loadError ? (
        <Empty
          title="Group details unavailable"
          description={loadError}
          icon={<UsersThree size={28} color={tokens.foregroundMuted} />}
          action={
            <Button variant="outline" onPress={onRetry}>
              Retry
            </Button>
          }
        />
      ) : loading ? (
        <Typography variant="small">Loading group details…</Typography>
      ) : !group ? (
        <Empty title="Group unavailable" description="This group is not saved on this device." />
      ) : (
        <>
          <Card
            variant="subtle"
            style={{
              gap: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: group.color ?? tokens.surfaceSubtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <EntityIcon
                  value={icon ?? group.icon ?? 'phosphor:UsersThree'}
                  size={23}
                  color={group.color ? '#101510' : tokens.primary}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Typography variant="heading" numberOfLines={2}>
                  {group.name}
                </Typography>
                <Typography variant="caption">
                  {group.archived ? 'Archived group' : 'Active group'}
                </Typography>
              </View>
              <Typography variant="caption">{members.length} members</Typography>
            </View>
            <Separator />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Typography variant="caption">Your access</Typography>
              <Typography variant="label" style={{ marginLeft: 'auto', color: tokens.primary }}>
                {currentRole}
              </Typography>
            </View>
          </Card>
          <Card
            variant="subtle"
            style={{
              gap: 12,
              padding: 18,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <Typography variant="heading">Group details</Typography>
            <Typography variant="caption">
              Owners and admins can rename the group. Currency stays fixed for existing splits.
            </Typography>
            {editingName ? (
              <>
                <Input
                  accessibilityLabel="Group name"
                  value={name}
                  onChangeText={onNameChange}
                  maxLength={80}
                />
                <Typography variant="caption">
                  Currency · {group.currency}. Kept fixed for existing split amounts.
                </Typography>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button
                    style={{ flex: 1 }}
                    disabled={!canManage || saving === 'name'}
                    onPress={() => {
                      onSaveName();
                      setEditingName(false);
                    }}
                  >
                    {saving === 'name' ? 'Saving…' : 'Save name'}
                  </Button>
                  <Button
                    style={{ flex: 1 }}
                    variant="outline"
                    disabled={saving === 'name'}
                    onPress={() => setEditingName(false)}
                  >
                    Cancel
                  </Button>
                </View>
              </>
            ) : (
              <>
                <Typography variant="bodyLarge">{group.name}</Typography>
                <Typography variant="caption">Currency · {group.currency}</Typography>
                {canManage && (
                  <Button
                    variant="outline"
                    onPress={() => {
                      onNameChange(group.name);
                      setEditingName(true);
                    }}
                  >
                    <NotePencil size={16} color={tokens.foreground} /> Edit name
                  </Button>
                )}
              </>
            )}
          </Card>
          {canManage && (
            <Card
              variant="subtle"
              style={{
                gap: 12,
                padding: 18,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                backgroundColor: tokens.surfaceRaised,
              }}
            >
              <Typography variant="heading">Appearance & chat</Typography>
              <Typography variant="caption">
                Icon, color, and chat retention changes require an internet connection.
              </Typography>
              <EntityIconPicker
                mode="phosphor"
                value={icon}
                onChange={onIconChange}
                label="Group icon"
                compact
              />
              <EntityColorPicker value={color} onChange={onColorChange} label="Group color" />
              <Button
                variant="outline"
                disabled={Boolean(saving) || !cloudGroupId || !color}
                onPress={onSaveAppearance}
              >
                {saving === 'appearance' ? 'Saving…' : 'Save appearance'}
              </Button>
              <Separator />
              <Typography variant="bodyLarge">Disappearing messages</Typography>
              <Typography variant="caption">
                Existing and new messages, including bill images, are deleted on expiry.
              </Typography>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { value: null, label: 'Never' },
                  { value: 86_400_000, label: '1 day' },
                  { value: 604_800_000, label: '7 days' },
                  { value: 2_592_000_000, label: '30 days' },
                ].map((option) => (
                  <Button
                    key={option.label}
                    size="sm"
                    variant={retention === option.value ? 'secondary' : 'outline'}
                    onPress={() => onRetentionChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </View>
              <Button disabled={Boolean(saving) || !cloudGroupId} onPress={onSaveRetention}>
                {saving === 'retention' ? 'Saving…' : 'Save retention'}
              </Button>
            </Card>
          )}
          <Card
            variant="subtle"
            style={{
              gap: 12,
              padding: 18,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <Typography variant="heading">Members ({members.length})</Typography>
            <Typography variant="caption">Manage group membership and roles.</Typography>
            {canManage && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Input
                  accessibilityLabel="Add member username"
                  value={memberInput}
                  onChangeText={onMemberInputChange}
                  placeholder="@username"
                  autoCapitalize="none"
                  style={{ flex: 1 }}
                />
                <Button disabled={Boolean(saving) || !memberInput.trim()} onPress={onAddMember}>
                  {saving === 'member-add' ? 'Adding…' : 'Add member'}
                </Button>
              </View>
            )}
            {membersLoading ? (
              <Typography variant="small">Loading saved membership…</Typography>
            ) : members.length ? (
              members.map((member) => {
                const memberUserId = String(member.userId ?? member.memberId ?? member.id);
                const isOwner = member.role === 'owner' || group.ownerId === memberUserId;
                return (
                  <View
                    key={member.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <Avatar
                      initials={member.name
                        .split(/\s+/)
                        .map((part) => part[0] ?? '')
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                      label={member.name}
                      size={38}
                      imageUrl={member.avatarUrl}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Typography variant="bodyLarge">{member.name}</Typography>
                      <Typography variant="caption">
                        {isOwner
                          ? 'Group owner'
                          : member.role === 'admin'
                            ? 'Group admin'
                            : 'Member'}
                      </Typography>
                    </View>
                    {canManage && !isOwner && (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(saving)}
                          onPress={() => onChangeRole(member, member.role !== 'admin')}
                        >
                          {member.role === 'admin' ? 'Demote' : 'Promote'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(saving)}
                          onPress={() => onRemoveMember(member)}
                        >
                          Remove
                        </Button>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <Empty
                title="Membership is not cached yet"
                description="Member details appear after the group range or initial sync completes."
              />
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}
