'use client';
import { Download } from 'lucide-react';
import { Button } from '@finapp/ui/web';
import styles from './Dashboard.module.css';

type AnalyticsHeaderProps = {
  onExport: () => void;
};

export function AnalyticsHeader({ onExport }: AnalyticsHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <p className={styles.eyebrow}>A CLEARER VIEW OF YOUR MONEY</p>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.description}>
          Understand your spending, income and overall financial health. Track trends, discover
          insights and make better decisions.
        </p>
      </div>
      <Button className={styles.export} variant="outline" onPress={onExport}>
        <Download size={16} aria-hidden="true" /> Export
      </Button>
    </header>
  );
}
