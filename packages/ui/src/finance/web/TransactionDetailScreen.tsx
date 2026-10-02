'use client';

import React from 'react';
import { ArrowLeft, Pencil, Copy } from 'lucide-react';
import { Button } from '@finapp/ui/web';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';
import { TransactionTable, type TransactionTableItem } from './TransactionsScreen';
import styles from './Transactions.module.css';
import type { SemanticType, TransactionType } from '../types';

export type TransactionDetailScreenProps = {
  title: string;
  amountMinor: bigint;
  currency: string;
  type: TransactionType;
  semanticType: SemanticType;
  status?: string;
  category: string;
  categoryIcon?: string;
  account: string;
  destination?: string;
  date: string;
  merchant?: string;
  note?: string;
  loading?: boolean;
  error?: string | null;
  unavailable?: boolean;
  missingId?: boolean;
  canEdit?: boolean;
  canDuplicate?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onRetry?: () => void;
  referenceId?: string;
  relatedTransactions?: readonly TransactionTableItem[];
  onOpenTransaction?: (id: string) => void;
  tags?: readonly string[];
};

export function TransactionDetailScreen(p: TransactionDetailScreenProps) {
  if (p.loading)
    return (
      <main className={styles.page}>
        <p role="status">Loading transaction…</p>
      </main>
    );
  if (p.error || p.unavailable || p.missingId)
    return (
      <main className={styles.page}>
        <button className={styles.back} onClick={p.onBack}>
          <ArrowLeft size={17} />
          Back to transactions
        </button>
        <section className={styles.panel}>
          <h1 className={styles.sectionTitle}>
            {p.error
              ? 'Transaction unavailable'
              : p.missingId
                ? 'Missing transaction ID'
                : 'Transaction unavailable'}
          </h1>
          <p
            role={p.error ? 'alert' : undefined}
            className={p.error ? styles.error : styles.subtitle}
          >
            {p.error || 'Choose an available transaction from your saved activity.'}
          </p>
          {p.error && p.onRetry && (
            <Button variant="outline" onPress={p.onRetry}>
              Try again
            </Button>
          )}
        </section>
      </main>
    );
  const details = [
    ['Category', p.category],
    ['Account', p.account],
    ...(p.destination ? [['Destination', p.destination]] : []),
    ['Date & time', p.date],
    ['Status', p.status ?? 'Saved'],
    ...(p.referenceId ? [['Reference ID', p.referenceId]] : []),
    ...(p.tags?.length ? [['Tags', p.tags.join(' · ')]] : []),
    ...(p.note ? [['Notes', p.note]] : []),
    ...(p.merchant ? [['Merchant / Payee', p.merchant]] : []),
  ];
  return (
    <main className={styles.page}>
      <button className={styles.back} onClick={p.onBack}>
        <ArrowLeft size={17} />
        Back to transactions
      </button>
      <section className={`${styles.panel} ${styles.hero}`}>
        <div className={styles.heroLeft}>
          <div className={styles.heroIdentity}>
            <div className={styles.heroIcon}>
              <CategoryIcon label={p.category} icon={p.categoryIcon} />
            </div>
            <div>
              <h1 className={styles.heroTitle}>{p.title}</h1>
              <p className={styles.subtitle}>{p.note || p.merchant || p.category}</p>
            </div>
          </div>
          <div>
            <div
              className={`${styles.heroAmount} ${p.type === 'income' || p.type === 'refund' ? styles.income : styles.expense}`}
            >
              <Money amountMinor={p.amountMinor} currency={p.currency} type={p.type} />
            </div>
            <p className={styles.subtitle}>{p.date}</p>
          </div>
          <div className={styles.controls}>
            {p.canEdit && p.onEdit && (
              <Button variant="outline" onPress={p.onEdit}>
                <Pencil size={17} />
                Edit
              </Button>
            )}
            {p.canDuplicate && p.onDuplicate && (
              <Button variant="outline" onPress={p.onDuplicate}>
                <Copy size={17} />
                Duplicate
              </Button>
            )}
          </div>
          {p.note && (
            <div className={styles.notePanel}>
              <h3>Transaction notes</h3>
              <p>{p.note}</p>
            </div>
          )}
          <div className={styles.notePanel}>
            <h3>Transaction metadata</h3>
            <span className={styles.chip}>
              <CategoryIcon label={p.category} icon={p.categoryIcon} />
              {p.category}
            </span>{' '}
            <span className={styles.chip}>
              {p.semanticType === 'split' ? 'Split expense' : p.semanticType}
            </span>
          </div>
        </div>
        <div className={styles.notePanel}>
          <dl className={styles.details}>
            {details.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Related transactions</h2>
            <p className={styles.subtitle}>
              Other transactions from this merchant or in this category.
            </p>
          </div>
          <Button variant="ghost" onPress={p.onBack}>
            View all
          </Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <TransactionTable items={p.relatedTransactions ?? []} onSelect={p.onOpenTransaction} />
        </div>
      </section>
    </main>
  );
}
