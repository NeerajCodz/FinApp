import React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { Button, Input, Text, Typography, useTheme } from '@finapp/ui/native';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';
import type { TransactionsScreenProps, TransactionTableItem } from '../web/TransactionsScreen';
import { compareTransactionAmounts } from '../transactionComparison';
export type { TransactionsScreenProps, TransactionTableItem } from '../web/TransactionsScreen';
export function TransactionCards({
  items,
  onSelect,
}: {
  items: readonly TransactionTableItem[];
  onSelect?: (id: string) => void;
}) {
  const { tokens } = useTheme();
  return items.length ? (
    <View style={{ gap: 0 }}>
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          accessibilityRole={onSelect ? 'button' : undefined}
          onPress={() => onSelect?.(item.id)}
          style={({ pressed }) => ({
            paddingVertical: 13,
            borderBottomWidth: index === items.length - 1 ? 0 : 1,
            borderColor: tokens.borderSubtle,
            opacity: pressed ? 0.7 : 1,
            gap: 7,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CategoryIcon label={item.category} icon={item.categoryIcon} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontWeight: '600' }}>{item.title}</Text>
              {(item.note || item.merchant) && (
                <Typography variant="caption">{item.note || item.merchant}</Typography>
              )}
            </View>
            <Money amountMinor={item.amountMinor} currency={item.currency} type={item.type} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 42 }}>
            <Typography variant="caption">{item.date}</Typography>
            <Typography variant="caption">{item.account ?? 'Unassigned account'}</Typography>
          </View>
        </Pressable>
      ))}
    </View>
  ) : (
    <FinanceEmptyState
      kind="transaction"
      title="Your transaction history starts here."
      description="Add a transaction to keep spending and income organized."
      compact
    />
  );
}
export function TransactionsScreen(p: TransactionsScreenProps) {
  const { tokens } = useTheme();
  const [filters, setFilters] = React.useState(false);
  const panel = {
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
    borderRadius: 12,
    backgroundColor: tokens.surfaceRaised,
    padding: 16,
  };
  const average = p.expenseCount ? p.totalExpense / BigInt(p.expenseCount) : 0n;
  const previousAverage =
    p.previousExpenseCount && p.previousExpenseCount > 0
      ? p.previousTotalExpense! / BigInt(p.previousExpenseCount)
      : undefined;
  const metrics = [
    {
      label: 'Total spending',
      value: <Money amountMinor={p.totalExpense} currency={p.currency} />,
      comparison: compareTransactionAmounts(p.totalExpense, p.previousTotalExpense, true),
      fallback: p.currency,
    },
    {
      label: 'Total income',
      value: <Money amountMinor={p.totalIncome} currency={p.currency} />,
      comparison: compareTransactionAmounts(p.totalIncome, p.previousTotalIncome, false),
      fallback: p.currency,
    },
    {
      label: 'Transactions',
      value: p.transactionCount,
      comparison: null,
      fallback: `${p.expenseCount} expenses · ${p.incomeCount} income`,
    },
    {
      label: 'Average expense',
      value: <Money amountMinor={average} currency={p.currency} />,
      comparison: compareTransactionAmounts(average, previousAverage, true),
      fallback: `${p.currency} expenses`,
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 36 }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Typography variant="title">Transactions</Typography>
        <Typography variant="caption">All your transactions in one place.</Typography>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Input
            accessibilityLabel="Search transactions"
            placeholder="Search transactions…"
            value={p.query}
            onChangeText={p.onQueryChange}
          />
        </View>
        <Button size="sm" variant="outline" onPress={() => setFilters(!filters)}>
          Filters
        </Button>
      </View>
      <Input
        accessibilityLabel="Transaction month YYYY-MM"
        placeholder="YYYY-MM"
        value={p.month}
        onChangeText={(value) => {
          if (/^\d{4}-\d{2}$/.test(value)) p.onMonthChange(value);
        }}
      />
      {filters && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['all', 'expense', 'income', 'transfer', 'refund', 'adjustment'].map((type) => (
            <Button
              size="sm"
              key={type}
              variant={type === p.typeFilter ? 'primary' : 'outline'}
              onPress={() => p.onTypeFilterChange(type)}
            >
              {type[0]!.toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {metrics.map((metric) => (
          <View key={metric.label} style={{ ...panel, width: '48%', gap: 7 }}>
            <Typography variant="caption">{metric.label}</Typography>
            <Text style={{ fontSize: 24, fontWeight: '600' }}>{metric.value}</Text>
            <Typography
              variant="caption"
              style={{
                color:
                  metric.comparison?.tone === 'positive'
                    ? tokens.income
                    : metric.comparison?.tone === 'negative'
                      ? tokens.expense
                      : tokens.foregroundMuted,
              }}
            >
              {metric.comparison?.label ?? metric.fallback}
            </Typography>
          </View>
        ))}
      </View>
      {p.error && (
        <Text accessibilityRole="alert" style={{ color: tokens.expense }}>
          {p.error}
        </Text>
      )}
      {p.rangeError && <Typography variant="caption">{p.rangeError}</Typography>}
      <View style={panel}>
        {p.loading ? (
          <Typography variant="caption">Loading transactions…</Typography>
        ) : p.error || p.rangeError ? null : p.items.length === 0 ? (
          <FinanceEmptyState
            kind={p.query ? 'search' : 'transaction'}
            title={p.query ? 'No matching transactions.' : 'No transactions in this period.'}
            description={
              p.query
                ? 'Try another search or adjust the selected month and filters.'
                : 'Transactions matching this month and filter will appear here.'
            }
            compact
          />
        ) : (
          <TransactionCards items={p.items} onSelect={p.onSelect} />
        )}
      </View>
      <Button onPress={p.onCreate}>Add transaction</Button>
    </ScrollView>
  );
}
