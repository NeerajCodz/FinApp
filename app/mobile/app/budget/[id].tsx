import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, IconButton, Progress, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const budget = useQuery(api.budgets.queries.detail, id ? { budgetId: id as never } : 'skip');
  const categories = useQuery(api.categories.queries.list);
  const accounts = useQuery(api.accounts.queries.list);
  const archive = useMutation(api.budgets.mutations.archive);
  const categoryName = budget?.categoryId
    ? categories?.find((item) => item._id === budget.categoryId)?.name
    : undefined;
  const accountName = budget?.accountId
    ? accounts?.find((item) => item.id === budget.accountId)?.name
    : undefined;

  async function archiveBudget() {
    if (!id || pending) return;
    setPending(true);
    setError('');
    try {
      await archive({ budgetId: id as never });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive budget.');
    } finally {
      setPending(false);
    }
  }

  if (budget === undefined)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          padding: 20,
          paddingTop: insets.top + 12,
        }}
      >
        <Text style={{ color: tokens.foregroundMuted }}>Loading budget…</Text>
      </View>
    );
  if (budget === null)
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
        <Typography variant="heading">Budget not found</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          This budget may have been archived or is unavailable.
        </Text>
      </View>
    );

  const percent = Math.max(
    0,
    Math.min(100, Number((budget.spentMinor * 10000n) / budget.amountMinor) / 100),
  );
  const periodLabel =
    budget.period === 'monthly'
      ? 'Monthly'
      : budget.period === 'category'
        ? (categoryName ?? 'Category budget')
        : budget.period === 'account'
          ? (accountName ?? 'Account budget')
          : 'Custom period';
  const range = `${new Date(budget.startAt).toLocaleDateString()} – ${new Date(budget.endAt).toLocaleDateString()}`;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {budget.name}
        </Typography>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={{ color: tokens.foregroundMuted }}>
          {periodLabel} · {range}
        </Text>
        <Money amountMinor={budget.spentMinor} currency={budget.currency} size="display" />
        <Typography variant="caption">
          spent of <Money amountMinor={budget.amountMinor} currency={budget.currency} />
        </Typography>
        <Typography
          variant="heading"
          style={{ color: budget.remainingMinor < 0n ? tokens.destructive : tokens.foreground }}
        >
          {budget.remainingMinor < 0n ? 'Over by ' : 'Remaining '}
          <Money
            amountMinor={
              budget.remainingMinor < 0n ? -budget.remainingMinor : budget.remainingMinor
            }
            currency={budget.currency}
          />
        </Typography>
        <Progress
          value={percent}
          color={percent >= 90 ? tokens.destructive : tokens.primary}
          height={8}
        />
        <Text style={{ color: tokens.foregroundMuted }}>
          {((budget.spentMinor * 100n) / budget.amountMinor).toString()}% used
        </Text>
      </View>
      {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
      <Button variant="outline" disabled={pending} onPress={archiveBudget}>
        {pending ? 'Archiving…' : 'Archive budget'}
      </Button>
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
      <Typography variant="heading">Budget unavailable</Typography>
      <Text>{error.message}</Text>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
