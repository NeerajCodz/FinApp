'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { currencies } from '@convex/shared/validators';
import { parseMinor } from '@convex/shared/money';
import { AccountFormScreen, type AccountFormValue } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { SignInGate } from '../../_personal';

type Profile = LocalRecord & { defaultCurrency?: string };
const maxInt64 = 9_223_372_036_854_775_807n;
const initialForm = (currency = ''): AccountFormValue => ({
  name: '',
  type: 'bank',
  customType: '',
  currency,
  openingBalance: '',
  isIncludedInTotal: true,
});

export default function NewPersonalAccountPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: profiles, loading, error: profileError } = useLocalRecords<Profile>('profile');
  const profile = profiles[0];
  const [form, setForm] = React.useState<AccountFormValue>(() => initialForm());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (profile?.defaultCurrency && !form.currency)
      setForm((current) => ({ ...current, currency: profile.defaultCurrency! }));
  }, [profile?.defaultCurrency, form.currency]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    const name = form.name.trim();
    const customType = form.customType.trim();
    if (!name) return setError('Enter an account name.');
    if (form.type === 'other' && !customType) return setError('Name your custom account type.');
    if (!(currencies as readonly string[]).includes(form.currency))
      return setError('Choose a supported currency.');
    if (!form.color) return setError('Choose an account color.');
    setSaving(true);
    setError(null);
    try {
      const openingBalanceMinor = parseMinor(form.openingBalance || '0', form.currency);
      if (openingBalanceMinor < 0n || openingBalanceMinor > maxInt64)
        throw new Error('Enter a valid non-negative opening balance.');
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name,
        type: form.type,
        ...(form.icon ? { icon: form.icon } : {}),
        color: form.color,
        ...(form.type === 'other' ? { customType } : {}),
        currency: form.currency,
        openingBalanceMinor,
        balanceMinor: openingBalanceMinor,
        isIncludedInTotal: form.isIncludedInTotal,
        notes: form.notes?.trim() || undefined,
        includeInAnalytics: form.includeInAnalytics !== false,
        createdAt: now,
        updatedAt: now,
      };
      const id = await commitLocalWrite(userId, 'account', 'account.create', record, {
        name,
        type: form.type,
        ...(form.icon ? { icon: form.icon } : {}),
        color: form.color,
        ...(form.type === 'other' ? { customType } : {}),
        currency: form.currency,
        openingBalanceMinor,
        isIncludedInTotal: form.isIncludedInTotal,
        ...(form.notes?.trim() ? { notes: form.notes.trim() } : {}),
        includeInAnalytics: form.includeInAnalytics !== false,
      });
      router.push(`/account/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this account.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="NEW ACCOUNT" title="Start with an account.">
        Sign in to create a private account record saved to this browser first.
      </SignInGate>
    );
  return (
    <AccountFormScreen
      title="New account"
      subtitle="Add an account to track your money."
      value={form}
      currencies={currencies}
      loading={loading}
      saving={saving}
      error={error ?? (profileError ? `Profile data could not be opened: ${profileError}` : null)}
      onChange={setForm}
      onSubmit={create}
      onBack={() => router.back()}
      submitLabel="Create account"
    />
  );
}
