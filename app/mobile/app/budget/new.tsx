import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyInput } from '@/components/finance';
import { Button, IconButton, Input, Label, Tabs, Text, Typography } from '@/components/ui';
import { parseMinor } from '@/lib/money';
import { useTheme } from '@/providers/ThemeProvider';

type Period = 'monthly' | 'category' | 'account' | 'custom';
const periodOptions: { label: string; value: Period }[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Category', value: 'category' },
  { label: 'Account', value: 'account' },
  { label: 'Custom', value: 'custom' },
];
function amountInMinor(value: string, currency: string): bigint | null {
  try {
    const amount = parseMinor(value, currency);
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}
function dateAtStart(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearText, monthText, dayText] = value.split('-');
  if (!yearText || !monthText || !dayText) return null;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.getTime()
    : null;
}

export default function NewBudgetScreen() {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useQuery(api.users.queries.current);
  const accounts = useQuery(api.accounts.queries.list);
  const categories = useQuery(api.categories.queries.list);
  const create = useMutation(api.budgets.mutations.create);
  const selectedAccount =
    period === 'account' ? accounts?.find((account) => account.id === accountId) : undefined;
  const currency = selectedAccount?.currency ?? profile?.defaultCurrency;
  const amountMinor = currency ? amountInMinor(limit, currency) : null;
  const startAt =
    period === 'custom'
      ? dateAtStart(startDate)
      : Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
  const endAt =
    period === 'custom'
      ? dateAtStart(endDate)
      : Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1);
  const categoryOptions = categories ?? [];

  async function save() {
    if (!name.trim() || !ready || pending) return;
    setPending(true);
    setError('');
    try {
      await create({
        name: name.trim(),
        amountMinor,
        currency,
        period,
        categoryId: period === 'category' ? (categoryId as never) : undefined,
        accountId: period === 'account' ? (accountId as never) : undefined,
        startAt,
        endAt,
      });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create budget.');
    } finally {
      setPending(false);
    }
  }

  const ready =
    !!profile &&
    !!currency &&
    !!amountMinor &&
    startAt !== null &&
    endAt !== null &&
    endAt > startAt &&
    (period !== 'category' || (categories !== undefined && !!categoryId)) &&
    (period !== 'account' || !!selectedAccount);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          gap: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="heading">New budget</Typography>
        </View>
        <View style={{ gap: 10 }}>
          <Typography variant="title">Give spending a boundary.</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            Track real expenses against a limit you choose.
          </Text>
        </View>
        <View>
          <Label>Name</Label>
          <Input
            accessibilityLabel="Budget name"
            placeholder="Monthly spending"
            value={name}
            onChangeText={setName}
          />
        </View>
        {currency ? (
          <CurrencyInput currency={currency} value={limit} onChangeText={setLimit} />
        ) : profile === undefined ? (
          <Text style={{ color: tokens.foregroundMuted }}>Loading your default currency…</Text>
        ) : (
          <Button variant="outline" onPress={() => router.push('/settings/currency' as never)}>
            Set your default currency
          </Button>
        )}
        <View style={{ gap: 10 }}>
          <Label>Period</Label>
          <Tabs
            value={period}
            onChange={(value) => setPeriod(value as Period)}
            tabs={periodOptions}
          />
        </View>
        {period === 'category' && (
          <View style={{ gap: 8 }}>
            <Label>Category</Label>
            {categories === undefined ? (
              <Text>Loading categories…</Text>
            ) : categoryOptions.length ? (
              categoryOptions.map((item) => (
                <Button
                  key={item._id}
                  variant={categoryId === item._id ? 'primary' : 'outline'}
                  onPress={() => setCategoryId(item._id)}
                >
                  {item.name}
                </Button>
              ))
            ) : (
              <>
                <Text style={{ color: tokens.foregroundMuted }}>Create a category first.</Text>
                <Button variant="outline" onPress={() => router.push('/category/new' as never)}>
                  Create category
                </Button>
              </>
            )}
          </View>
        )}
        {period === 'account' && (
          <View style={{ gap: 8 }}>
            <Label>Account</Label>
            {accounts === undefined ? (
              <Text>Loading accounts…</Text>
            ) : accounts.length ? (
              accounts.map((item) => (
                <Button
                  key={item.id}
                  variant={accountId === item.id ? 'primary' : 'outline'}
                  onPress={() => setAccountId(item.id)}
                >
                  {item.name} · {item.currency}
                </Button>
              ))
            ) : (
              <>
                <Text style={{ color: tokens.foregroundMuted }}>Create an account first.</Text>
                <Button variant="outline" onPress={() => router.push('/account/new' as never)}>
                  Create account
                </Button>
              </>
            )}
          </View>
        )}
        {period === 'custom' && (
          <View style={{ gap: 12 }}>
            <View>
              <Label>Starts (YYYY-MM-DD)</Label>
              <Input
                accessibilityLabel="Budget start date"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-01-01"
              />
            </View>
            <View>
              <Label>Ends (exclusive, YYYY-MM-DD)</Label>
              <Input
                accessibilityLabel="Budget end date"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-02-01"
              />
            </View>
          </View>
        )}
        {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
        <Button
          size="lg"
          disabled={!name.trim() || !ready || pending || (period === 'account' && !selectedAccount)}
          onPress={save}
        >
          {pending ? 'Saving…' : 'Save budget'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
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
      <Typography variant="heading">Budget form unavailable</Typography>
      <Text>{error.message}</Text>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
