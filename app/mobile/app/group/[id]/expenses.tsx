import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, Plus } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionRow } from '@/components/finance';
import { Button, Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function GroupExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const group = useQuery(api.groups.queries.detail, id ? { groupId: id as never } : 'skip');
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
        <Typography variant="title" style={{ flex: 1 }}>
          Expenses
        </Typography>
        <IconButton
          label="Add group expense"
          variant="ghost"
          onPress={() => router.push(`/group/${id}/expenses/new` as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>
      {group?.expenses && group.expenses.length > 0 ? (
        <View style={{ gap: 8 }}>
          {group.expenses.map((expense) => (
            <TransactionRow
              key={expense._id}
              title={expense.title}
              category="Group expense"
              account={group.name}
              amountMinor={expense.amountMinor}
              currency={expense.currency}
              type="expense"
              date={new Date(expense.occurredAt).toLocaleDateString()}
            />
          ))}
        </View>
      ) : (
        <Empty
          title="No group expenses."
          description="Add the first expense and choose who shared it."
          action={
            <Button size="sm" onPress={() => router.push(`/group/${id}/expenses/new` as never)}>
              Add expense
            </Button>
          }
        />
      )}
    </ScrollView>
  );
}
