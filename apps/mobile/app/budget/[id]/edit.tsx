import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BudgetFormScreen, type BudgetSettings } from '@finapp/ui/finance';
import { Text } from '@finapp/ui/native';
import { parseMinor } from '@/lib/money';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
type Budget = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  period?: string;
  categoryId?: string;
  startAt?: number;
  endAt?: number;
  updatedAt?: number;
  archivedAt?: number;
  icon?: string;
  alertThreshold?: number;
  notes?: string;
  includeInAnalytics?: boolean;
  accountIds?: string[];
};
type Category = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  icon?: string;
  archivedAt?: number;
};
type Account = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  currency?: string;
  archivedAt?: number;
};
function moneyInput(value: unknown, currency: string) {
  const amount =
    typeof value === 'bigint'
      ? value
      : typeof value === 'number'
        ? BigInt(Math.trunc(value))
        : typeof value === 'string' && /^-?\d+$/.test(value)
          ? BigInt(value)
          : 0n;
  const digits =
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(digits);
  const fractional = amount < 0n ? -(amount % scale) : amount % scale;
  return digits
    ? `${amount / scale}.${fractional.toString().padStart(digits, '0')}`
    : String(amount / scale);
}
function dateString(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}
function utcStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
    ? date.getTime()
    : null;
}
export default function EditBudgetScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const { userId } = useLocalSync();
  const budgets = useLocalRecords<Budget>(userId, 'budget');
  const categoryState = useLocalRecords<Category>(userId, 'category');
  const accountState = useLocalRecords<Account>(userId, 'account');
  const budget = budgets.data?.find(
    (row) =>
      row.period === 'category' &&
      !!row.categoryId &&
      row.archivedAt === undefined &&
      (row.id === routeId || row._id === routeId || row.cloudId === routeId),
  );
  const categories = (categoryState.data ?? []).filter((row) => row.archivedAt === undefined);
  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>({});
  const currency = budget?.currency ?? 'INR';
  const accounts = (accountState.data ?? []).filter(
    (row) => row.archivedAt === undefined && row.currency === currency,
  );
  React.useEffect(() => {
    if (!budget || initialized || accountState.data === undefined) return;
    setName(budget.name ?? '');
    setAmount(moneyInput(budget.amountMinor, currency));
    setCategoryId(budget.categoryId ?? '');
    setStartDate(dateString(Number(budget.startAt ?? Date.now())));
    setEndDate(dateString(Number(budget.endAt ?? Date.now())));
    setBudgetSettings({
      icon: budget.icon,
      alertThreshold: budget.alertThreshold ?? 80,
      includeInAnalytics: budget.includeInAnalytics !== false,
      accountIds: (budget.accountIds ?? []).flatMap((id) => {
        const account = accounts.find((row) => [row.id, row._id, row.cloudId].includes(id));
        const accountId = account?._id ?? account?.id;
        return accountId ? [accountId] : [];
      }),
      notes: budget.notes,
    });
    setInitialized(true);
  }, [budget, currency, initialized, accountState.data, accounts]);
  const category = categories.find(
    (row) => row.id === categoryId || row._id === categoryId || row.cloudId === categoryId,
  );
  const categoryOptions = categories.flatMap((row) => {
    const categoryKey = row._id ?? row.id;
    return categoryKey ? [{ id: categoryKey, name: row.name ?? 'Category', icon: row.icon }] : [];
  });
  const selectedAccounts = (budgetSettings.accountIds ?? []).map((id) =>
    accounts.find((account) => [account.id, account._id, account.cloudId].includes(id)),
  );
  async function save() {
    if (!userId || !budget || !category || pending) return;
    try {
      const amountMinor = parseMinor(amount, currency);
      const startAt = utcStart(startDate);
      const endAt = utcStart(endDate);
      if (
        !name.trim() ||
        amountMinor <= 0n ||
        startAt === null ||
        endAt === null ||
        endAt <= startAt
      )
        throw new Error('Enter a name, positive limit, and valid date range.');
      const threshold = budgetSettings.alertThreshold ?? 80;
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)
        throw new Error('Alert threshold must be between 0 and 100%.');
      if (selectedAccounts.some((account) => !account))
        throw new Error('Choose active accounts in this currency.');
      setPending(true);
      setError(null);
      const budgetId = String(budget._id ?? budget.cloudId ?? budget.id ?? '');
      const categoryKey = String(category._id ?? category.id ?? '');
      if (!budgetId || !categoryKey) throw new Error('Budget or category has no saved identifier.');
      const settingsPayload = {
        icon: budgetSettings.icon ?? null,
        alertThreshold: threshold,
        includeInAnalytics: budgetSettings.includeInAnalytics !== false,
        accountIds: selectedAccounts.map((account) => String(account!._id ?? account!.id)),
        notes: budgetSettings.notes?.trim() || null,
      };
      const payload = {
        budgetId,
        name: name.trim(),
        amountMinor,
        currency,
        categoryId: categoryKey,
        startAt,
        endAt,
        ...settingsPayload,
      };
      const record = {
        ...budget,
        ...payload,
        ...settingsPayload,
        period: 'category',
        updatedAt: Date.now(),
      };
      const dependencies = [
        ...(category && !category._id && !category.cloudId ? [`category:${categoryKey}`] : []),
        ...selectedAccounts.flatMap((account) =>
          account && !account._id && !account.cloudId ? [`account:${account.id}`] : [],
        ),
      ];
      await commitLocalWrite(userId, 'budget', 'budget.update', record, payload, {
        recordId: budget.id ?? budget._id ?? budgetId,
        dependencies,
        baseUpdatedAt: typeof budget.updatedAt === 'number' ? budget.updatedAt : undefined,
      });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save budget changes.');
    } finally {
      setPending(false);
    }
  }
  if (budgets.error) throw budgets.error;
  if (categoryState.error) throw categoryState.error;
  if (accountState.error) throw accountState.error;
  if (budgets.loading) return <Text>Loading budget details…</Text>;
  if (!budget)
    return <Text>Budget unavailable. Return to budgets and choose an active category budget.</Text>;
  return (
    <BudgetFormScreen
      mode="edit"
      name={name}
      amount={amount}
      currency={currency}
      categoryId={category?._id ?? category?.id ?? categoryId}
      categories={categoryOptions}
      accounts={accounts.flatMap((account) => {
        const id = account._id ?? account.id;
        return id ? [{ id, name: account.name ?? 'Account' }] : [];
      })}
      settings={budgetSettings}
      onSettingsChange={setBudgetSettings}
      startDate={startDate}
      endDate={endDate}
      loading={!initialized || categoryState.data === undefined || accountState.data === undefined}
      pending={pending}
      error={error}
      onNameChange={setName}
      onAmountChange={setAmount}
      onCategoryChange={setCategoryId}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      onSubmit={() => void save()}
      onAnalytics={() => router.push(`/budget/${encodeURIComponent(routeId)}/analytics` as never)}
      onBack={() => router.back()}
    />
  );
}
