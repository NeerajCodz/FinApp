import React from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowUpRight as OpenIcon, ReceiptText } from 'lucide-react';
import { formatMinor } from '@convex/shared/money';
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
          {data.transactions.map((transaction) => {
            const positive = transaction.type === 'income' || transaction.type === 'refund';
            const Icon = positive ? ArrowUpRight : ArrowDownRight;
            return (
              <button
                className="finance-home-transaction"
                key={transaction.id}
                type="button"
                onClick={() => onOpenTransaction(transaction.id)}
              >
                <span className="finance-home-transaction-icon">
                  {transaction.categoryIcon ? (
                    <span aria-hidden="true">{transaction.categoryIcon}</span>
                  ) : (
                    <ReceiptText size={17} aria-hidden="true" />
                  )}
                </span>
                <span className="finance-home-transaction-main">
                  <strong>{transaction.title}</strong>
                  <small>
                    {transaction.category ?? 'Uncategorized'} ·{' '}
                    {new Date(transaction.occurredAt).toLocaleDateString()}
                  </small>
                </span>
                <span className={positive ? 'finance-home-amount positive' : 'finance-home-amount'}>
                  <Icon size={14} aria-hidden="true" />
                  {formatMinor(transaction.amountMinor, transaction.currency || currency)}
                </span>
              </button>
            );
          })}
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
