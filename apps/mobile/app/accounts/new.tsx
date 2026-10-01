import React, { useState } from 'react';
import { router } from 'expo-router';
import { currencies } from '@convex/shared/validators';
import { parseMinor } from '@/lib/money';
import { AccountFormScreen, type AccountFormValue } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type ProfileRecord = LocalRecord & { defaultCurrency?: string };
const maxInt64 = 9_223_372_036_854_775_807n;
export default function NewAccountScreen() {
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const profile = profileState.data?.[0];
  const [form, setForm] = useState<AccountFormValue>({
    name: '',
    type: 'bank',
    customType: '',
    currency: '',
    openingBalance: '',
    isIncludedInTotal: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  React.useEffect(() => {
    if (profile?.defaultCurrency && !form.currency)
      setForm((current) => ({ ...current, currency: profile.defaultCurrency! }));
  }, [profile?.defaultCurrency, form.currency]);
  async function save() {
    const name = form.name.trim();
    const customType = form.customType.trim();
    if (!userId || saving) return;
    if (!name) return setError('Enter an account name.');
    if (form.type === 'other' && !customType) return setError('Name your custom account type.');
    if (!(currencies as readonly string[]).includes(form.currency))
      return setError('Choose a supported currency.');
    if (!form.color) return setError('Choose an account color.');
    setSaving(true);
    setError('');
    try {
      const openingBalanceMinor = parseMinor(form.openingBalance || '0', form.currency);
      if (openingBalanceMinor < 0n || openingBalanceMinor > maxInt64)
        throw new Error('Enter a valid non-negative opening balance.');
      const now = Date.now();
      await commitLocalWrite(
        userId,
        'account',
        'account.create',
        {
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
          createdAt: now,
          updatedAt: now,
        },
        {
          name,
          type: form.type,
          ...(form.icon ? { icon: form.icon } : {}),
          color: form.color,
          ...(form.type === 'other' ? { customType } : {}),
          currency: form.currency,
          openingBalanceMinor,
          isIncludedInTotal: form.isIncludedInTotal,
        },
      );
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create account.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <AccountFormScreen
      title="New account"
      subtitle="Add an account to track your money."
      value={form}
      currencies={currencies}
      saving={saving}
      disabled={!userId}
      error={
        error ||
        profileState.error?.message ||
        (!userId ? 'Sign in to create an account.' : undefined)
      }
      onChange={setForm}
      onSubmit={save}
      onBack={() => router.back()}
      submitLabel="Create account"
    />
  );
}
