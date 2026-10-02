import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  INVITATION_LINK_DEFAULT_EXPIRY_MS,
  INVITATION_LINK_EXPIRY_OPTIONS,
  type InvitationLinkExpiryMs,
} from '../groupInvitationExpiry';
import { Button, Empty, Input, Label, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIconPicker } from './EntityIconPicker';
import {
  GroupAvatar,
  GroupHeading,
  GroupMetadataFields,
  GroupNote,
  GroupPanel,
  GroupTile,
  type GroupMetadataFieldsProps,
} from './GroupPrimitives';

export type GroupEditMember = {
  id: string;
  userId?: string;
  memberId?: string;
  name: string;
  username?: string;
  role: string;
  avatarUrl?: string;
};
export type GroupEditScreenProps = GroupMetadataFieldsProps & {
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
  successMessage?: string;
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
  onSaveDetails?: () => void;
  invitationUrl?: string;
  invitationExpiresAt?: number;
  invitationExpiryMs?: InvitationLinkExpiryMs;
  onInvitationExpiryChange?: (value: InvitationLinkExpiryMs) => void;
  invitationBusy?: boolean;
  invitationError?: string;
  invitationStatus?: string;
  onCreateInvitation?: () => void;
  onRevokeInvitation?: () => void;
  onShareInvitation?: () => void;
};

export function GroupEditScreen(p: GroupEditScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const busy = Boolean(p.saving);
  const retentionOptions = [
    { value: null, label: 'Never' },
    { value: 86_400_000, label: '1 day' },
    { value: 604_800_000, label: '7 days' },
    { value: 2_592_000_000, label: '30 days' },
  ];
  const filteredMembers = p.members.filter((member) =>
    `${member.name} ${member.username ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 28,
          gap: 16,
        }}
      >
        <GroupHeading
          title="Edit group"
          subtitle="Update group details, manage members, and configure settings."
          onBack={p.onBack}
        />
        {!!p.error && (
          <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {p.error}
          </Typography>
        )}
        {!!p.successMessage && (
          <Typography
            accessibilityLiveRegion="polite"
            variant="caption"
            style={{ color: tokens.primary }}
          >
            {p.successMessage}
          </Typography>
        )}
        {p.loadError ? (
          <Empty
            title="Group details unavailable"
            description={p.loadError}
            action={
              <Button variant="outline" onPress={p.onRetry}>
                Retry
              </Button>
            }
          />
        ) : p.loading ? (
          <Typography>Loading group details…</Typography>
        ) : !p.group ? (
          <Empty title="Group unavailable" description="This group is not saved on this device." />
        ) : (
          <>
            <GroupPanel>
              <Typography variant="heading">Group details</Typography>
              <Typography variant="caption">Basic information about your group.</Typography>
              <View style={{ alignSelf: 'center', paddingVertical: 8 }}>
                <GroupTile
                  icon={p.icon ?? p.group.icon}
                  color={p.color ?? p.group.color}
                  size={108}
                />
              </View>
              <Label>Group name *</Label>
              <Input
                accessibilityLabel="Group name"
                value={p.name}
                onChangeText={p.onNameChange}
                maxLength={80}
                editable={p.canManage && !busy}
              />
              <GroupMetadataFields {...p} disabled={!p.canManage || busy} />
              <Typography variant="caption">
                Currency · {p.group.currency}. Fixed for existing split amounts.
              </Typography>
              {p.canManage && (
                <Button disabled={busy || !p.name.trim()} onPress={p.onSaveDetails ?? p.onSaveName}>
                  {p.saving === 'name' || p.saving === 'details'
                    ? 'Saving…'
                    : p.onSaveDetails
                      ? 'Save details'
                      : 'Save name'}
                </Button>
              )}
              {!p.canManage && (
                <Typography variant="caption">
                  Only owners and admins can change group details.
                </Typography>
              )}
            </GroupPanel>
            <GroupPanel>
              <Typography variant="heading">Appearance</Typography>
              {p.canManage ? (
                <>
                  <EntityIconPicker
                    mode="phosphor"
                    value={p.icon}
                    onChange={p.onIconChange}
                    label="Change group icon"
                    compact
                  />
                  <EntityColorPicker
                    value={p.color}
                    onChange={p.onColorChange}
                    label="Group color"
                  />
                  <Typography variant="caption">
                    Appearance changes require a connected cloud group.
                  </Typography>
                  <Button
                    variant="outline"
                    disabled={busy || !p.cloudGroupId || !p.color}
                    onPress={p.onSaveAppearance}
                  >
                    {p.saving === 'appearance' ? 'Saving…' : 'Save appearance'}
                  </Button>
                </>
              ) : (
                <Typography variant="caption">
                  Your group’s icon and color are managed by owners and admins.
                </Typography>
              )}
            </GroupPanel>
            {p.canManage && (
              <GroupPanel>
                <Typography variant="caption">
                  Anyone with this link can join the group. Choose how long new links stay active.
                  Generating or rotating a link invalidates any previous active link; reset revokes
                  it. Only admins can manage links.
                </Typography>
                <Typography variant="caption">Link lifetime</Typography>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {INVITATION_LINK_EXPIRY_OPTIONS.map(({ value, label }) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={
                        (p.invitationExpiryMs ?? INVITATION_LINK_DEFAULT_EXPIRY_MS) === value
                          ? 'secondary'
                          : 'outline'
                      }
                      disabled={p.invitationBusy}
                      onPress={() => p.onInvitationExpiryChange?.(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </View>
                {p.invitationUrl && (
                  <>
                    <Label>
                      Invitation link
                      {p.invitationExpiresAt
                        ? ` · Expires ${new Date(p.invitationExpiresAt).toLocaleString()}`
                        : ''}
                    </Label>
                    <Input
                      accessibilityLabel="Invitation link"
                      value={p.invitationUrl}
                      editable={false}
                      selectTextOnFocus
                    />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Button
                        variant="outline"
                        disabled={p.invitationBusy}
                        onPress={p.onShareInvitation}
                      >
                        Share link
                      </Button>
                    </View>
                  </>
                )}
                {p.invitationStatus && (
                  <Typography accessibilityLiveRegion="polite" variant="caption">
                    {p.invitationStatus}
                  </Typography>
                )}
                {p.invitationError && (
                  <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
                    {p.invitationError}
                  </Typography>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button
                    variant="outline"
                    disabled={p.invitationBusy || !p.cloudGroupId}
                    onPress={p.onRevokeInvitation}
                  >
                    Reset link
                  </Button>
                  <Button
                    disabled={p.invitationBusy || !p.cloudGroupId}
                    onPress={p.onCreateInvitation}
                  >
                    {p.invitationBusy
                      ? 'Working…'
                      : p.invitationUrl
                        ? 'Rotate link'
                        : 'Generate new link'}
                  </Button>
                </View>
              </GroupPanel>
            )}
            <GroupPanel>
              <Typography variant="heading">Members ({p.members.length})</Typography>
              <Typography variant="caption">Manage your group’s members and roles.</Typography>
              <Input
                accessibilityLabel="Search members"
                placeholder="Search members…"
                value={search}
                onChangeText={setSearch}
              />
              {p.canManage && (
                <View style={{ gap: 8 }}>
                  <Input
                    accessibilityLabel="Add member username"
                    value={p.memberInput}
                    onChangeText={p.onMemberInputChange}
                    placeholder="Invite @username"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                  />
                  <Button disabled={busy || !p.memberInput.trim()} onPress={p.onAddMember}>
                    {p.saving === 'member-add' ? 'Adding…' : '+ Invite member'}
                  </Button>
                </View>
              )}
              {p.membersLoading ? (
                <Typography variant="small">Loading saved membership…</Typography>
              ) : filteredMembers.length ? (
                filteredMembers.map((member) => {
                  const owner =
                    member.role === 'owner' ||
                    p.group?.ownerId === String(member.userId ?? member.memberId ?? member.id);
                  return (
                    <View
                      key={member.id}
                      style={{
                        gap: 10,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderColor: tokens.borderSubtle,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <GroupAvatar name={member.name} avatarUrl={member.avatarUrl} size={36} />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Typography variant="label">{member.name}</Typography>
                          {member.username && (
                            <Typography variant="caption">
                              @{member.username.replace(/^@+/, '')}
                            </Typography>
                          )}
                        </View>
                        <Typography
                          variant="caption"
                          style={{
                            color:
                              owner || member.role === 'admin'
                                ? tokens.primary
                                : tokens.foregroundMuted,
                          }}
                        >
                          {owner ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member'}
                        </Typography>
                      </View>
                      {p.canManage && !owner && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onPress={() => p.onChangeRole(member, member.role !== 'admin')}
                          >
                            {member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onPress={() => p.onRemoveMember(member)}
                          >
                            Remove
                          </Button>
                        </View>
                      )}
                    </View>
                  );
                })
              ) : search ? (
                <FinanceEmptyState
                  kind="search"
                  title="No matching members."
                  description="Try another name or username."
                  compact
                />
              ) : (
                <Typography variant="small">
                  Membership is not cached yet. Details appear after sync completes.
                </Typography>
              )}
            </GroupPanel>
            <GroupPanel>
              <Typography variant="heading">Chat retention</Typography>
              <GroupNote
                title="Disappearing messages"
                text="Existing and new messages, including bill images, are deleted on expiry. Ledger expenses are not chat messages."
                icon="phosphor:Clock"
                color={tokens.warning}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {retentionOptions.map((option) => (
                  <Button
                    key={option.label}
                    size="sm"
                    variant={p.retention === option.value ? 'secondary' : 'outline'}
                    disabled={!p.canManage || busy}
                    onPress={() => p.onRetentionChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </View>
              {p.canManage && (
                <Button disabled={busy || !p.cloudGroupId} onPress={p.onSaveRetention}>
                  {p.saving === 'retention' ? 'Saving…' : 'Save retention'}
                </Button>
              )}
              <Typography variant="caption">Changes require an internet connection.</Typography>
            </GroupPanel>
            <GroupPanel>
              <Typography variant="heading">Group overview</Typography>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <GroupTile icon={p.group.icon} color={p.group.color} size={64} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Typography variant="heading">{p.group.name}</Typography>
                  <Typography variant="caption">
                    {p.group.archived ? 'Archived group' : 'Active group'} · {p.group.currency}
                  </Typography>
                </View>
              </View>
              <Typography variant="small">Your access · {p.currentRole}</Typography>
              <Typography variant="small">
                {p.membersLoading ? 'Loading membership…' : `${p.members.length} saved members`}
              </Typography>
              <Typography variant="caption">
                Choose a split method per expense. Settlements are recorded manually; approval rules
                and scheduled payments are not available.
              </Typography>
            </GroupPanel>
            <GroupPanel>
              <Typography variant="heading">Actions</Typography>
              <Button variant="outline" onPress={p.onOpenAnalytics}>
                View group analytics
              </Button>
              <Button variant="outline" onPress={p.onBack}>
                Return to group
              </Button>
            </GroupPanel>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
