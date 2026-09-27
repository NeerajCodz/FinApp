'use client';

import React from 'react';
import Link from 'next/link';
import { Banknote, CircleDollarSign, CreditCard, Landmark, Plus, Wallet } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, asMinor, belongsToUser, idOf, PageHeading, SignInGate } from '../_personal';

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
  const { userId } = useBrowserSync();
  const { records: accountRecords, loading, error } = useLocalRecords<Account>('account');
  const { records: transactionRecords } = useLocalRecords<Transaction>('transaction');
  const [showArchived, setShowArchived] = React.useState(false);
  const accountRows = accountRecords
    .filter((record) => userId && belongsToUser(record, userId))
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
  const activeAccounts = accountRows.filter((account) => account.archivedAt === undefined);
  const displayed = accountRows
    .filter((account) => showArchived === (account.archivedAt !== undefined))
    .sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));
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
    <div className="finance-page">
      <PageHeading
        eyebrow="WHERE YOUR MONEY LIVES"
        title="Accounts"
        description="Review balances by currency, keep account history, and archive accounts you no longer use."
      />
      <div
        className="finance-page-actions"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}
      >
        <Badge variant="neutral">{activeAccounts.length} active</Badge>
        <Button
          type="button"
          variant={showArchived ? 'secondary' : 'outline'}
          onPress={() => setShowArchived((value) => !value)}
        >
          {showArchived ? 'Show active' : 'Show archived'}
        </Button>
        <Link className="finance-primary-link" href="/account/new">
          New account <Plus size={16} />
        </Link>
      </div>
      {!showArchived && activeAccounts.length > 0 && (
        <Card className="finance-record-panel">
          <SectionHeader title="Account overview" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
              gap: 18,
            }}
          >
            <div>
              <span className="finance-muted">Active accounts</span>
              <strong style={{ display: 'block', fontSize: '1.35rem' }}>
                {activeAccounts.length}
              </strong>
            </div>
            <div>
              <span className="finance-muted">Included balances</span>
              {totals.length > 0 ? (
                totals.map(([currency, amount]) => (
                  <strong
                    className="finance-record-amount"
                    key={currency}
                    style={{ display: 'block' }}
                  >
                    {formatMinor(amount, currency)}
                  </strong>
                ))
              ) : (
                <span className="finance-muted" style={{ display: 'block' }}>
                  No balances are included in your total.
                </span>
              )}
            </div>
          </div>
        </Card>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title={showArchived ? 'Archived accounts' : 'Your accounts'}
          action={
            <Link href="/account/new" aria-label="Add account">
              <Plus size={17} />
            </Link>
          }
        />
        {loading ? (
          <p className="finance-muted" role="status">
            Opening your local accounts…
          </p>
        ) : error ? (
          <p className="finance-form-error" role="alert">
            Account data could not be opened: {error}
          </p>
        ) : displayed.length === 0 ? (
          <Empty
            title={showArchived ? 'No archived accounts' : 'A good place to begin'}
            description={
              showArchived
                ? 'Archived accounts remain available here for reference.'
                : 'Add a bank, card, wallet, loan, or cash account to start tracking balances.'
            }
            icon={<Landmark size={20} />}
            action={
              !showArchived ? (
                <Link className="finance-inline-link" href="/account/new">
                  Create an account
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="finance-record-list">
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
              return (
                <li key={account.accountKey}>
                  <span className="finance-record-symbol">
                    <TypeIcon size={17} />
                  </span>
                  <span className="finance-record-copy">
                    <strong>
                      <Link href={`/account/${encodeURIComponent(account.accountKey)}`}>
                        {account.name ?? 'Account'}
                      </Link>
                    </strong>
                    <small>
                      {(account.customType ?? account.type ?? 'account').replace(/^./, (value) =>
                        value.toUpperCase(),
                      )}{' '}
                      · {account.currency ?? 'INR'}
                      {account.archivedAt !== undefined ? ' · archived' : ''}
                      {account.isIncludedInTotal === true
                        ? ' · included in total'
                        : ' · excluded from total'}
                    </small>
                  </span>
                  <strong className="finance-record-amount">
                    {formatMinor(account.currentBalance, account.currency ?? 'INR')}
                  </strong>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="finance-form-note">
        Balances include saved local transaction changes. A newly signed-in browser may not have all
        account history downloaded.
      </p>
    </div>
  );
}
