'use client';
import type { CSSProperties } from 'react';
import { ArrowLeftRight, CreditCard, FileText, Wallet } from 'lucide-react';
import styles from './ActivitySummary.module.css';

export type ActivityMetric = {
  label: string;
  value: string;
  color: string;
  spark: readonly number[];
  icon?: 'spent' | 'income' | 'net' | 'transactions';
};

export function ActivitySummary({ metrics }: { metrics: readonly ActivityMetric[] }) {
  const icons = { spent: CreditCard, income: Wallet, net: ArrowLeftRight, transactions: FileText };
  return (
    <section className={styles.grid} aria-label="Activity summary">
      {metrics.map((metric) => {
        const Icon = icons[metric.icon ?? 'transactions'];
        const color = { '--metric-color': metric.color } as CSSProperties;
        return <article key={metric.label} className={styles.metric} style={color}>
          <span className={styles.icon} aria-hidden="true"><Icon size={22} /></span>
          <div className={styles.copy}><p className={styles.label}>{metric.label}</p><p className={styles.value}>{metric.value}</p></div>
          <div className={styles.spark} aria-hidden="true">{metric.spark.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>
        </article>;
      })}
    </section>
  );
}
