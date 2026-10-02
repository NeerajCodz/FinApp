'use client';

import { Card, Typography } from '@finapp/ui/web';
import { TransactionRow, type TransactionType } from '@finapp/ui/finance';
import { FinanceEmptyState } from '../../finance/web/FinanceEmptyState';

export type ActivityTransactionItem = {
  id: string;
  title: string;
  category: string;
  categoryIcon?: string;
  account?: string;
  merchant?: string;
  date: string;
  amountMinor: bigint;
  currency: string;
  type: TransactionType;
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
        <div>
          <Typography variant="bodyLarge">Transactions</Typography>
          <Typography variant="caption">Your latest activity</Typography>
        </div>
        <Typography variant="caption">{items.length} records</Typography>
      </div>
      {loading ? (
        <Typography variant="small">Loading activity…</Typography>
      ) : items.length === 0 ? (
        <FinanceEmptyState
          kind={query ? 'search' : 'activity'}
          compact
          title={query ? 'No search matches' : 'No activity in this period'}
          description={
            query
              ? 'Try another merchant, title, category, account, or amount.'
              : 'Transactions matching this date range and filters will appear here.'
          }
        />
      ) : (
        items.map((item) => (
          <div className={`activity-transaction-row ${item.type}`} key={item.id}>
            <TransactionRow
              title={item.title}
              category={item.category}
              categoryIcon={item.categoryIcon}
              merchant={item.merchant}
              account={item.account}
              date={item.date}
              amountMinor={item.amountMinor}
              currency={item.currency}
              type={item.type}
              onPress={() => onSelect(item.id)}
            />
          </div>
        ))
      )}
    </Card>
  );
}
