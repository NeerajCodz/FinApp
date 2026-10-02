import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { currencies } from '@convex/shared/validators';
import { parseMinor } from '@/lib/money';
import { AccountFormScreen, deriveFormActivity, type AccountFormValue } from '@finapp/ui/finance';
import { Button, Typography } from '@finapp/ui/native';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type AccountRecord = LocalRecord & {
  ownerId?: string;
  name?: string;
  type?: AccountFormValue['type'];
  customType?: string;
  currency?: string;
  openingBalanceMinor?: bigint;
  icon?: string;
  color?: string;
  isIncludedInTotal?: boolean;
  notes?: string;
  provider?: string;
  accountNumber?: string;
  openedAt?: number;
  includeInAnalytics?: boolean;
  createdAt?: number;
  updatedAt?: number;
  archivedAt?: number;
  cloudId?: string;
};
const maxInt64 = 9_223_372_036_854_775_807n;
function decimalAmount(minor: bigint | undefined, currency: string): string {
  if (minor === undefined || !currency) return '';
  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(digits);
  const whole = minor / scale;
  const fraction = (minor % scale).toString().padStart(digits, '0');
  return digits ? `${whole}.${fraction}` : String(whole);
}
export default function EditAccountScreen() {
  const { id: paramId } = useLocalSearchParams<{ id: string }>();
  const routeId = Array.isArray(paramId) ? paramId[0] : paramId;
  const { userId } = useLocalSync();
  const { data: accounts, loading, error } = useLocalRecords<AccountRecord>(userId, 'account');
  const { data: transactions = [] } = useLocalRecords<LocalRecord>(userId, 'transaction');
  const { data: categories = [] } = useLocalRecords<LocalRecord>(userId, 'category');
  const { data: profiles = [] } = useLocalRecords<LocalRecord>(userId, 'profile');
  const profile = profiles.find(
    (record) => record.ownerId === undefined || record.ownerId === userId,
  );
  const [primaryDraft, setPrimaryDraft] = useState<boolean>();
  const account = accounts?.find(
    (item) =>
      item.ownerId === userId && [item.id, item._id, item.cloudId].some((id) => id === routeId),
  );
  const [form, setForm] = useState<AccountFormValue>({
    name: '',
    type: 'bank',
    customType: '',
    currency: '',
    openingBalance: '',
    isIncludedInTotal: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (!account) return;
    const currency = account.currency ?? '';
    setForm({
      name: account.name ?? '',
      type: account.type ?? 'bank',
      customType: account.customType ?? '',
      currency,
      openingBalance: decimalAmount(account.openingBalanceMinor, currency),
      icon: account.icon,
      color: account.color,
      isIncludedInTotal: account.isIncludedInTotal !== false,
      notes: account.notes,
      provider: account.provider,
      accountNumber: account.accountNumber,
      openedAt: account.openedAt,
      includeInAnalytics: account.includeInAnalytics !== false,
    });
  }, [account?.id, account?._id]);
  async function save() {
    if (!userId || !account || saving) return;
    const name = form.name.trim();
    const customType = form.customType.trim();
    if (!name) return setFormError('Enter an account name.');
    if (form.type === 'other' && !customType) return setFormError('Name your custom account type.');
    if (!(currencies as readonly string[]).includes(form.currency))
      return setFormError('Choose a supported currency.');
    if (!form.color) return setFormError('Choose an account color.');
    const recordId = String(account.id ?? account._id ?? account.cloudId ?? '');
    const accountId = String(account._id ?? account.cloudId ?? account.id ?? '');
    if (!recordId || !accountId) return setFormError('This account has no saved identifier.');
    setSaving(true);
    setFormError('');
    try {
      const openingBalanceMinor = parseMinor(form.openingBalance || '0', form.currency);
      if (openingBalanceMinor < 0n || openingBalanceMinor > maxInt64)
        throw new Error('Enter a valid non-negative opening balance.');
      const previousOpeningBalance =
        typeof account.openingBalanceMinor === 'bigint' ? account.openingBalanceMinor : 0n;
      const currentBalance =
        typeof account.balanceMinor === 'bigint' ? account.balanceMinor : previousOpeningBalance;
      await commitLocalWrite(
        userId,
        'account',
        'account.updateDetails',
        {
          ...account,
          name,
          type: form.type,
          customType: form.type === 'other' ? customType : undefined,
          currency: form.currency,
          openingBalanceMinor,
          balanceMinor: currentBalance + openingBalanceMinor - previousOpeningBalance,
          icon: form.icon,
          color: form.color,
          isIncludedInTotal: form.isIncludedInTotal,
          notes: form.notes?.trim() || undefined,
          provider: form.provider?.trim() || undefined,
          accountNumber: form.accountNumber?.trim() || undefined,
          openedAt: form.openedAt,
          includeInAnalytics: form.includeInAnalytics !== false,
        },
        {
          accountId,
          name,
          type: form.type,
          ...(form.type === 'other' ? { customType } : {}),
          currency: form.currency,
          openingBalanceMinor,
          icon: form.icon ?? null,
          color: form.color,
          isIncludedInTotal: form.isIncludedInTotal,
          notes: form.notes?.trim() || null,
          provider: form.provider?.trim() || null,
          accountNumber: form.accountNumber?.trim() || null,
          openedAt: form.openedAt ?? null,
          includeInAnalytics: form.includeInAnalytics !== false,
        },
        {
          recordId,
          dependencies: account._id || account.cloudId ? [] : [`account:${accountId}`],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
      if (profile && primaryDraft !== undefined) {
        const nextId = primaryDraft ? accountId : null;
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultAccount',
          { ...profile, defaultAccountId: nextId ?? undefined },
          { accountId: nextId },
          {
            recordId: String(profile.id ?? profile._id),
            dependencies:
              nextId && !account._id && !account.cloudId ? [`account:${accountId}`] : [],
          },
        );
      }
      router.replace(`/account/${encodeURIComponent(accountId)}` as never);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this account.');
    } finally {
      setSaving(false);
    }
  }
  if (!userId) return <Typography>Sign in to edit a private account record.</Typography>;
  if (loading) return <Typography>Loading account details…</Typography>;
  if (!account || account.archivedAt !== undefined)
    return (
      <>
        <Typography variant="title">Account unavailable</Typography>
        <Typography>{error?.message ?? 'This account could not be found.'}</Typography>
        <Button variant="outline" onPress={() => router.replace('/accounts' as never)}>
          Back to accounts
        </Button>
      </>
    );
  return (
    <AccountFormScreen
      mode="edit"
      createdAt={account.createdAt}
      activity={deriveFormActivity(
        transactions,
        categories,
        accounts ?? [],
        account,
        'accountId',
        userId,
      )}
      onOpenTransaction={(id) => router.push(`/transaction/${encodeURIComponent(id)}` as never)}
      onViewTransactions={() => router.push(`/account/${encodeURIComponent(routeId)}` as never)}
      isPrimary={
        primaryDraft ??
        Boolean(
          profile &&
          [account.id, account._id, account.cloudId].includes(profile.defaultAccountId as string),
        )
      }
      onPrimaryChange={profile ? setPrimaryDraft : undefined}
      title={form.name.trim() || 'Edit account'}
      subtitle="Update your account details and settings."
      value={form}
      currencies={currencies}
      saving={saving}
      error={formError}
      onChange={setForm}
      onSubmit={save}
      onBack={() => router.back()}
      submitLabel="Save changes"
    />
  );
}
