'use client';

import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { FinanceBrand } from './FinanceBrand';
import styles from './FinanceWorkspace.module.css';

export function FinanceWorkspace({
  children,
  navigation,
  brandLink,
  mobileNavigation,
  mobileHeaderAction,
  brandAction,
  onAdd,
}: {
  children: ReactNode;
  navigation: ReactNode;
  brandLink?: ReactNode;
  mobileNavigation?: ReactNode;
  /** Top-right of the phone header (e.g. the profile avatar). */
  mobileHeaderAction?: ReactNode;
  /** Next to the brand in the desktop sidebar (e.g. sync and notifications). */
  brandAction?: ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Finapp">
        <div className={styles.brand}>
          {brandLink ?? <FinanceBrand />}
          {brandAction ? <span className={styles.brandAction}>{brandAction}</span> : null}
        </div>
        <p className={styles.navigationLabel}>YOUR MONEY</p>
        <nav className={styles.navigation} aria-label="Main navigation">
          {navigation}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          {brandLink ?? <FinanceBrand />}
          {mobileHeaderAction ? (
            <span className={styles.mobileHeaderAction}>{mobileHeaderAction}</span>
          ) : null}
        </header>
        <div className={styles.content}>{children}</div>
        {mobileNavigation}
      </div>
      {onAdd ? (
        <button type="button" className={styles.add} aria-label="Add" onClick={onAdd}>
          <Plus size={28} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
