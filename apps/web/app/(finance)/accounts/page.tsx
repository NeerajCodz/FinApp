'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Landmark, Plus } from 'lucide-react';
import { Badge, Button, Card, Empty, Select, SectionHeader } from '@finapp/ui/web';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { currencies } from '@convex/shared/validators';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';

type Account = LocalRecord & {
  name?: string;
  type?: string;
  customType?: string;
  currency?: string;
  balanceMinor?: bigint | number | string;
  openingBalanceMinor?: bigint | number | string;
  archivedAt?: number;
  isIncludedInTotal?: boolean;
};
const accountTypes = ['bank', 'cash', 'card', 'wallet', 'loan', 'other'];
const asMinor = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
};
const labelCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function AccountsPage() {
  const { userId } = useBrowserSync();
  const { records, loading } = useLocalRecords<Account>('account');
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('bank');
  const [customType, setCustomType] = React.useState('');
  const [currency, setCurrency] = React.useState('INR');
  const [openingBalance, setOpeningBalance] = React.useState('0');
  const [included, setIncluded] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const accounts = records.filter((record) => record.archivedAt === undefined);

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError('Sign in while connected before creating an account.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amount = parseMinor(openingBalance, currency);
      const timestamp = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: name.trim(),
        type,
        ...(type === 'other' ? { customType: customType.trim() } : {}),
        currency,
        openingBalanceMinor: amount,
        balanceMinor: amount,
        isIncludedInTotal: included,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await commitLocalWrite(userId, 'account', 'account.create', record, {
        name: name.trim(),
        type,
        ...(type === 'other' ? { customType: customType.trim() } : {}),
        currency,
        openingBalanceMinor: amount,
        isIncludedInTotal: included,
      });
      setName('');
      setCustomType('');
      setOpeningBalance('0');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this account.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId) {
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">ACCOUNTS</p>
        <h1>Connect your money.</h1>
        <p>
          Sign in online once to open your private, user-scoped browser workspace. Account data then
          remains available in this browser offline.
        </p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">WHERE YOUR MONEY LIVES</p>
          <h1>Accounts</h1>
          <p className="finance-muted">
            Balances stay on this device first, then sync when you reconnect.
          </p>
        </div>
        <Badge variant="neutral">{accounts.length} active</Badge>
      </header>
      <div className="finance-accounts-layout">
        <Card className="finance-record-panel">
          <SectionHeader title="Your accounts" action={<span>{accounts.length} total</span>} />
          {loading ? (
            <p className="finance-muted">Opening your local accounts…</p>
          ) : accounts.length === 0 ? (
            <Empty
              title="A good place to begin"
              description="Add a bank, card, wallet, or cash account. You can keep it private and sync it when you’re ready."
              icon={<Landmark size={20} />}
            />
          ) : (
            <ul className="finance-record-list">
              {accounts.map((account) => (
                <li key={String(account.id ?? account._id)}>
                  <span className="finance-record-symbol">
                    <Landmark size={17} />
                  </span>
                  <span className="finance-record-copy">
                    <strong>{account.name ?? 'Account'}</strong>
                    <small>
                      {labelCase(account.customType ?? account.type ?? 'account')} ·{' '}
                      {account.currency ?? 'INR'}
                      {account.isIncludedInTotal === false ? ' · excluded from total' : ''}
                    </small>
                  </span>
                  <strong className="finance-record-amount">
                    {formatMinor(
                      asMinor(account.balanceMinor ?? account.openingBalanceMinor),
                      account.currency ?? 'INR',
                    )}
                  </strong>
                </li>
              ))}
            </ul>
          )}
          <Link className="finance-secondary-action" href="/transactions">
            Review activity <ArrowRight size={15} />
          </Link>
        </Card>
        <Card className="finance-form-panel">
          <SectionHeader title="Add an account" action={<Plus size={17} />} />
          <form className="finance-form" onSubmit={createAccount}>
            <FinanceInput
              label="Account name"
              value={name}
              onChangeText={setName}
              placeholder="Everyday account"
              required
              maxLength={80}
            />
            <div className="finance-form-row">
              <Select
                label="Type"
                options={accountTypes.map(labelCase)}
                value={labelCase(type)}
                onChange={(value) => setType(value.toLowerCase())}
              />
              <Select
                label="Currency"
                options={[...currencies]}
                value={currency}
                onChange={setCurrency}
              />
            </div>
            {type === 'other' && (
              <FinanceInput
                label="Custom type"
                value={customType}
                onChangeText={setCustomType}
                placeholder="Savings jar"
                required
                maxLength={40}
              />
            )}
            <FinanceInput
              label="Opening balance"
              type="number"
              min="0"
              step="0.01"
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
              {saving ? 'Saving…' : 'Save account'} <ArrowRight size={15} />
            </Button>
            <p className="finance-form-note">
              Saved locally first. Sync happens automatically when you’re online.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
