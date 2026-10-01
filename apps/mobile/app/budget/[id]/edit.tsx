import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BudgetFormScreen } from '@finapp/ui/finance';
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
};
type Category = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  icon?: string;
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
  const currency = budget?.currency ?? 'INR';
  React.useEffect(() => {
    if (!budget || initialized) return;
    setName(budget.name ?? '');
    setAmount(moneyInput(budget.amountMinor, currency));
    setCategoryId(budget.categoryId ?? '');
    setStartDate(dateString(Number(budget.startAt ?? Date.now())));
    setEndDate(dateString(Number(budget.endAt ?? Date.now())));
    setInitialized(true);
  }, [budget, currency, initialized]);
  const category = categories.find(
    (row) => row.id === categoryId || row._id === categoryId || row.cloudId === categoryId,
  );
  const categoryOptions = categories.flatMap((row) => {
    const categoryKey = row._id ?? row.id;
    return categoryKey ? [{ id: categoryKey, name: row.name ?? 'Category', icon: row.icon }] : [];
  });
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
      setPending(true);
      setError(null);
      const budgetId = String(budget._id ?? budget.cloudId ?? budget.id ?? '');
      const categoryKey = String(category._id ?? category.id ?? '');
      if (!budgetId || !categoryKey) throw new Error('Budget or category has no saved identifier.');
      const payload = {
        budgetId,
        name: name.trim(),
        amountMinor,
        currency,
        categoryId: categoryKey,
        startAt,
        endAt,
      };
      const record = { ...budget, ...payload, period: 'category', updatedAt: Date.now() };
      await commitLocalWrite(userId, 'budget', 'budget.update', record, payload, {
        recordId: budget.id ?? budget._id ?? budgetId,
        dependencies: categoryKey.startsWith('local-') ? [`category:${categoryKey}`] : [],
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
      startDate={startDate}
      endDate={endDate}
      loading={!initialized || categoryState.data === undefined}
      pending={pending}
      error={error}
      onNameChange={setName}
      onAmountChange={setAmount}
      onCategoryChange={setCategoryId}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      onSubmit={() => void save()}
      onBack={() => router.back()}
    />
  );
}
