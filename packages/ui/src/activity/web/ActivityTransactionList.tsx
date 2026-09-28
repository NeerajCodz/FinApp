'use client';

import { ChevronRight } from 'lucide-react';
import { Card, Empty, Typography } from '@finapp/ui/web';
import { CategoryIcon } from '@finapp/ui/finance';

export type ActivityTransactionItem = {
  id: string;
  title: string;
  category: string;
  categoryIcon?: string;
  account?: string;
  date: string;
  dateTime?: string;
  amount: string;
  amountSign: string;
  type: string;
};

export function ActivityTransactionList({
  items,
  loading,
  query,
  onSelect,
}: {
  items: readonly ActivityTransactionItem[];
  loading: boolean;
  query: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="activity-transactions">
      <div className="activity-section-heading">
        <div><Typography variant="bodyLarge">Transactions</Typography><Typography variant="caption">Your latest activity</Typography></div>
        <Typography variant="caption">{items.length} records</Typography>
      </div>
      {loading ? <Typography variant="small">Loading activity…</Typography> : items.length === 0 ? (
        <Empty title={query ? 'No search matches' : 'No activity in this period'} description={query ? 'Try another merchant, title, category, account, or amount.' : 'Transactions matching this date range and filters will appear here.'} />
      ) : items.map((item) => <button key={item.id} type="button" className={`activity-transaction-row ${item.type}`} onClick={() => onSelect(item.id)}>
        <span className="activity-transaction-icon"><CategoryIcon label={item.category} icon={item.categoryIcon} /></span>
        <span className="activity-transaction-copy">
          <span className="activity-transaction-title">{item.title}</span>
          <span className="activity-transaction-meta">{item.category}{item.account ? ` · ${item.account}` : ''}</span>
        </span>
        <time className="activity-transaction-date" dateTime={item.dateTime}>{item.date}</time>
        <span className="activity-transaction-amount">{item.amountSign}{item.amount}</span>
        <ChevronRight className="activity-transaction-chevron" size={16} aria-hidden="true" />
      </button>)}
    </Card>
  );
}
