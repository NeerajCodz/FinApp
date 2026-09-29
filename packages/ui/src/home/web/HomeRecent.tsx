import React from 'react';
import { ArrowUpRight as OpenIcon, ReceiptText } from 'lucide-react';
import { TransactionRow } from '@finapp/ui/finance';
import { formatTransactionDate } from '../../finance/datetime';
import type { HomeDashboardData } from '../model';

export function HomeRecent({
  data,
  currency,
  onOpenTransaction,
  onSeeAll,
}: {
  data: HomeDashboardData;
  currency: string;
  onOpenTransaction: (id: string) => void;
  onSeeAll: () => void;
}) {
  return (
    <section className="finance-home-panel finance-home-recent-panel">
      <div className="finance-home-section-heading">
        <div>
          <span className="finance-eyebrow">LATEST ACTIVITY</span>
          <h2>Recent transactions</h2>
        </div>
        <button type="button" onClick={onSeeAll}>
          View all <OpenIcon size={14} aria-hidden="true" />
        </button>
      </div>
      {data.transactions.length ? (
        <div className="finance-home-transaction-list">
          {data.transactions.map((transaction) => (
            <div className="finance-home-transaction" key={transaction.id}>
              <TransactionRow
                title={transaction.title}
                category={transaction.category}
                categoryIcon={transaction.categoryIcon}
                date={formatTransactionDate(
                  transaction.occurredAt,
                  transaction.hasTime,
                  transaction.timeZone,
                )}
                amountMinor={transaction.amountMinor}
                currency={transaction.currency || currency}
                type={
                  transaction.type as 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment'
                }
                semanticType={transaction.groupId ? 'split' : undefined}
                onPress={() => onOpenTransaction(transaction.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="finance-home-empty-block">
          <ReceiptText size={21} aria-hidden="true" />
          <p>No transactions match your filters.</p>
        </div>
      )}
    </section>
  );
}
