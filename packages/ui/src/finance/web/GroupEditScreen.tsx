'use client';

import React from 'react';
import { ArrowLeft, Check, Pencil, UsersRound } from 'lucide-react';
import { Avatar, Badge, Button, Card, Empty, Input, SectionHeader } from '@finapp/ui/web';
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
  group: {
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
  membersLoading: boolean;
  remoteLoaded: boolean;
  error?: string;
  saving: string;
  cloudGroupId: string;
  name: string;
  onNameChange: (value: string) => void;
  onSaveName: (event: React.FormEvent<HTMLFormElement>) => void;
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
  onChangeRole: (member: GroupEditMember, role: 'admin' | 'member') => void;
  onRemoveMember: (member: GroupEditMember) => void;
  onBack: () => void;
  onOpenAnalytics: () => void;
};

export function GroupEditScreen({
  group,
  members,
  currentRole,
  canManage,
  membersLoading,
  remoteLoaded,
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
  onBack,
  onOpenAnalytics,
}: GroupEditScreenProps) {
  const [editingName, setEditingName] = React.useState(false);
  function submitName(event: React.FormEvent<HTMLFormElement>) {
    onSaveName(event);
    setEditingName(false);
  }
  return (
    <main className="finance-page">
      <header className="finance-page-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button size="icon" variant="ghost" aria-label="Back to group" onPress={onBack}>
            <ArrowLeft size={18} />
          </Button>
          <EntityIcon
            value={icon ?? group.icon ?? 'phosphor:UsersThree'}
            size={24}
            color={color ?? group.color}
          />
          <div>
            <p className="finance-kicker">GROUP MANAGEMENT</p>
            <h1 style={{ margin: 0 }}>Edit group</h1>
          </div>
        </div>
        <Button variant="outline" onPress={onOpenAnalytics}>
          Group analytics
        </Button>
      </header>
      {error && (
        <p className="finance-form-error" role="alert">
          {error}
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title={group.name}
          action={
            <Badge variant="neutral">{group.archived ? 'Archived group' : 'Active group'}</Badge>
          }
        />
        <p className="finance-muted">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </p>
        <div className="finance-page-actions">
          <span className="finance-form-note">Your access</span>
          <Badge variant={currentRole === 'Member' ? 'neutral' : 'success'}>{currentRole}</Badge>
        </div>
      </Card>
      <Card className="finance-form-panel">
        <SectionHeader title="Group details" />
        <p className="finance-form-note">
          Owners and admins can rename the group. Currency stays fixed for existing splits.
        </p>
        {editingName ? (
          <form className="finance-form" onSubmit={submitName}>
            <label className="finance-form-field">
              <span>Group name</span>
              <Input
                aria-label="Group name"
                value={name}
                onChangeText={onNameChange}
                maxLength={80}
                required
                disabled={!canManage}
              />
            </label>
            <p className="finance-form-note">
              Currency · {group.currency}. Kept fixed so existing split amounts stay consistent.
            </p>
            <div className="finance-page-actions">
              <Button type="submit" disabled={!canManage || saving === 'name'}>
                {saving === 'name' ? 'Saving…' : 'Save name'} <Check size={15} />
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving === 'name'}
                onPress={() => setEditingName(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="finance-record-copy">
            <strong>Group name</strong>
            <small>{group.name}</small>
            <small>Currency · {group.currency}</small>
            <small>Kept fixed so existing split amounts stay consistent.</small>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Edit group name"
                onPress={() => {
                  onNameChange(group.name);
                  setEditingName(true);
                }}
              >
                <Pencil size={18} />
              </Button>
            )}
          </div>
        )}
      </Card>
      {canManage && (
        <Card className="finance-form-panel">
          <SectionHeader title="Appearance & chat" />
          <p className="finance-form-note">
            Icon, color, and chat retention changes require an internet connection.
          </p>
          <div className="finance-form-field">
            <EntityIconPicker
              mode="phosphor"
              value={icon}
              onChange={onIconChange}
              label="Group icon"
              compact
            />
            <EntityColorPicker value={color} onChange={onColorChange} label="Group color" />
            <Button
              disabled={Boolean(saving) || !cloudGroupId || !color}
              onPress={onSaveAppearance}
            >
              {saving === 'appearance' ? 'Saving…' : 'Save appearance'}
            </Button>
          </div>
          <label className="finance-form-field">
            <span>Disappearing messages</span>
            <select
              aria-label="Disappearing message retention"
              className="finapp-input"
              value={retention === null ? '' : String(retention)}
              onChange={(event) =>
                onRetentionChange(
                  event.currentTarget.value ? Number(event.currentTarget.value) : null,
                )
              }
            >
              <option value="">Never</option>
              <option value="86400000">1 day</option>
              <option value="604800000">7 days</option>
              <option value="2592000000">30 days</option>
            </select>
          </label>
          <p className="finance-form-note">
            Existing and new messages, including bill images, are deleted when their retention
            expires.
          </p>
          <Button disabled={Boolean(saving) || !cloudGroupId} onPress={onSaveRetention}>
            {saving === 'retention' ? 'Saving…' : 'Save retention'}
          </Button>
        </Card>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title="Members"
          action={<Badge variant="neutral">{members.length} total</Badge>}
        />
        {canManage && (
          <div className="finance-form-row" style={{ marginBlock: 14 }}>
            <Input
              aria-label="Add member username"
              value={memberInput}
              onChangeText={onMemberInputChange}
              placeholder="@username"
              autoComplete="off"
            />
            <Button
              type="button"
              disabled={Boolean(saving) || !memberInput.trim()}
              onPress={onAddMember}
            >
              {saving === 'member-add' ? 'Adding…' : 'Add member'}
            </Button>
          </div>
        )}
        {membersLoading && !remoteLoaded ? (
          <p className="finance-muted" role="status">
            Loading saved membership…
          </p>
        ) : members.length ? (
          <ul className="finance-record-list">
            {members.map((member) => {
              const memberUserId = String(member.userId ?? member.memberId ?? member.id);
              const isOwner = member.role === 'owner' || group.ownerId === memberUserId;
              return (
                <li key={member.id}>
                  <Avatar
                    initials={member.name
                      .split(/\s+/)
                      .map((part) => part[0] ?? '')
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                    label={member.name}
                    size={42}
                    imageUrl={member.avatarUrl ?? null}
                  />
                  <span className="finance-record-copy">
                    <strong>{member.name}</strong>
                    <small>
                      {isOwner ? 'Group owner' : member.role === 'admin' ? 'Group admin' : 'Member'}
                    </small>
                  </span>
                  {canManage && !isOwner && (
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(saving)}
                        onPress={() =>
                          onChangeRole(member, member.role === 'admin' ? 'member' : 'admin')
                        }
                      >
                        {saving === member.id
                          ? 'Saving…'
                          : member.role === 'admin'
                            ? 'Remove admin'
                            : 'Make admin'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(saving)}
                        onPress={() => onRemoveMember(member)}
                      >
                        {saving === member.id ? 'Removing…' : 'Remove'}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            title="Membership is not cached yet"
            description="Member details appear after the group range or initial sync completes."
            icon={<UsersRound size={20} />}
          />
        )}
        <p className="finance-form-note">
          Owners and admins can manage members, the group icon, color, and disappearing-message
          retention.
        </p>
        <p className="finance-form-note">
          Group name changes save locally and sync when connected.
        </p>
      </Card>
    </main>
  );
}
