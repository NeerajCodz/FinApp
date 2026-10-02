'use client';
import React from 'react';
import { Avatar, useTheme } from '@finapp/ui/web';
import { EntityIcon } from './EntityIconPicker';
import s from './Groups.module.css';
export { s };
export function GroupPage({ children }: { children: React.ReactNode }) {
  const { tokens: t } = useTheme();
  return (
    <main
      className={s.page}
      style={
        {
          '--g-fg': t.foreground,
          '--g-muted': t.foregroundMuted,
          '--g-border': t.borderSubtle,
          '--g-surface': t.surfaceSubtle,
          '--g-raised': t.surfaceRaised,
          '--g-primary': t.primary,
          '--g-income': t.income,
          '--g-expense': t.expense,
        } as React.CSSProperties
      }
    >
      {children}
    </main>
  );
}
export function Tile({
  icon = 'phosphor:UsersThree',
  color,
  large = false,
}: {
  icon?: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <span
      className={`${s.tile} ${large ? s.largeTile : ''}`}
      style={color ? ({ '--tile-color': color } as React.CSSProperties) : undefined}
    >
      <EntityIcon value={icon} size={large ? 62 : 27} color="#101510" />
    </span>
  );
}
export function PersonAvatar({
  name,
  url,
  avatarId,
  size = 32,
}: {
  name: string;
  url?: string | null;
  avatarId?: string;
  size?: number;
}) {
  return (
    <Avatar
      label={name}
      initials={name
        .split(/\s+/)
        .map((x) => x[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()}
      imageUrl={url ?? null}
      avatarId={avatarId}
      size={size}
    />
  );
}
export function Metric({
  label,
  value,
  note,
  icon,
  color,
}: {
  label: string;
  value: string;
  note?: string;
  icon: string;
  color: string;
}) {
  return (
    <section className={s.metric}>
      <Tile icon={icon} color={color} />
      <div>
        <span className={s.muted}>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </section>
  );
}
export function Crumb({
  onBack,
  name,
  current,
}: {
  onBack: () => void;
  name?: string;
  current: string;
}) {
  return (
    <nav className={s.crumb} aria-label="Breadcrumb">
      <button onClick={onBack} type="button">
        Groups
      </button>
      <span>›</span>
      {name && (
        <>
          <span>{name}</span>
          <span>›</span>
        </>
      )}
      <span>{current}</span>
    </nav>
  );
}
export function Tip({
  title,
  text,
  icon,
  color,
}: {
  title: string;
  text: string;
  icon: string;
  color: string;
}) {
  return (
    <div className={s.tip}>
      <Tile icon={icon} color={color} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}
export const groupTemplates = [
  {
    name: 'Trip with friends',
    text: 'Travel, food and activities.',
    icon: 'phosphor:TreePalm',
    color: '#69ed89',
  },
  {
    name: 'Flatmates',
    text: 'Rent, utilities and household expenses.',
    icon: 'phosphor:House',
    color: '#ac8bf5',
  },
  {
    name: 'Office group',
    text: 'Team lunches and work expenses.',
    icon: 'phosphor:Briefcase',
    color: '#f4cd63',
  },
  {
    name: 'Event',
    text: 'Parties and special occasions.',
    icon: 'phosphor:CalendarBlank',
    color: '#fa94b9',
  },
];
export function Permissions() {
  return (
    <section className={s.panel}>
      <div>
        <h2>Admin & permissions</h2>
        <p className={s.muted}>How your group works.</p>
      </div>
      <div className={s.fields}>
        <div className={s.permission}>
          <EntityIcon value="phosphor:Receipt" />
          <div className={s.activityCopy}>
            <strong>Shared expenses</strong>
            <small>Members record expenses from their own accounts.</small>
          </div>
        </div>
        <div className={s.permission}>
          <EntityIcon value="phosphor:UserPlus" />
          <div className={s.activityCopy}>
            <strong>Manage members</strong>
            <small>Owners and admins manage membership and roles.</small>
          </div>
        </div>
        <div className={s.permission}>
          <EntityIcon value="phosphor:ChatCircle" />
          <div className={s.activityCopy}>
            <strong>Group chat & receipts</strong>
            <small>Available online after the group has synced.</small>
          </div>
        </div>
        <div className={s.permission}>
          <EntityIcon value="phosphor:ArrowsLeftRight" />
          <div className={s.activityCopy}>
            <strong>Manual settlements</strong>
            <small>Record payments after members settle up.</small>
          </div>
        </div>
      </div>
      <p className={s.muted}>Approval rules and scheduled settlements are not available.</p>
    </section>
  );
}
