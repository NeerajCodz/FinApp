import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, CaretRight, Plus } from '@/lib/icons';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, Progress, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function BudgetScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const budgets = useQuery(api.budgets.queries.list);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 28,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title" style={{ flex: 1 }}>
          Budgets
        </Typography>
        <IconButton
          label="New budget"
          variant="ghost"
          onPress={() => router.push('/budget/new' as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>
      {budgets === undefined ? (
        <Text style={{ color: tokens.foregroundMuted }}>Loading budgets…</Text>
      ) : budgets.length === 0 ? (
        <Empty
          title="No budgets yet."
          description="Set a spending limit and see real expenses count toward it."
          action={
            <Button size="sm" variant="outline" onPress={() => router.push('/budget/new' as never)}>
              Create budget
            </Button>
          }
        />
      ) : (
        <View style={{ gap: 18 }}>
          {budgets.map((budget, index) => {
            const progress = Number((budget.spentMinor * 10000n) / budget.amountMinor) / 100;
            const percent = Math.min(100, Math.max(0, progress));
            const period =
              budget.period === 'monthly'
                ? 'Monthly'
                : budget.period === 'category'
                  ? 'Category'
                  : budget.period === 'account'
                    ? 'Account'
                    : 'Custom period';
            return (
              <React.Fragment key={budget._id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${budget.name} budget`}
                  onPress={() => router.push(`/budget/${budget._id}` as never)}
                  style={({ pressed }) => ({
                    gap: 11,
                    paddingVertical: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Typography variant="bodyLarge">{budget.name}</Typography>
                      <Text style={{ color: tokens.foregroundMuted }}>{period}</Text>
                    </View>
                    <CaretRight size={18} color={tokens.foregroundSubtle} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Money amountMinor={budget.spentMinor} currency={budget.currency} />
                    <Text style={{ color: tokens.foregroundMuted }}>of</Text>
                    <Money amountMinor={budget.amountMinor} currency={budget.currency} />
                  </View>
                  <Progress
                    value={percent}
                    color={percent >= 90 ? tokens.destructive : tokens.primary}
                  />
                  <Text style={{ color: tokens.foregroundMuted }}>
                    {budget.remainingMinor < 0n ? 'Over by ' : 'Remaining '}
                    {
                      <Money
                        amountMinor={
                          budget.remainingMinor < 0n
                            ? -budget.remainingMinor
                            : budget.remainingMinor
                        }
                        currency={budget.currency}
                      />
                    }
                  </Text>
                </Pressable>
                {index < budgets.length - 1 && <Separator />}
              </React.Fragment>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.background,
        padding: 20,
        paddingTop: insets.top + 12,
        gap: 18,
      }}
    >
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Typography variant="heading">Budgets unavailable</Typography>
      <Text>{error.message}</Text>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
