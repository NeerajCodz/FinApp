'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { BudgetFormScreen } from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { belongsToUser, dateAtUtcStart, idOf, localDependency, SignInGate } from '../../_personal';
type Profile = LocalRecord & { defaultCurrency?: string };
type Settings = LocalRecord & { currency?: string; defaultCurrency?: string };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
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
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [startDate, setStartDate] = React.useState(() => monthDate(0));
  const [endDate, setEndDate] = React.useState(() => monthDate(1));
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const categories = categoryState.records.filter(
    (row) => !!userId && belongsToUser(row, userId) && row.archivedAt === undefined,
  );
  const category = categories.find((row) => idOf(row) === categoryId);
  const profile = profiles.records[0];
  const currency =
    profile?.defaultCurrency ??
    settings.records[0]?.defaultCurrency ??
    settings.records[0]?.currency;
  const loading = profiles.loading || settings.loading || categoryState.loading;
  const error = profiles.error ?? settings.error ?? categoryState.error;
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
      setPending(true);
      setFormError(null);
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: name.trim(),
        amountMinor,
        currency,
        period: 'category',
        categoryId: idOf(category),
        startAt,
        endAt,
        createdAt: now,
        updatedAt: now,
      };
      const payload = {
        name: name.trim(),
        amountMinor,
        currency,
        period: 'category',
        categoryId: idOf(category),
        startAt,
        endAt,
      };
      const dependency = localDependency('category', category);
      const id = await commitLocalWrite(userId, 'budget', 'budget.create', record, payload, {
        dependencies: dependency ? [dependency] : [],
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
