'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Avatar, Spinner } from '@finapp/ui/web';
import { useCan } from '@/lib/admin';
import type { AdminPermission } from '@convex/admin/permissions';
import { Forbidden } from './Shell';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  style,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section className="admin-panel" style={style}>
      {title || actions ? (
        <header>
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="admin-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function Loading() {
  return (
    <div className="admin-empty" role="status">
      <Spinner />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}

export type UserCardData = {
  id: string;
  username: string | null;
  displayName: string;
  avatarId: string | null;
  avatarUrl: string | null;
  deleted?: boolean;
} | null;

export function UserCell({ user, link = true }: { user: UserCardData; link?: boolean }) {
  if (!user) return <span className="admin-muted">Unknown user</span>;
  const body = (
    <span className="admin-user">
      <Avatar
        initials={user.displayName.slice(0, 2)}
        size={30}
        imageUrl={user.avatarUrl}
        avatarId={user.avatarId ?? undefined}
      />
      <div>
        <strong>{user.displayName}</strong>
        <small>
          {user.username ? `@${user.username}` : user.deleted ? 'deleted' : 'no username'}
        </small>
      </div>
    </span>
  );
  return link ? <Link href={`/users/${user.id}`}>{body}</Link> : body;
}

export function Pill({
  tone,
  children,
}: {
  tone?: 'good' | 'warn' | 'bad' | 'accent';
  children: ReactNode;
}) {
  return (
    <span className="admin-pill" data-tone={tone}>
      {children}
    </span>
  );
}

export function RoleChip({ role }: { role: { name: string; color: string; icon: string | null } }) {
  return (
    <span className="admin-role" style={{ color: role.color }}>
      {role.icon ? <i aria-hidden>{role.icon}</i> : null}
      {role.name}
    </span>
  );
}

export function StatePill({ state }: { state: string }) {
  const tone =
    state === 'active'
      ? 'good'
      : state === 'suspended'
        ? 'warn'
        : state === 'banned'
          ? 'bad'
          : undefined;
  return <Pill tone={tone}>{state}</Pill>;
}

/** Renders children only when the viewer holds one of the permissions (UI only). */
export function RequirePermission({
  any,
  children,
}: {
  any: AdminPermission[];
  children: ReactNode;
}) {
  const can = useCan();
  if (!any.some((permission) => can(permission))) return <Forbidden permission={any[0]!} />;
  return <>{children}</>;
}

export function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <select
      className="admin-select"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function statusTone(status: string) {
  return status === 'open'
    ? ('accent' as const)
    : status === 'pending'
      ? ('warn' as const)
      : status === 'resolved'
        ? ('good' as const)
        : undefined;
}

export function priorityTone(priority: string) {
  return priority === 'urgent'
    ? ('bad' as const)
    : priority === 'high'
      ? ('warn' as const)
      : undefined;
}
