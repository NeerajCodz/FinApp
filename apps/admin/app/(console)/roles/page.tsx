'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { GripVertical, Lock, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Switch, Tabs } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  ADMIN_PERMISSIONS,
  PERMISSION_LABELS,
  type AdminPermission,
} from '@convex/admin/permissions';
import {
  Empty,
  Loading,
  PageHeader,
  Panel,
  RequirePermission,
  RoleChip,
  UserCell,
} from '@/components/ui';
import { useAdmin, useCan } from '@/lib/admin';
import { errorText } from '@/lib/format';

const COLORS = [
  '#e5484d',
  '#f76b15',
  '#f5d90a',
  '#30a46c',
  '#12a594',
  '#0090ff',
  '#3e63dd',
  '#8e4ec6',
  '#d6409f',
  '#8b8d98',
];
const BADGES = ['🛡️', '🔨', '💬', '⭐', '👑', '🧭', '🧪', '📣', '🔒', '🤖', '🐛', '💎'];

type Role = NonNullable<ReturnType<typeof useRoles>>[number];

function useRoles() {
  return useQuery(api.admin.roles.listRoles, {});
}

type Draft = {
  name: string;
  color: string;
  icon: string;
  permissions: string[];
  hoist: boolean;
  mentionable: boolean;
};

function draftOf(role: Role): Draft {
  return {
    name: role.name,
    color: role.color,
    icon: role.icon ?? '',
    permissions: [...role.permissions],
    hoist: role.hoist,
    mentionable: role.mentionable,
  };
}

function RoleList({
  roles,
  selected,
  onSelect,
}: {
  roles: Role[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const reorder = useMutation(api.admin.roles.reorderRoles);
  const [order, setOrder] = useState(roles.map((role) => role.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  useEffect(() => setOrder(roles.map((role) => role.id)), [roles]);
  const byId = new Map(roles.map((role) => [role.id as string, role]));

  async function drop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const target = byId.get(targetId);
    if (!target?.manageable) return;
    const next = order.filter((id) => id !== dragging);
    next.splice(next.indexOf(targetId as never), 0, dragging as never);
    setOrder(next);
    const manageable = next.filter((id) => byId.get(id)?.manageable);
    try {
      await reorder({ orderedIds: manageable });
    } catch (cause) {
      toast.error(errorText(cause));
      setOrder(roles.map((role) => role.id));
    }
  }

  return (
    <div className="admin-role-list" role="list" aria-label="Roles, highest first">
      {order.map((id) => {
        const role = byId.get(id);
        if (!role) return null;
        return (
          <button
            key={id}
            type="button"
            role="listitem"
            className="admin-role-row"
            aria-current={selected === id}
            data-dragging={dragging === id}
            data-drop={over === id && dragging !== id}
            draggable={role.manageable}
            onDragStart={() => setDragging(id)}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(event) => {
              if (!role.manageable) return;
              event.preventDefault();
              setOver(id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              void drop(id);
              setOver(null);
            }}
            onClick={() => onSelect(id)}
          >
            <span className="admin-grip" aria-hidden>
              {role.manageable ? <GripVertical size={16} /> : <Lock size={14} />}
            </span>
            <span className="admin-dot" style={{ background: role.color }} />
            <span>
              {role.icon ? `${role.icon} ` : ''}
              {role.name}
            </span>
            <small>{role.memberCount}</small>
          </button>
        );
      })}
    </div>
  );
}

function Members({ role }: { role: Role }) {
  const staff = useQuery(api.admin.roles.listStaff, {});
  const assign = useMutation(api.admin.roles.assignRole);
  const unassign = useMutation(api.admin.roles.unassignRole);
  const [username, setUsername] = useState('');
  const members = (staff ?? []).filter((member) =>
    member.roles.some((item) => item.id === role.id),
  );
  return (
    <div className="admin-form">
      {role.assignable ? (
        <form
          className="admin-toolbar"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await assign({ username: username.trim(), roleId: role.id });
              toast.success(`Gave ${role.name} to @${username.trim().replace(/^@/, '')}`);
              setUsername('');
            } catch (cause) {
              toast.error(errorText(cause));
            }
          }}
        >
          <Input
            aria-label="Finapp username"
            placeholder="Finapp username"
            value={username}
            onChangeText={setUsername}
          />
          <Button type="submit" size="sm" disabled={!username.trim()}>
            Add member
          </Button>
        </form>
      ) : (
        <p className="admin-muted">You can’t assign this role (it’s at or above your highest).</p>
      )}
      {!staff ? (
        <Loading />
      ) : members.length === 0 ? (
        <Empty>No one has this role.</Empty>
      ) : (
        <table className="admin-table">
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <UserCell user={member.user} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  {member.user && (role.assignable || role.system === 'owner') ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={async () => {
                        if (!member.user) return;
                        try {
                          await unassign({ userId: member.user.id, roleId: role.id });
                          toast.success('Role removed');
                        } catch (cause) {
                          toast.error(errorText(cause));
                        }
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Editor({ role, onDeleted }: { role: Role; onDeleted: () => void }) {
  const me = useAdmin();
  const can = useCan();
  const update = useMutation(api.admin.roles.updateRole);
  const remove = useMutation(api.admin.roles.deleteRole);
  const [draft, setDraft] = useState<Draft>(() => draftOf(role));
  const [tab, setTab] = useState('display');
  useEffect(() => setDraft(draftOf(role)), [role]);
  const editable = role.manageable;
  const mine = useMemo(() => new Set(me.permissions), [me.permissions]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(role));
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  async function save() {
    try {
      await update({
        roleId: role.id,
        name: draft.name,
        color: draft.color,
        ...(draft.icon ? { icon: draft.icon } : {}),
        permissions: draft.permissions,
        hoist: draft.hoist,
        mentionable: draft.mentionable,
      });
      toast.success('Role saved');
    } catch (cause) {
      toast.error(errorText(cause));
    }
  }

  return (
    <Panel
      title={`Edit role: ${role.name}`}
      description={
        role.system === 'owner'
          ? 'The Owner role is above every other role and can’t be edited.'
          : editable
            ? 'Changes apply as soon as you save.'
            : 'This role is at or above your highest role, so you can only view it.'
      }
      actions={
        editable ? (
          <div className="admin-actions">
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty}
              onPress={() => setDraft(draftOf(role))}
            >
              Reset
            </Button>
            <Button size="sm" disabled={!dirty} onPress={save}>
              Save
            </Button>
          </div>
        ) : null
      }
    >
      <Tabs
        label="Role sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'display', label: 'Display' },
          { value: 'permissions', label: 'Permissions' },
          { value: 'members', label: `Members (${role.memberCount})` },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === 'display' ? (
          <div className="admin-form">
            <label className="admin-field">
              <span>Role name</span>
              <Input
                value={draft.name}
                maxLength={32}
                disabled={!editable}
                onChangeText={(name) => set({ name })}
              />
            </label>
            <div className="admin-field">
              <span>Color</span>
              <div className="admin-swatches">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="admin-swatch"
                    style={{ background: color }}
                    aria-label={color}
                    aria-pressed={draft.color === color}
                    disabled={!editable}
                    onClick={() => set({ color })}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Custom color"
                  value={draft.color}
                  disabled={!editable}
                  onChange={(event) => set({ color: event.target.value })}
                />
              </div>
            </div>
            <div className="admin-field">
              <span>Badge</span>
              <div className="admin-badges">
                <button
                  type="button"
                  className="admin-badge-option"
                  aria-pressed={!draft.icon}
                  disabled={!editable}
                  onClick={() => set({ icon: '' })}
                >
                  –
                </button>
                {BADGES.map((badge) => (
                  <button
                    key={badge}
                    type="button"
                    className="admin-badge-option"
                    aria-pressed={draft.icon === badge}
                    disabled={!editable}
                    onClick={() => set({ icon: badge })}
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-field">
              <span>Preview</span>
              <div>
                <RoleChip
                  role={{
                    name: draft.name || 'Role',
                    color: draft.color,
                    icon: draft.icon || null,
                  }}
                />
              </div>
            </div>
            <Switch
              label="Show as a staff badge on public profiles"
              value={draft.hoist}
              disabled={!editable}
              onValueChange={(hoist) => set({ hoist })}
            />
            <Switch
              label="Mentionable by staff"
              value={draft.mentionable}
              disabled={!editable}
              onValueChange={(mentionable) => set({ mentionable })}
            />
            {editable ? (
              <div>
                <Button
                  variant="destructive"
                  size="sm"
                  onPress={async () => {
                    if (!window.confirm(`Delete the ${role.name} role? Members lose it.`)) return;
                    try {
                      await remove({ roleId: role.id });
                      toast.success('Role deleted');
                      onDeleted();
                    } catch (cause) {
                      toast.error(errorText(cause));
                    }
                  }}
                >
                  <Trash2 size={15} aria-hidden /> Delete role
                </Button>
              </div>
            ) : null}
          </div>
        ) : tab === 'permissions' ? (
          <div className="admin-perms">
            {ADMIN_PERMISSIONS.map((permission: AdminPermission) => {
              const on = draft.permissions.includes(permission);
              // Discord rule: you can only grant what you have.
              const grantable = mine.has(permission) || on;
              return (
                <div key={permission} className="admin-perm">
                  <div>
                    <strong>{PERMISSION_LABELS[permission].label}</strong>
                    <small>{PERMISSION_LABELS[permission].description}</small>
                  </div>
                  <Switch
                    label={PERMISSION_LABELS[permission].label}
                    value={on}
                    disabled={!editable || !grantable}
                    onValueChange={(value) =>
                      set({
                        permissions: value
                          ? [...draft.permissions, permission]
                          : draft.permissions.filter((item) => item !== permission),
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : can('ASSIGN_ROLES') || can('MANAGE_ROLES') ? (
          <Members role={role} />
        ) : null}
      </div>
    </Panel>
  );
}

function RolesEditor() {
  const roles = useRoles();
  const create = useMutation(api.admin.roles.createRole);
  const can = useCan();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (roles && (!selected || !roles.some((role) => role.id === selected)))
      setSelected(roles[0]?.id ?? null);
  }, [roles, selected]);
  if (!roles) return <Loading />;
  const role = roles.find((item) => item.id === selected) ?? null;
  return (
    <div className="admin-roles">
      <Panel
        title="Roles"
        description="Drag to reorder. You can only move roles below your own."
        actions={
          can('MANAGE_ROLES') ? (
            <Button
              size="sm"
              variant="outline"
              onPress={async () => {
                try {
                  const id = await create({
                    name: 'New role',
                    color: '#8b8d98',
                    permissions: [],
                    hoist: false,
                    mentionable: false,
                  });
                  setSelected(id as Id<'adminRoles'>);
                } catch (cause) {
                  toast.error(errorText(cause));
                }
              }}
            >
              <Plus size={15} aria-hidden /> New
            </Button>
          ) : null
        }
      >
        <RoleList roles={roles} selected={selected} onSelect={setSelected} />
      </Panel>
      {role ? (
        <Editor key={role.id} role={role} onDeleted={() => setSelected(null)} />
      ) : (
        <Empty>Select a role.</Empty>
      )}
    </div>
  );
}

export default function RolesPage() {
  return (
    <RequirePermission any={['MANAGE_ROLES', 'ASSIGN_ROLES']}>
      <PageHeader
        title="Roles"
        description="Discord-style roles: order sets rank, ADMINISTRATOR grants everything, and you can only manage roles below your highest."
      />
      <RolesEditor />
    </RequirePermission>
  );
}
