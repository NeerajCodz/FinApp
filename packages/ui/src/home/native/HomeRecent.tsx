import React from 'react';
import { View } from 'react-native';
import { Button, Card, SectionHeader, Typography } from '@finapp/ui/native';
import { TransactionRow } from '@finapp/ui/finance';
import type { HomeDashboardData } from '../model';

export function HomeRecent({
  data,
  onOpenTransaction,
  onSeeAll,
}: {
  data: HomeDashboardData;
  onOpenTransaction: (id: string) => void;
  onSeeAll: () => void;
}) {
  return (
    <Card style={{ gap: 4 }}>
      <SectionHeader
        title="Recent transactions"
        action={
          <Button variant="ghost" size="sm" onPress={onSeeAll}>
            View all
          </Button>
        }
      />
      {data.transactions.length ? (
        data.transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            title={transaction.title}
            category={transaction.category}
            categoryIcon={transaction.categoryIcon}
            amountMinor={transaction.amountMinor}
            currency={transaction.currency}
            type={transaction.type as 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment'}
            semanticType={transaction.groupId ? 'split' : undefined}
            date={new Date(transaction.occurredAt).toLocaleDateString()}
            status={transaction.status === 'pending' ? 'Pending' : undefined}
            onPress={() => onOpenTransaction(transaction.id)}
          />
        ))
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Typography variant="small">No transactions match your filters.</Typography>
        </View>
      )}
    </Card>
  );
}
