'use client';
import type { CSSProperties } from 'react';
import { ArrowLeftRight, CreditCard, FileText, PiggyBank, Wallet } from 'lucide-react';
import styles from './Dashboard.module.css';

export type AnalyticsMetric = {
  label: string;
  value: string;
  color: string;
  detail?: string;
  icon?: 'spent' | 'income' | 'net' | 'savings' | 'transactions';
};

type AnalyticsSummaryProps = {
  metrics: AnalyticsMetric[];
};

export function AnalyticsSummary({ metrics }: AnalyticsSummaryProps) {
  const icons = {
    spent: CreditCard,
    income: Wallet,
    net: ArrowLeftRight,
    savings: PiggyBank,
    transactions: FileText,
  };
  return (
    <section className={styles.summary} aria-label="Analytics summary">
      {metrics.map((item) => {
        const Icon = icons[item.icon ?? 'transactions'];
        const color = { '--metric-color': item.color } as CSSProperties;
        return (
          <article key={item.label} className={styles.metric} style={color}>
            <span className={styles.icon} aria-hidden="true">
              <Icon size={23} />
            </span>
            <p className={styles.label}>{item.label}</p>
            <p className={styles.value}>{item.value}</p>
            {item.detail && <p className={styles.detail}>{item.detail}</p>}
          </article>
        );
      })}
    </section>
  );
}
