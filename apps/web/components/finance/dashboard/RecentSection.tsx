import React from 'react';
import { ReceiptText } from 'lucide-react';
import { Button, SectionHeader, Typography, useTheme } from '@finapp/ui/web';
import { TransactionRow, type SemanticType, type TransactionType } from '@finapp/ui/finance';

export type DashboardTransaction = {
  id: string;
  title: string;
  category?: string;
  categoryIcon?: string;
  amountMinor: bigint;
  currency: string;
  type: TransactionType;
  semanticType?: SemanticType;
  date: string;
};

export function RecentSection({
  transactions,
  loading,
  onSeeAll,
  onOpen,
  onCreate,
}: {
  transactions: readonly DashboardTransaction[];
  loading: boolean;
  onSeeAll: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <SectionHeader
        title="Recent"
        action={
          <Button variant="ghost" size="sm" onPress={onSeeAll}>
            All
          </Button>
        }
      />
      {loading ? (
        <Typography variant="small">Loading activity…</Typography>
      ) : transactions.length ? (
        transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            title={transaction.title}
            category={transaction.category}
            categoryIcon={transaction.categoryIcon}
            amountMinor={transaction.amountMinor}
            currency={transaction.currency}
            type={transaction.type}
            semanticType={transaction.semanticType}
            date={transaction.date}
            onPress={() => onOpen(transaction.id)}
          />
        ))
      ) : (
        <div
          style={{
            display: 'grid',
            justifyItems: 'center',
            justifyContent: 'center',
            paddingBlock: 18,
            gap: 8,
          }}
        >
          <ReceiptText size={22} color={tokens.foregroundMuted} strokeWidth={1.8} />
          <Typography variant="bodyLarge">No transactions yet</Typography>
          <Typography variant="small" style={{ maxWidth: 290, textAlign: 'center' }}>
            Record an expense or income to start your ledger.
          </Typography>
          <Button size="sm" variant="outline" onPress={onCreate}>
            Add transaction
          </Button>
        </div>
      )}
    </section>
  );
}
