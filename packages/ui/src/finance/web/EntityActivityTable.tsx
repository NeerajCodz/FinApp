'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import styles from './EntityActivityTable.module.css';

export type EntityActivity = {
  id: string; title: string; merchant?: string; category?: string; categoryIcon?: string;
  account?: string; date: string; amountMinor: bigint; currency: string; type: string;
};

export function EntityActivityTable({ rows, onOpen, showCategory = true, showAccount = true }: {
  rows: readonly EntityActivity[]; onOpen?: (id: string) => void; showCategory?: boolean; showAccount?: boolean;
}) {
  return <div className={styles.wrap}><table className={styles.table}>
    <thead><tr><th>#</th><th>Description</th>{showCategory && <th>Category</th>}{showAccount && <th>Account</th>}<th>Date</th><th className={styles.amount}>Amount</th><th /></tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.id}>
      <td className={styles.number}>{index + 1}</td>
      <td><button className={styles.description} type="button" onClick={() => onOpen?.(row.id)} disabled={!onOpen}>
        <CategoryIcon label={row.category ?? row.title} icon={row.categoryIcon} /><span><strong>{row.title}</strong>{row.merchant && row.merchant !== row.title && <small>{row.merchant}</small>}</span>
      </button></td>
      {showCategory && <td>{row.category ?? '—'}</td>}{showAccount && <td>{row.account ?? '—'}</td>}
      <td className={styles.date}>{row.date}</td><td className={`${styles.amount} ${row.type === 'income' || row.type === 'refund' ? styles.income : styles.expense}`}>{row.type === 'income' || row.type === 'refund' ? '+' : row.type === 'expense' ? '−' : ''}{formatMinor(row.amountMinor, row.currency)}</td>
      <td>{onOpen && <button type="button" className={styles.open} onClick={() => onOpen(row.id)} aria-label={`Open ${row.title}`}><ChevronRight size={16} /></button>}</td>
    </tr>)}</tbody>
  </table></div>;
}
