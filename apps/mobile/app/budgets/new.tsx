import { useState } from 'react';
import { View } from 'react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetFormScreen, type BudgetSettings } from '@finapp/ui/finance';
import { parseMinor } from '@/lib/money';
import { Button, IconButton, Text, Typography, useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
type ProfileRecord = LocalRecord & { defaultCurrency?: string };
type SettingsRecord = LocalRecord & { currency?: string; defaultCurrency?: string };
type CategoryRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  icon?: string;
  archivedAt?: number;
};
type AccountRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  currency?: string;
  archivedAt?: number;
};
function utcMonthDate(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 10);
}
function dateAtUtcStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
    ? date.getTime()
    : null;
}
export default function NewBudgetScreen() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState(() => utcMonthDate(0));
  const [endDate, setEndDate] = useState(() => utcMonthDate(1));
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>({
    alertThreshold: 80,
    includeInAnalytics: true,
    accountIds: [],
  });
  const { userId } = useLocalSync();
  const profiles = useLocalRecords<ProfileRecord>(userId, 'profile');
  const settings = useLocalRecords<SettingsRecord>(userId, 'settings');
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const accountsState = useLocalRecords<AccountRecord>(userId, 'account');
  if (profiles.error) throw profiles.error;
  if (settings.error) throw settings.error;
  if (categoryState.error) throw categoryState.error;
  if (accountsState.error) throw accountsState.error;
  const profile = profiles.data?.[0];
  const currency =
    profile?.defaultCurrency ?? settings.data?.[0]?.defaultCurrency ?? settings.data?.[0]?.currency;
  const categories = (categoryState.data ?? []).filter((row) => row.archivedAt === undefined);
  const accounts = (accountsState.data ?? []).filter(
    (account) => account.archivedAt === undefined && account.currency === currency,
  );
  const category = categories.find((row) => row.id === categoryId || row._id === categoryId);
  const loading =
    profiles.data === undefined ||
    settings.data === undefined ||
    categoryState.data === undefined ||
    accountsState.data === undefined;
  async function submit() {
    if (!userId || !category || !currency || pending) return;
    try {
      const amountMinor = parseMinor(amount, currency);
      const startAt = dateAtUtcStart(startDate);
      const endAt = dateAtUtcStart(endDate);
      if (amountMinor <= 0n || startAt === null || endAt === null || endAt <= startAt)
        throw new Error('Enter a positive limit and a valid date range.');
      const threshold = budgetSettings.alertThreshold ?? 80;
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)
        throw new Error('Alert threshold must be between 0 and 100%.');
      const selectedAccounts = (budgetSettings.accountIds ?? []).map((selectedId) =>
        accounts.find((account) => String(account._id ?? account.id ?? '') === selectedId),
      );
      if (selectedAccounts.some((account) => !account))
        throw new Error('Choose active accounts in this currency.');
      const id = category._id ?? category.id;
      if (!id) throw new Error('Choose an available category.');
      setPending(true);
      setFormError(null);
      const now = Date.now();
      const settingsPayload = {
        ...(budgetSettings.icon ? { icon: budgetSettings.icon } : {}),
        alertThreshold: threshold,
        includeInAnalytics: budgetSettings.includeInAnalytics !== false,
        accountIds: selectedAccounts.map((account) => String(account!._id ?? account!.id)),
        ...(budgetSettings.notes?.trim() ? { notes: budgetSettings.notes.trim() } : {}),
      };
      const payload = {
        name: name.trim(),
        amountMinor,
        currency,
        period: 'category',
        categoryId: id,
        startAt,
        endAt,
        ...settingsPayload,
      };
      const record: LocalRecord = {
        ownerId: userId,
        ...payload,
        createdAt: now,
        updatedAt: now,
      };
      const dependencies = [
        ...(category && !category._id && !category.cloudId ? [`category:${id}`] : []),
        ...selectedAccounts.flatMap((account) =>
          account && !account._id && !account.cloudId ? [`account:${account.id}`] : [],
        ),
      ];
      await commitLocalWrite(userId, 'budget', 'budget.create', record, payload, {
        dependencies,
      });
      router.back();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not create budget.');
    } finally {
      setPending(false);
    }
  }
  if (!userId) return <Text>Sign in to create a category budget.</Text>;
  return (
    <BudgetFormScreen
      mode="create"
      name={name}
      amount={amount}
      currency={currency ?? ''}
      categoryId={category?._id ?? category?.id ?? categoryId}
      categories={categories.flatMap((row) => {
        const id = row._id ?? row.id;
        return id ? [{ id, name: row.name ?? 'Category', icon: row.icon }] : [];
      })}
      accounts={(accountsState.data ?? [])
        .filter((account) => account.archivedAt === undefined && account.currency === currency)
        .flatMap((account) => {
          const id = account._id ?? account.id;
          return id ? [{ id, name: account.name ?? 'Account' }] : [];
        })}
      settings={budgetSettings}
      onSettingsChange={setBudgetSettings}
      startDate={startDate}
      endDate={endDate}
      loading={loading}
      pending={pending}
      error={formError}
      onNameChange={setName}
      onAmountChange={setAmount}
      onCategoryChange={setCategoryId}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      onSubmit={() => void submit()}
      onBack={() => router.push('/budgets' as never)}
    />
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
      <IconButton
        label="Go back"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => router.back()}
      >
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Typography variant="heading">Budget form unavailable</Typography>
      <Text>{error.message}</Text>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
