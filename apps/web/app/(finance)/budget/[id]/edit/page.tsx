'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BudgetFormScreen, type BudgetSettings } from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { belongsToUser, idOf, matchesId, localDependency, SignInGate } from '../../../_personal';
const amountInput = (minorAmount: unknown, currency: string) => {
  const digitsRegex = /^-?\d+$/;
  const value =
    typeof minorAmount === 'bigint'
      ? minorAmount
      : typeof minorAmount === 'number'
        ? BigInt(Math.trunc(minorAmount))
        : typeof minorAmount === 'string' && digitsRegex.test(minorAmount)
          ? BigInt(minorAmount)
          : 0n;
  const digits = new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  const scale = 10n ** BigInt(digits ?? 2);
  const whole = value / scale;
  const fraction = value < 0n ? -(value % scale) : value % scale;
  return digits ? `${whole}.${fraction.toString().padStart(digits, '0')}` : String(whole);
};
type Budget = LocalRecord & {
  name?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  period?: string;
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
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Account = LocalRecord & {
  name?: string;
  currency?: string;
  archivedAt?: number;
};
const toDate = (value: number) => new Date(value).toISOString().slice(0, 10);
const atUtcStart = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const at = Date.UTC(y!, m! - 1, d!);
  const date = new Date(at);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
    ? at
    : null;
};
export default function EditBudgetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
  const budgetsState = useLocalRecords<Budget>('budget');
  const categoriesState = useLocalRecords<Category>('category');
  const accountsState = useLocalRecords<Account>('account');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const budget = budgetsState.records.find(
    (item) =>
      !!userId &&
      belongsToUser(item, userId) &&
      matchesId(item, routeId) &&
      item.period === 'category' &&
      !!item.categoryId &&
      item.archivedAt === undefined,
  );
  const categories = categoriesState.records.filter(
    (item) => !!userId && belongsToUser(item, userId) && item.archivedAt === undefined,
  );
  const currency = budget?.currency ?? 'INR';
  const accounts = accountsState.records.filter(
    (item) =>
      !!userId &&
      belongsToUser(item, userId) &&
      item.archivedAt === undefined &&
      item.currency === currency,
  );
  const aliases = (row: LocalRecord) =>
    [row.id, row._id, row.cloudId].filter((value): value is string => typeof value === 'string');
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [initialized, setInitialized] = React.useState(false);
  const [budgetSettings, setBudgetSettings] = React.useState<BudgetSettings>({});
  React.useEffect(() => {
    if (!budget || initialized) return;
    setName(budget.name ?? '');
    setAmount(amountInput(budget.amountMinor, currency));
    setCategoryId(budget.categoryId ?? '');
    setStartDate(toDate(Number(budget.startAt ?? Date.now())));
    setEndDate(toDate(Number(budget.endAt ?? Date.now())));
    setBudgetSettings({
      icon: budget.icon,
      alertThreshold: budget.alertThreshold ?? 80,
      includeInAnalytics: budget.includeInAnalytics !== false,
      accountIds: budget.accountIds ?? [],
      notes: budget.notes,
    });
    setInitialized(true);
  }, [budget, currency, initialized]);
  const category = categories.find((item) => aliases(item).includes(categoryId));
  const categoryOptions = categories.map((item) => ({
    id: idOf(item),
    name: item.name ?? 'Category',
    icon: item.icon,
  }));
  const selectedAccounts = (budgetSettings.accountIds ?? []).map((id) =>
    accounts.find((account) => aliases(account).includes(id)),
  );
  async function save() {
    if (!userId || !budget || pending || !category) return;
    try {
      const currency = budget.currency ?? 'INR';
      const amountMinor = parseMinor(amount, currency);
      const startAt = atUtcStart(startDate);
      const endAt = atUtcStart(endDate);
      if (
        !name.trim() ||
        amountMinor <= 0n ||
        startAt === null ||
        endAt === null ||
        endAt <= startAt
      )
        throw new Error('Enter a name, positive limit, and valid date range.');
      if (selectedAccounts.some((account) => !account))
        throw new Error('Choose active accounts in this currency.');
      setPending(true);
      setFormError(null);
      const id = String(budget._id ?? budget.cloudId ?? budget.id ?? '');
      if (!id) throw new Error('This budget has no saved identifier.');
      const settingsPayload = {
        icon: budgetSettings.icon ?? null,
        alertThreshold: budgetSettings.alertThreshold ?? 80,
        includeInAnalytics: budgetSettings.includeInAnalytics !== false,
        accountIds: selectedAccounts.map((account) => idOf(account!)),
        notes: budgetSettings.notes?.trim() || null,
      };
      const payload = {
        budgetId: id,
        name: name.trim(),
        amountMinor,
        currency,
        categoryId: idOf(category),
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
        localDependency('category', category),
        ...selectedAccounts.map((account) =>
          account ? localDependency('account', account) : undefined,
        ),
      ].filter((dependency): dependency is string => !!dependency);
      await commitLocalWrite(userId, 'budget', 'budget.update', record, payload, {
        recordId: id,
        dependencies,
        baseUpdatedAt: typeof budget.updatedAt === 'number' ? budget.updatedAt : undefined,
      });
      router.push(`/budget/${encodeURIComponent(routeId)}`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this budget.');
    } finally {
      setPending(false);
    }
  }
  if (!userId)
    return (
      <SignInGate eyebrow="BUDGET" title="Your budget stays private.">
        Sign in to edit this category budget.
      </SignInGate>
    );
  if (budgetsState.loading || categoriesState.loading || accountsState.loading)
    return <p role="status">Loading budget details…</p>;
  if (budgetsState.error || categoriesState.error || accountsState.error)
    return (
      <p role="alert">
        Budget details could not be opened:{' '}
        {String(budgetsState.error ?? categoriesState.error ?? accountsState.error)}
      </p>
    );
  if (!budget)
    return (
      <p role="alert">
        Budget unavailable. Return to budgets and choose an active category budget.
      </p>
    );
  return (
    <BudgetFormScreen
      mode="edit"
      name={name}
      amount={amount}
      currency={budget.currency ?? 'INR'}
      categoryId={category ? idOf(category) : categoryId}
      categories={categoryOptions}
      accounts={accounts.map((item) => ({ id: idOf(item), name: item.name ?? 'Account' }))}
      settings={budgetSettings}
      onSettingsChange={setBudgetSettings}
      startDate={startDate}
      endDate={endDate}
      loading={!initialized}
      pending={pending}
      error={formError}
      onNameChange={setName}
      onAmountChange={setAmount}
      onCategoryChange={setCategoryId}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      onSubmit={() => void save()}
      onAnalytics={() => router.push(`/budget/${encodeURIComponent(routeId)}/analytics`)}
      onBack={() => router.push(`/budget/${encodeURIComponent(routeId)}`)}
    />
  );
}
