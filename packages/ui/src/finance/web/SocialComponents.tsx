'use client';

import React from 'react';
import { Avatar } from '@finapp/ui/web';
import type { SocialProfileSummary } from '../social';
import styles from './SocialComponents.module.css';

export function SocialPersonCard({
  profile,
  href,
  detail,
  action,
  className,
}: {
  profile: SocialProfileSummary;
  href?: string;
  detail?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const identity = (
    <>
      <Avatar
        label={profile.displayName}
        initials={profile.displayName.trim().slice(0, 2).toLocaleUpperCase() || 'F'}
        size={48}
        avatarId={profile.avatarId}
        imageUrl={profile.avatarUrl ?? undefined}
      />
      <span className={styles.identityCopy}>
        <strong>{profile.displayName}</strong>
        {profile.username && <small>@{profile.username.replace(/^@+/, '')}</small>}
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
    </>
  );
  return (
    <article className={`${styles.personCard} ${className ?? ''}`}>
      {href ? (
        <a className={styles.identity} href={href}>
          {identity}
        </a>
      ) : (
        <div className={styles.identity}>{identity}</div>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </article>
  );
}

export function SocialSection({
  title,
  count,
  action,
  children,
  className,
  id,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`${styles.section} ${className ?? ''}`} aria-label={title}>
      <header className={styles.sectionHeader}>
        <h2>
          {title}
          {count !== undefined && <span>{count}</span>}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SocialStat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <article className={styles.stat}>
      {icon && (
        <span className={styles.statIcon} aria-hidden="true">
          {icon}
        </span>
      )}
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  );
}
