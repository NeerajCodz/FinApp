'use client';
import React, { useState } from 'react';
import {
  INVITATION_LINK_DEFAULT_EXPIRY_MS,
  INVITATION_LINK_EXPIRY_OPTIONS,
  type InvitationLinkExpiryMs,
} from '../groupInvitationExpiry';
import { Button, Input, Empty } from '@finapp/ui/web';
import { Plus, Crown, ArrowUp, ArrowDown, ChartBar } from '@phosphor-icons/react';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIconPicker } from './EntityIconPicker';
import { GroupPage, Crumb, Tile, PersonAvatar, Permissions, s } from './GroupUI';
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
  successMessage?: string;
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
  const [search, setSearch] = useState('');
  const members = p.members.filter((m) =>
    `${m.name} ${m.username ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );
  const icon = p.icon ?? p.group.icon,
    color = p.color ?? p.group.color;
  return (
    <GroupPage>
      <Crumb onBack={p.onBack} name={p.group.name} current="Edit" />
      <header className={s.heading}>
        <div>
          <h1>Edit group</h1>
          <p className={s.subtitle}>
            Update group details, manage members, and configure settings.
          </p>
        </div>
        <Button variant="outline" onPress={p.onBack}>
          Back to group
        </Button>
      </header>
      {p.error && (
        <p className={s.error} role="alert">
          {p.error}
        </p>
      )}
      <div className={`${s.columns} ${s.editColumns}`}>
        <div className={s.stack}>
          {p.successMessage && (
            <p role="status" className={s.muted}>
              {p.successMessage}
            </p>
          )}
          <section className={s.panel}>
            <div>
              <h2>Group details</h2>
              <p className={s.muted}>Basic information about your group.</p>
            </div>
            <div className={s.details}>
              <div className={s.appearance}>
                <Tile large icon={icon} color={color} />
                {p.canManage && (
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
                    <Button
                      size="sm"
                      disabled={!!p.saving || !p.cloudGroupId || !p.color}
                      onPress={p.onSaveAppearance}
                    >
                      {p.saving === 'appearance' ? 'Saving…' : 'Save appearance'}
                    </Button>
                  </>
                )}
              </div>
              <div className={s.stack}>
                <form className={s.fields} onSubmit={p.onSaveName}>
                  <label className={s.field}>
                    <span>Group name *</span>
                    <Input
                      aria-label="Group name"
                      value={p.name}
                      onChangeText={p.onNameChange}
                      required
                      maxLength={80}
                      disabled={!p.canManage}
                    />
                  </label>
                  <div className={s.field}>
                    <span>Currency</span>
                    <div className={s.permission}>{p.group.currency}</div>
                    <p className={s.muted}>Fixed to preserve existing splits.</p>
                  </div>
                  {p.canManage && (
                    <div className={s.actions}>
                      <Button size="sm" type="submit" disabled={!!p.saving}>
                        {p.saving === 'name' ? 'Saving…' : 'Save name'}
                      </Button>
                    </div>
                  )}
                </form>
                <div className={s.fields}>
                  <div className={s.permission}>
                    <Crown size={24} />
                    <div className={s.activityCopy}>
                      <strong>Your access</strong>
                      <small>{p.currentRole}</small>
                    </div>
                  </div>
                  <div className={s.permission}>
                    <Tile icon="phosphor:ChatCircle" color="#65d989" />
                    <div className={s.activityCopy}>
                      <strong>Chat & receipt sharing</strong>
                      <small>Available online after the group syncs.</small>
                    </div>
                  </div>
                </div>
                <p className={s.muted}>
                  Separate descriptions, visibility settings and approval rules are not available.
                </p>
              </div>
            </div>
          </section>
          {p.canManage && (
            <section className={s.panel}>
              <h2>Public invites</h2>
              <p className={s.muted}>
                Anyone with this link can join the group. Choose how long new links stay active.
                Generating or rotating a link invalidates any previous active link; reset revokes
                it. Only admins can manage links.
              </p>
              <p className={s.muted}>Link lifetime</p>
              <div className={s.actions} role="group" aria-label="Invitation link lifetime">
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
              </div>
              {p.invitationUrl && (
                <>
                  <label className={s.field}>
                    <span>
                      Invitation link
                      {p.invitationExpiresAt
                        ? ` · Expires ${new Date(p.invitationExpiresAt).toLocaleString()}`
                        : ''}
                    </span>
                    <Input
                      aria-label="Invitation link"
                      value={p.invitationUrl}
                      readOnly
                      onFocus={(event: React.FocusEvent<HTMLInputElement>) =>
                        event.currentTarget.select()
                      }
                    />
                  </label>
                  <div className={s.actions}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={p.invitationBusy}
                      onPress={p.onShareInvitation}
                    >
                      Share / copy link
                    </Button>
                  </div>
                </>
              )}
              {p.invitationStatus && (
                <p role="status" className={s.muted}>
                  {p.invitationStatus}
                </p>
              )}
              {p.invitationError && (
                <p role="alert" className={s.error}>
                  {p.invitationError}
                </p>
              )}
              <div className={s.actions}>
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
              </div>
            </section>
          )}
          <section className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <h2>Members ({p.members.length})</h2>
                <p className={s.muted}>Manage group members and their roles.</p>
              </div>
              <Input
                aria-label="Search members"
                placeholder="Search members…"
                value={search}
                onChangeText={setSearch}
              />
            </div>
            {p.canManage && (
              <div className={s.inviteRow}>
                <Input
                  aria-label="Add member username"
                  value={p.memberInput}
                  onChangeText={p.onMemberInputChange}
                  placeholder="@username"
                  autoComplete="off"
                />
                <Button disabled={!!p.saving || !p.memberInput.trim()} onPress={p.onAddMember}>
                  <Plus size={17} />
                  {p.saving === 'member-add' ? 'Adding…' : 'Invite member'}
                </Button>
              </div>
            )}
            {p.membersLoading && !p.remoteLoaded ? (
              <p role="status" className={s.muted}>
                Loading saved membership…
              </p>
            ) : p.members.length ? (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <tbody>
                    {members.map((m) => {
                      const owner =
                        m.role === 'owner' ||
                        p.group.ownerId === String(m.userId ?? m.memberId ?? m.id);
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className={s.member}>
                              <PersonAvatar name={m.name} url={m.avatarUrl} size={34} />
                              <strong>{m.name}</strong>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`${s.badge} ${owner || m.role === 'admin' ? s.admin : ''}`}
                            >
                              {owner ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Member'}
                            </span>
                          </td>
                          <td>
                            {p.canManage && !owner && (
                              <div className={s.actions}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!p.saving}
                                  onPress={() =>
                                    p.onChangeRole(m, m.role === 'admin' ? 'member' : 'admin')
                                  }
                                >
                                  {m.role === 'admin' ? (
                                    <ArrowDown size={14} />
                                  ) : (
                                    <ArrowUp size={14} />
                                  )}{' '}
                                  {m.role === 'admin' ? 'Demote' : 'Promote'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!p.saving}
                                  onPress={() => p.onRemoveMember(m)}
                                >
                                  Remove
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!members.length && <p className={s.empty}>No members match this search.</p>}
              </div>
            ) : (
              <Empty
                title="Membership is not cached yet"
                description="Member details appear after initial sync completes."
              />
            )}
          </section>
          <section className={s.panel}>
            <h2>Chat & message retention</h2>
            <p className={s.muted}>
              Expired messages, including receipt images, are deleted. Retention changes require an
              internet connection.
            </p>
            <div className={s.fields}>
              <label className={s.field}>
                <span>Disappearing messages</span>
                <select
                  aria-label="Disappearing message retention"
                  value={p.retention === null ? '' : String(p.retention)}
                  disabled={!p.canManage}
                  onChange={(e) =>
                    p.onRetentionChange(
                      e.currentTarget.value ? Number(e.currentTarget.value) : null,
                    )
                  }
                >
                  <option value="">Never</option>
                  <option value="86400000">1 day</option>
                  <option value="604800000">7 days</option>
                  <option value="2592000000">30 days</option>
                </select>
              </label>
              {p.canManage && (
                <div className={s.field}>
                  <span>Save chat settings</span>
                  <Button disabled={!!p.saving || !p.cloudGroupId} onPress={p.onSaveRetention}>
                    {p.saving === 'retention' ? 'Saving…' : 'Save retention'}
                  </Button>
                </div>
              )}
            </div>
          </section>
          <Permissions />
        </div>
        <aside className={s.stack}>
          <section className={s.panel}>
            <h3>Group overview</h3>
            <div className={s.tip}>
              <Tile icon={icon} color={color} />
              <div>
                <h3>{p.name || p.group.name}</h3>
                <p>{p.group.archived ? 'Archived group' : 'Active group'}</p>
              </div>
            </div>
            <p className={s.muted}>{p.group.currency} · Private shared ledger</p>
            <div className={s.permission}>
              <Crown size={18} />
              <span>Your role · {p.currentRole}</span>
            </div>
            <div className={s.permission}>
              <span>Manual settlements · Flexible splits</span>
            </div>
            <div className={s.permission}>
              <span>
                Chat retention · {p.retention === null ? 'Never' : `${p.retention / 86400000} days`}
              </span>
            </div>
          </section>
          <section className={s.panel}>
            <h3>Quick stats</h3>
            <div className={s.fields}>
              <div className={s.summaryAmount}>
                <span className={s.muted}>Members</span>
                <strong>{p.members.length}</strong>
              </div>
              <div className={s.summaryAmount}>
                <span className={s.muted}>Admins & owner</span>
                <strong>
                  {
                    p.members.filter(
                      (m) =>
                        m.role === 'admin' ||
                        m.role === 'owner' ||
                        p.group.ownerId === String(m.userId ?? m.memberId ?? m.id),
                    ).length
                  }
                </strong>
              </div>
            </div>
            <p className={s.muted}>Open the group to view complete financial balances.</p>
          </section>
          <section className={s.panel}>
            <h3>Actions</h3>
            <Button variant="outline" onPress={p.onOpenAnalytics}>
              <ChartBar size={19} /> View group analytics
            </Button>
            <Button variant="outline" onPress={p.onBack}>
              View group & balances
            </Button>
            <p className={s.muted}>
              Group export and self-service leave actions are not available here.
            </p>
          </section>
          <p className={s.muted}>
            Name changes save locally and sync when connected. Membership and appearance changes
            require the connected group.
          </p>
        </aside>
      </div>
    </GroupPage>
  );
}
