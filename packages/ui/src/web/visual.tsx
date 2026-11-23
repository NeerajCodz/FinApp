'use client';

import React from 'react';
import { Avatar } from './fields';
import { Skeleton } from './display';
import styles from './visual.module.css';

/** Semantic colour families shared by tiles, pills and stats. */
export type VisualTone =
  'accent' | 'income' | 'expense' | 'split' | 'settlement' | 'warning' | 'destructive' | 'neutral';

const toneVariable: Record<VisualTone, { solid: string; soft: string }> = {
  accent: { solid: 'var(--finapp-primary)', soft: 'var(--finapp-primary-soft)' },
  income: { solid: 'var(--finapp-income)', soft: 'var(--finapp-income-soft)' },
  expense: { solid: 'var(--finapp-expense)', soft: 'var(--finapp-expense-soft)' },
  split: { solid: 'var(--finapp-split)', soft: 'var(--finapp-split-soft)' },
  settlement: { solid: 'var(--finapp-settlement)', soft: 'var(--finapp-settlement-soft)' },
  warning: { solid: 'var(--finapp-warning)', soft: 'var(--finapp-warning-soft)' },
  destructive: { solid: 'var(--finapp-destructive)', soft: 'var(--finapp-destructive-soft)' },
  neutral: { solid: 'var(--finapp-foreground-muted)', soft: 'var(--finapp-surface-raised)' },
};

const toneStyle = (tone: VisualTone, color?: string) =>
  ({
    '--tone': color ?? toneVariable[tone].solid,
    '--tone-soft': color
      ? `color-mix(in srgb, ${color} 14%, transparent)`
      : toneVariable[tone].soft,
  }) as React.CSSProperties;

/** Rounded, tinted well for an icon — the coloured "tile" from the reference designs. */
export function IconTile({
  children,
  tone = 'accent',
  color,
  size = 44,
  solid = false,
}: {
  children: React.ReactNode;
  tone?: VisualTone;
  color?: string;
  size?: number;
  solid?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={styles.iconTile}
      data-solid={solid || undefined}
      style={{ ...toneStyle(tone, color), width: size, height: size, borderRadius: size * 0.32 }}
    >
      {children}
    </span>
  );
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: VisualTone }) {
  return (
    <span className={styles.pill} style={toneStyle(tone)}>
      <span className={styles.pillDot} />
      {label}
    </span>
  );
}

export function Sparkline({
  values,
  width = 88,
  height = 30,
  tone = 'accent',
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  tone?: VisualTone;
}) {
  const id = React.useId().replace(/:/g, '');
  if (values.length < 2) return <span style={{ display: 'inline-block', width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const line = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 3 - ((value - min) / range) * (height - 6);
      return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const color = toneVariable[tone].solid;
  return (
    <svg aria-hidden="true" width={width} height={height}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.28} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  icon,
  tone = 'accent',
  trend,
  series,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: VisualTone;
  trend?: { label: string; direction: 'up' | 'down' | 'flat'; good?: boolean };
  series?: readonly number[];
  className?: string;
}) {
  const trendState = !trend
    ? undefined
    : trend.direction === 'flat'
      ? 'flat'
      : (trend.good ?? trend.direction === 'up')
        ? 'good'
        : 'bad';
  return (
    <div className={[styles.stat, className].filter(Boolean).join(' ')}>
      <div className={styles.statHeader}>
        {icon ? (
          <IconTile tone={tone} size={32}>
            {icon}
          </IconTile>
        ) : null}
        <span className={styles.statLabel}>{label}</span>
      </div>
      <div className={styles.statBody}>
        <div className={styles.statValue}>
          <strong>{value}</strong>
          {trend ? (
            <small data-trend={trendState}>
              {trend.direction === 'up' ? '▲ ' : trend.direction === 'down' ? '▼ ' : ''}
              {trend.label}
            </small>
          ) : null}
        </div>
        {series ? <Sparkline values={series} tone={tone} width={72} height={28} /> : null}
      </div>
    </div>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = 30,
}: {
  people: readonly { id: string; name: string; imageUrl?: string | null; avatarId?: string }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?';
  return (
    <span
      className={styles.stack}
      aria-label={`${people.length} ${people.length === 1 ? 'person' : 'people'}`}
      style={{ '--overlap': `${-size * 0.3}px` } as React.CSSProperties}
    >
      {shown.map((person) => (
        <span key={person.id} className={styles.stackItem} title={person.name}>
          <Avatar
            initials={initials(person.name)}
            size={size}
            imageUrl={person.imageUrl}
            avatarId={person.avatarId}
          />
        </span>
      ))}
      {overflow > 0 ? (
        <span className={styles.stackMore} style={{ width: size + 4, height: size + 4 }}>
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export function HeroCard({
  children,
  tone = 'accent',
  className,
}: {
  children: React.ReactNode;
  tone?: VisualTone;
  className?: string;
}) {
  return (
    <section className={[styles.hero, className].filter(Boolean).join(' ')} style={toneStyle(tone)}>
      {children}
    </section>
  );
}

export function ListSkeleton({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className={styles.skeletonList} role="progressbar" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          {avatar ? <Skeleton width={42} height={42} /> : null}
          <div className={styles.skeletonLines}>
            <Skeleton width={index % 2 ? '55%' : '70%'} height={14} />
            <Skeleton width="35%" height={11} />
          </div>
          <Skeleton width={64} height={14} />
        </div>
      ))}
    </div>
  );
}
