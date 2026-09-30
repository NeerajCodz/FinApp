import styles from './FinanceBrand.module.css';

type FinanceSyncTone = 'connected' | 'syncing' | 'attention' | 'idle';

const syncLabels: Record<FinanceSyncTone, string> = {
  connected: 'All changes synced',
  syncing: 'Syncing changes',
  attention: 'Sync needs attention',
  idle: 'Sign in to sync',
};

export function FinanceBrand({ syncTone }: { syncTone?: FinanceSyncTone }) {
  const toneClass = syncTone ? styles[syncTone] : '';
  return (
    <span
      className={styles.brand}
      aria-label={syncTone ? `Finapp. ${syncLabels[syncTone]}` : 'Finapp'}
    >
      <span className={`${styles.dot} ${toneClass}`} aria-hidden="true" />
      <span>finapp</span>
    </span>
  );
}

