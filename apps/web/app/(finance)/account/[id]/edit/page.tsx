'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { currencies } from '@convex/shared/validators';
import { parseMinor } from '@convex/shared/money';
import { AccountFormScreen, deriveFormActivity, type AccountFormValue } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import {
  belongsToUser,
  idOf,
  localDependency,
  matchesRouteId,
  routeIdFor,
  SignInGate,
} from '../../../_personal';

type Account = LocalRecord & {
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

export default function EditAccountPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Account>('account');
  const { records: transactions } = useLocalRecords<LocalRecord>('transaction');
  const { records: categories } = useLocalRecords<LocalRecord>('category');
  const { records: profiles } = useLocalRecords<LocalRecord>('profile');
  const profile = profiles.find((record) => userId && belongsToUser(record, userId));
  const [primaryDraft, setPrimaryDraft] = React.useState<boolean>();
  const account = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesRouteId(record, routeId),
  );
  const [form, setForm] = React.useState<AccountFormValue>({
    name: '',
    type: 'bank',
    customType: '',
    currency: '',
    openingBalance: '',
    isIncludedInTotal: true,
  });
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!account) return;
    const currency = account.currency ?? '';
    setForm({
      name: account.name ?? '',
      type: account.type ?? 'bank',
      customType: account.customType ?? '',
      currency,
      openingBalance: decimalAmount(account.openingBalanceMinor as bigint | undefined, currency),
      icon: account.icon,
      color: account.color,
      isIncludedInTotal: account.isIncludedInTotal !== false,
      notes: account.notes,
      provider: account.provider,
      accountNumber: account.accountNumber,
      openedAt: account.openedAt,
      includeInAnalytics: account.includeInAnalytics !== false,
    });
  }, [account?._id, account?.id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !account || saving) return;
    const name = form.name.trim();
    const customType = form.customType.trim();
    if (!name) return setFormError('Enter an account name.');
    if (form.type === 'other' && !customType) return setFormError('Name your custom account type.');
    if (!(currencies as readonly string[]).includes(form.currency))
      return setFormError('Choose a supported currency.');
    if (!form.color) return setFormError('Choose an account color.');
    const accountId = idOf(account);
    if (!accountId) return setFormError('This account has no saved identifier.');
    setSaving(true);
    setFormError(null);
    try {
      const openingBalanceMinor = parseMinor(form.openingBalance || '0', form.currency);
      if (openingBalanceMinor < 0n || openingBalanceMinor > maxInt64)
        throw new Error('Enter a valid non-negative opening balance.');
      const dependency = localDependency('account', account);
      const previousOpeningBalance =
        typeof account.openingBalanceMinor === 'bigint' ? account.openingBalanceMinor : 0n;
      const currentBalance =
        typeof account.balanceMinor === 'bigint' ? account.balanceMinor : previousOpeningBalance;
      const updated: LocalRecord = {
        ...account,
        name,
        type: form.type,
        ...(form.type === 'other' ? { customType } : { customType: undefined }),
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
      };
      await commitLocalWrite(
        userId,
        'account',
        'account.updateDetails',
        updated,
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
          recordId: accountId,
          dependencies: dependency ? [dependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
      if (profile && primaryDraft !== undefined) {
        const nextId = primaryDraft ? String(account._id ?? account.cloudId ?? account.id) : null;
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultAccount',
          { ...profile, defaultAccountId: nextId ?? undefined },
          { accountId: nextId },
          { recordId: idOf(profile), dependencies: nextId && dependency ? [dependency] : [] },
        );
      }
      router.replace(`/account/${encodeURIComponent(routeIdFor(accountId))}`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this account.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="EDIT ACCOUNT" title="Update your account.">
        Sign in to edit a private account record.
      </SignInGate>
    );
  if (loading)
    return (
      <div className="finance-page">
        <p role="status">Loading account details…</p>
      </div>
    );
  if (!account || account.archivedAt !== undefined)
    return (
      <div className="finance-page" style={{ gap: 16 }}>
        <h1>Account unavailable</h1>
        <p>{error ?? 'This account could not be found.'}</p>
        <button type="button" onClick={() => router.replace('/accounts')}>
          Back to accounts
        </button>
      </div>
    );
  return (
    <AccountFormScreen
      mode="edit"
      createdAt={account.createdAt}
      activity={deriveFormActivity(transactions, categories, records, account, 'accountId', userId)}
      onOpenTransaction={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
      onViewTransactions={() => router.push(`/account/${encodeURIComponent(routeId)}`)}
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
