'use client';

import React from 'react';
import styles from './FinanceEmptyState.module.css';
import { Illustration } from '../../illustrations/web';
import type { IllustrationScene } from '../../illustrations/scenes';

export type FinanceEmptyKind =
  | 'account'
  | 'budget'
  | 'transaction'
  | 'analytics'
  | 'goal'
  | 'category'
  | 'activity'
  | 'group'
  | 'recurring'
  | 'search'
  | 'contribution'
  | 'invitation'
  | 'people'
  | 'message';

export type FinanceEmptyStateProps = {
  kind: FinanceEmptyKind;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
  /** Overrides the illustration; defaults to the scene matching `kind`. */
  scene?: IllustrationScene;
};

export function FinanceEmptyState({
  kind,
  title,
  description,
  action,
  compact = false,
  scene,
}: FinanceEmptyStateProps) {
  return (
    <section className={`${styles.emptyState} ${compact ? styles.compact : ''}`}>
      <Illustration
        scene={scene ?? kind}
        size={compact ? 96 : 156}
        className={styles.illustration}
      />
      <div className={styles.copy}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
