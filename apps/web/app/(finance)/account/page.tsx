'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Banknote, ChevronRight, CircleDollarSign, CreditCard, Landmark, Plus, Wallet } from 'lucide-react';
import { Button, Card, IconButton, Typography } from '@finapp/ui/web';
import { Money } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, asMinor, belongsToUser, idOf, SignInGate } from '../_personal';

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
type Transaction = LocalRecord & {
  accountId?: string;
  transferAccountId?: string;
  amountMinor?: bigint | number | string;
  type?: string;
  status?: string;
  deletedAt?: number;
};

export default function PersonalAccountsPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const {
    records: accountRecords,
    loading: accountLoading,
    error: accountError,
  } = useLocalRecords<Account>('account');
  const {
    records: transactionRecords,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const error = accountError ?? transactionError;
  const accountRows = accountRecords
    .filter((record) => userId && belongsToUser(record, userId) && record.archivedAt === undefined)
    .map((account) => {
      const ids = new Set(aliasesOf(account));
      const optimisticDelta = transactionRecords.reduce((delta, transaction) => {
        if (
          !ids.size ||
          transaction.status !== 'posted' ||
          transaction.deletedAt !== undefined ||
          typeof transaction.clientUpdatedAt !== 'number'
        )
          return delta;
        const amount = asMinor(transaction.amountMinor);
        const source = ids.has(String(transaction.accountId ?? ''))
          ? transaction.type === 'expense' || transaction.type === 'transfer'
            ? -amount
            : amount
          : 0n;
        const destination =
          transaction.type === 'transfer' && ids.has(String(transaction.transferAccountId ?? ''))
            ? amount
            : 0n;
        return delta + source + destination;
      }, 0n);
      return {
        ...account,
        accountKey: idOf(account),
        currentBalance:
          asMinor(account.balanceMinor ?? account.openingBalanceMinor) + optimisticDelta,
      };
    });
  const activeAccounts = accountRows;
  const loading = accountLoading || (activeAccounts.length > 0 && transactionLoading);
  const displayed = accountRows.sort((left, right) =>
    (left.name ?? '').localeCompare(right.name ?? ''),
  );
  const totalsByCurrency = new Map<string, bigint>();
  for (const account of activeAccounts) {
    if (account.isIncludedInTotal !== true) continue;
    const currency = account.currency ?? 'INR';
    totalsByCurrency.set(currency, (totalsByCurrency.get(currency) ?? 0n) + account.currentBalance);
  }
  const totals = [...totalsByCurrency].sort(([left], [right]) => left.localeCompare(right));

  if (!userId)
    return (
      <SignInGate eyebrow="ACCOUNTS" title="Your money, organized.">
        Sign in to see accounts saved in your private browser workspace.
      </SignInGate>
    );

  return (
    <div className="finance-page" style={{ gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <div style={{ flex: 1, display: 'grid', gap: 2 }}>
          <Typography variant="title">Accounts</Typography>
          <Typography variant="small">Balances, together.</Typography>
        </div>
        <IconButton
          label="Add account"
          variant="outline"
          onPress={() => router.push('/account/new')}
        >
          <Plus size={21} aria-hidden="true" />
        </IconButton>
      </header>

      {loading ? (
        <Card variant="subtle" style={{ display: 'grid', gap: 12 }}>
          <Typography variant="label">Loading accounts</Typography>
          <span
            aria-hidden="true"
            style={{
              height: 22,
              width: '62%',
              borderRadius: 8,
              background: 'var(--finapp-surface-raised)',
            }}
          />
          <span
            aria-hidden="true"
            style={{
              height: 14,
              width: '38%',
              borderRadius: 8,
              background: 'var(--finapp-surface-raised)',
            }}
          />
        </Card>
      ) : error ? (
        <div role="alert" style={{ display: 'grid', gap: 10 }}>
          <p className="finance-form-error">Account data could not be opened: {error}</p>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : displayed.length === 0 ? (
        <Card
          variant="subtle"
          style={{ display: 'grid', gap: 14, padding: 24, justifyItems: 'center' }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 18,
              background: 'var(--finapp-surface-raised)',
            }}
          >
            <Wallet size={26} color="var(--finapp-primary)" />
          </span>
          <Typography variant="heading" style={{ textAlign: 'center' }}>
            Start with an account
          </Typography>
          <Typography variant="small" style={{ maxWidth: 300, textAlign: 'center' }}>
            Add cash, a bank account, or a card to keep balances and activity in one place.
          </Typography>
          <Button variant="outline" onPress={() => router.push('/account/new')}>
            Add your first account
          </Button>
        </Card>
      ) : (
        <>
          <Card
            variant="subtle"
            style={{ display: 'grid', gap: 16, border: '1px solid var(--finapp-border-subtle)' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gap: 5 }}>
                <Typography variant="caption">ACCOUNT OVERVIEW</Typography>
                <Typography variant="heading">
                  {activeAccounts.length} active {activeAccounts.length === 1 ? 'account' : 'accounts'}
                </Typography>
              </div>
              <Landmark size={20} color="var(--finapp-primary)" aria-hidden="true" />
            </div>
            <div style={{ borderTop: '1px solid var(--finapp-border-subtle)' }} />
            <div style={{ display: 'grid', gap: 9 }}>
              <Typography variant="small">Included balances</Typography>
              {totals.length > 0 ? (
                totals.map(([currency, amountMinor], index) => (
                  <Money
                    key={currency}
                    amountMinor={amountMinor}
                    currency={currency}
                    size={index === 0 ? 'display' : 'body'}
                  />
                ))
              ) : (
                <Typography variant="small">No account balances are included in your total.</Typography>
              )}
            </div>
          </Card>

          <section style={{ display: 'grid', gap: 11 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="heading">Your accounts</Typography>
              <Typography variant="caption">{activeAccounts.length} ACTIVE</Typography>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {displayed.map((account) => {
                const TypeIcon =
                  account.type === 'cash'
                    ? Banknote
                    : account.type === 'bank'
                      ? Landmark
                      : account.type === 'card'
                        ? CreditCard
                        : account.type === 'loan'
                          ? CircleDollarSign
                          : Wallet;
                const currency = account.currency ?? 'INR';
                const name = account.name ?? 'Account';
                return (
                  <Link
                    key={account.accountKey}
                    href={`/account/${encodeURIComponent(account.accountKey)}`}
                    aria-label={`Open ${name} account`}
                    style={{
                      display: 'flex',
                      minHeight: 82,
                      alignItems: 'center',
                      gap: 12,
                      padding: '13px 14px',
                      border: '1px solid var(--finapp-border-subtle)',
                      borderRadius: 18,
                      background: 'var(--finapp-card)',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 46,
                        height: 46,
                        display: 'grid',
                        flex: '0 0 auto',
                        placeItems: 'center',
                        borderRadius: 15,
                        background: 'var(--finapp-surface-raised)',
                      }}
                    >
                      <TypeIcon size={21} color="var(--finapp-primary)" />
                    </span>
                    <span style={{ display: 'grid', flex: 1, minWidth: 0, gap: 3 }}>
                      <Typography variant="bodyLarge" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                      </Typography>
                      <Typography variant="caption">
                        {(account.customType ?? account.type ?? 'Account').replace(/^./, (value) =>
                          value.toUpperCase(),
                        )}{' '}
                        · {currency}
                      </Typography>
                    </span>
                    <span
                      style={{ display: 'grid', flexShrink: 0, justifyItems: 'end', gap: 4 }}
                    >
                      <Money amountMinor={account.currentBalance} currency={currency} />
                      <Typography variant="caption">
                        {account.isIncludedInTotal === true ? 'In total' : 'Excluded'}
                      </Typography>
                    </span>
                    <ChevronRight size={18} color="var(--finapp-foreground-subtle)" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
