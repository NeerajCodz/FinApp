'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { BudgetFormScreen, type BudgetSettings } from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { belongsToUser, dateAtUtcStart, idOf, localDependency, SignInGate } from '../../_personal';
type Profile = LocalRecord & { defaultCurrency?: string };
type Settings = LocalRecord & { currency?: string; defaultCurrency?: string };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
function monthDate(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 10);
}
export default function NewPersonalBudgetPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const profiles = useLocalRecords<Profile>('profile');
  const settings = useLocalRecords<Settings>('settings');
  const categoryState = useLocalRecords<Category>('category');
  const accountState = useLocalRecords<Account>('account');
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [startDate, setStartDate] = React.useState(() => monthDate(0));
  const [endDate, setEndDate] = React.useState(() => monthDate(1));
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [budgetSettings, setBudgetSettings] = React.useState<BudgetSettings>({
    alertThreshold: 80,
    includeInAnalytics: true,
    accountIds: [],
  });
  const profile = profiles.records[0];
  const currency =
    profile?.defaultCurrency ??
    settings.records[0]?.defaultCurrency ??
    settings.records[0]?.currency;
  const loading =
    profiles.loading || settings.loading || categoryState.loading || accountState.loading;
  const error = profiles.error ?? settings.error ?? categoryState.error ?? accountState.error;
  const categories = categoryState.records.filter(
    (row) => !!userId && belongsToUser(row, userId) && row.archivedAt === undefined,
  );
  const accounts = accountState.records.filter(
    (row) =>
      !!userId &&
      belongsToUser(row, userId) &&
      row.archivedAt === undefined &&
      row.currency === currency,
  );
  const category = categories.find((row) => idOf(row) === categoryId);
  async function submit() {
    if (!userId || pending || !category || !currency) return;
    try {
      const amountMinor = parseMinor(amount, currency);
      const startAt = dateAtUtcStart(startDate);
      const endAt = dateAtUtcStart(endDate);
      if (
        amountMinor <= 0n ||
        amountMinor > 9_223_372_036_854_775_807n ||
        startAt === null ||
        endAt === null ||
        endAt <= startAt
      )
        throw new Error('Enter a positive limit and a valid start/end date range.');
      const selectedAccounts = (budgetSettings.accountIds ?? []).map((id) =>
        accounts.find((account) => idOf(account) === id),
      );
      if (selectedAccounts.some((account) => !account))
        throw new Error('Choose active accounts in this currency.');
      setPending(true);
      setFormError(null);
      const now = Date.now();
      const categoryId = idOf(category);
      const settingsPayload = {
        ...(budgetSettings.icon ? { icon: budgetSettings.icon } : {}),
        alertThreshold: budgetSettings.alertThreshold ?? 80,
        includeInAnalytics: budgetSettings.includeInAnalytics !== false,
        accountIds: selectedAccounts.map((account) => idOf(account!)),
        ...(budgetSettings.notes?.trim() ? { notes: budgetSettings.notes.trim() } : {}),
      };
      const payload = {
        name: name.trim(),
        amountMinor,
        currency,
        period: 'category',
        categoryId,
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
        localDependency('category', category),
        ...selectedAccounts.map((account) =>
          account ? localDependency('account', account) : undefined,
        ),
      ].filter((dependency): dependency is string => !!dependency);
      const id = await commitLocalWrite(userId, 'budget', 'budget.create', record, payload, {
        dependencies,
      });
      router.push(`/budget/${encodeURIComponent(id)}`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not create this budget.');
    } finally {
      setPending(false);
    }
  }
  if (!userId)
    return (
      <SignInGate eyebrow="NEW BUDGET" title="Give spending a boundary.">
        Sign in to save a category budget to your private finance data.
      </SignInGate>
    );
  if (error) return <p role="alert">Budget options could not be opened: {String(error)}</p>;
  return (
    <BudgetFormScreen
      mode="create"
      name={name}
      amount={amount}
      currency={currency ?? ''}
      categoryId={categoryId}
      categories={categories.map((row) => ({
        id: idOf(row),
        name: row.name ?? 'Category',
        icon: row.icon,
      }))}
      accounts={accounts.map((row) => ({ id: idOf(row), name: row.name ?? 'Account' }))}
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
      onBack={() => router.push('/budgets')}
    />
  );
}
