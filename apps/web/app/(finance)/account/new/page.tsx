'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Card } from '@finapp/ui/web';
import { parseMinor } from '@convex/shared/money';
import { currencies } from '@convex/shared/validators';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import { PageHeading, SignInGate } from '../../_personal';

type Profile = LocalRecord & { defaultCurrency?: string };
const accountTypes = [
  ['Cash', 'cash'],
  ['Bank', 'bank'],
  ['Card', 'card'],
  ['Wallet', 'wallet'],
  ['Loan', 'loan'],
  ['Other', 'other'],
] as const;
const maxInt64 = 9_223_372_036_854_775_807n;

export default function NewPersonalAccountPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const {
    records: profiles,
    loading: profileLoading,
    error: profileError,
  } = useLocalRecords<Profile>('profile');
  const profile = profiles[0];
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<(typeof accountTypes)[number][1]>('bank');
  const [customType, setCustomType] = React.useState('');
  const [currency, setCurrency] = React.useState('INR');
  const [openingBalance, setOpeningBalance] = React.useState('0');
  const [included, setIncluded] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (
      profile?.defaultCurrency &&
      currencies.includes(profile.defaultCurrency as (typeof currencies)[number])
    )
      setCurrency(profile.defaultCurrency);
  }, [profile?.defaultCurrency]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    const trimmedName = name.trim();
    const custom = customType.trim();
    if (!trimmedName) {
      setError('Enter an account name.');
      return;
    }
    if (type === 'other' && !custom) {
      setError('Name the custom account type.');
      return;
    }
    if (!(currencies as readonly string[]).includes(currency)) {
      setError('Choose a supported currency.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const openingBalanceMinor = parseMinor(openingBalance || '0', currency);
      if (openingBalanceMinor < 0n || openingBalanceMinor > maxInt64)
        throw new Error('Enter a valid non-negative opening balance.');
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: trimmedName,
        type,
        ...(type === 'other' ? { customType: custom } : {}),
        currency,
        openingBalanceMinor,
        balanceMinor: openingBalanceMinor,
        isIncludedInTotal: included,
        createdAt: now,
        updatedAt: now,
      };
      const id = await commitLocalWrite(userId, 'account', 'account.create', record, {
        name: trimmedName,
        type,
        ...(type === 'other' ? { customType: custom } : {}),
        currency,
        openingBalanceMinor,
        isIncludedInTotal: included,
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
    <div className="finance-page">
      <Link className="finance-secondary-action" href="/account">
        <ArrowLeft size={15} /> Back to accounts
      </Link>
      <PageHeading
        eyebrow="NEW ACCOUNT"
        title="Add an account"
        description="Set the account’s opening balance and currency. Its currency stays fixed for recorded transactions."
      />
      <Card className="finance-form-panel">
        {profileLoading ? (
          <p className="finance-muted" role="status">
            Loading your profile…
          </p>
        ) : profileError ? (
          <p className="finance-form-error" role="alert">
            Profile data could not be opened: {profileError}
          </p>
        ) : (
          <form className="finance-form" onSubmit={create}>
            <FinanceInput
              label="Account name"
              value={name}
              onChangeText={setName}
              placeholder="Everyday account"
              required
              maxLength={80}
            />
            <label className="finance-form-field">
              <span>Type</span>
              <select
                value={type}
                onChange={(event) => setType(event.currentTarget.value as typeof type)}
              >
                {accountTypes.map(([label, value]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {type === 'other' && (
              <FinanceInput
                label="Custom type"
                value={customType}
                onChangeText={setCustomType}
                placeholder="Savings jar"
                maxLength={40}
                required
              />
            )}
            <label className="finance-form-field">
              <span>Currency</span>
              <select value={currency} onChange={(event) => setCurrency(event.currentTarget.value)}>
                {currencies.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <FinanceInput
              label={`Opening balance (${currency})`}
              type="number"
              min="0"
              step={currency === 'JPY' || currency === 'KRW' ? '1' : '0.01'}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              required
            />
            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={included}
                onChange={(event) => setIncluded(event.currentTarget.checked)}
              />
              <span>Include in total balance</span>
            </label>
            {error && (
              <p className="finance-form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving locally…' : 'Create account'} <ArrowRight size={15} />
            </Button>
            <p className="finance-form-note">
              The account is saved locally with a queued sync operation.
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
