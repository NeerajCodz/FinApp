import styles from './FinanceBrand.module.css';

export function FinanceBrand() {
  return (
    <span className={styles.brand} aria-label="Finapp">
      <span className={styles.dot} aria-hidden="true" />
      <span>finapp</span>
    </span>
  );
}
