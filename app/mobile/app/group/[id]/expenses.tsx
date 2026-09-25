import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Plus, ReceiptText } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useLocalGroupRange, useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionRow } from '@/components/finance';
import { Button, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function GroupExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchGroupRange } = useLocalSync();
  const { data: groups } = useLocalRecords<Record<string, unknown>>(userId, 'group');
  const startAt = React.useMemo(() => Date.now() - 90 * 24 * 60 * 60 * 1000, []);
  const endAt = React.useMemo(() => Date.now() + 1, []);
  const group = groups?.find((record) => String(record.id ?? record._id) === id);
  const { transactions } = useLocalGroupRange<Record<string, unknown>>(
    userId,
    id ?? null,
    startAt,
    endAt,
    fetchGroupRange,
  );
  const expenses = transactions?.filter((record) => String(record.groupId) === id) ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 180,
        gap: 28,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title" style={{ flex: 1 }}>Expenses</Typography>
        <IconButton label="Add group expense" variant="ghost" onPress={() => router.push(`/group/${id}/expenses/new` as never)}>
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>
      {expenses.length > 0 ? (
        <View style={{ gap: 8 }}>
          {expenses.map((expense) => (
            <TransactionRow
              key={String(expense.id ?? expense._id ?? '')}
              title={String(expense.title ?? 'Group expense')}
              category="Group expense"
              account={String(group?.name ?? 'Group')}
              amountMinor={expense.amountMinor as bigint}
              currency={String(expense.currency ?? group?.currency ?? 'INR')}
              type="expense"
              semanticType="split"
              date={new Date(Number(expense.occurredAt ?? Date.now())).toLocaleDateString()}
            />
          ))}
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
          <ReceiptText size={28} color={tokens.foregroundMuted} />
          <Typography variant="bodyLarge">No group expenses</Typography>
          <Typography variant="small" style={{ textAlign: 'center' }}>
            Add the first expense and choose who shared it.
          </Typography>
          <Button size="sm" variant="outline" onPress={() => router.push(`/group/${id}/expenses/new` as never)}>
            Add expense
          </Button>
        </View>
      )}
    </ScrollView>
  );
}
