'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  EyeOff,
  Landmark,
  Plus,
  Search,
  Wallet,
} from 'lucide-react';
import { FinanceEmptyState } from './FinanceEmptyState';
import { Button, Input, Label, Sheet, Typography } from '@finapp/ui/web';
import { EntityIcon, EntityIconPicker } from './EntityIconPicker';
import { EntityColorPicker } from './EntityColorPicker';
import { Money } from './Money';
import { TransactionRow } from './TransactionRow';
import type { SemanticType, TransactionType } from '../types';
import styles from './AccountsExperience.module.css';

export type AccountListEntry = {
  id: string;
  name: string;
  type: string;
  customType?: string;
  currency: string;
  balanceMinor: bigint;
  icon?: string;
  color?: string;
  isIncludedInTotal: boolean;
};

export type AccountCurrencyTotal = { currency: string; amountMinor: bigint };

export type AccountActivityEntry = {
  id: string;
  title: string;
  category?: string;
  categoryIcon?: string;
  date: string;
  status?: string;
  amountMinor: bigint;
  currency: string;
  type: TransactionType;
  semanticType?: SemanticType;
  occurredAt: number;
  cashFlowMinor: bigint;
};

export type AccountsIndexViewProps = {
  accounts: AccountListEntry[];
  totals: AccountCurrencyTotal[];
  loading: boolean;
  error?: string | null;
  onRetry: () => void;
  onAddAccount: () => void;
  onOpenAccount: (id: string) => void;
};

export function AccountsIndexView({
  accounts,
  totals,
  loading,
  error,
  onRetry,
  onAddAccount,
  onOpenAccount,
}: AccountsIndexViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'bank' | 'card' | 'wallet' | 'cash' | 'custom'>(
    'all',
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return accounts.filter((account) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'custom'
          ? account.type === 'other' ||
            account.type === 'loan' ||
            !['bank', 'card', 'wallet', 'cash'].includes(account.type)
          : account.type === filter);
      const matchesSearch =
        !query ||
        [account.name, account.type, account.customType, account.currency]
          .filter(Boolean)
          .some((part) => part!.toLocaleLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [accounts, filter, search]);
  const excludedCount = accounts.filter((account) => !account.isIncludedInTotal).length;
  const filters = [
    ['all', 'All'],
    ['bank', 'Bank'],
    ['card', 'Card'],
    ['wallet', 'Wallet'],
    ['cash', 'Cash'],
    ['custom', 'Custom'],
  ] as const;

  return (
    <div className={styles.page}>
      <header className={styles.indexHeader}>
        <div className={styles.headingBlock}>
          <Typography variant="hero">Accounts</Typography>
          <Typography variant="small">All your money, in one place.</Typography>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.searchBox}>
            <Search size={17} aria-hidden="true" />
            <span className={styles.visuallyHidden}>Search accounts</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search accounts…"
            />
          </label>
          <Button onPress={onAddAccount} className={styles.addButton}>
            <Plus size={18} aria-hidden="true" />
            Add account
          </Button>
        </div>
      </header>

      {loading ? (
        <div className={styles.summaryGrid} aria-label="Loading accounts" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <div className={`${styles.summaryCard} ${styles.skeleton}`} key={item} />
          ))}
        </div>
      ) : error ? (
        <section className={styles.statePanel} role="alert">
          <Typography variant="title">Accounts could not be opened</Typography>
          <Typography variant="small">{error}</Typography>
          <Button variant="outline" onPress={onRetry}>
            Try again
          </Button>
        </section>
      ) : (
        <>
          <section className={styles.summaryGrid} aria-label="Account summary">
            <div className={`${styles.summaryCard} ${styles.balanceSummary}`}>
              <span className={styles.summaryIcon} aria-hidden="true">
                <Wallet size={22} />
              </span>
              <div className={styles.summaryCopy}>
                <Typography variant="small">Included balance</Typography>
                {totals.length ? (
                  <div className={styles.totalValues}>
                    {totals.map(({ currency, amountMinor }) => (
                      <Money
                        key={currency}
                        amountMinor={amountMinor}
                        currency={currency}
                        size="display"
                      />
                    ))}
                  </div>
                ) : (
                  <Typography variant="title">No included balance</Typography>
                )}
                <Typography variant="caption">
                  Across {accounts.filter((account) => account.isIncludedInTotal).length} accounts
                  {totals.length === 1 ? ` · ${totals[0].currency}` : ''}
                </Typography>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryIcon} aria-hidden="true">
                <Landmark size={22} />
              </span>
              <div className={styles.summaryCopy}>
                <Typography variant="small">Accounts</Typography>
                <Typography variant="heading">{accounts.length}</Typography>
                <Typography variant="caption">active accounts</Typography>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <span className={`${styles.summaryIcon} ${styles.neutralIcon}`} aria-hidden="true">
                <EyeOff size={21} />
              </span>
              <div className={styles.summaryCopy}>
                <Typography variant="small">Excluded</Typography>
                <Typography variant="heading">{excludedCount}</Typography>
                <Typography variant="caption">
                  {excludedCount === 1 ? 'account' : 'accounts'} not in total
                </Typography>
              </div>
            </div>
          </section>

          {accounts.length === 0 ? (
            <FinanceEmptyState
              kind="account"
              title="Start with an account"
              description="Add cash, a bank account, or a card to keep balances and activity together."
              action={
                <Button onPress={onAddAccount}>
                  <Plus size={17} aria-hidden="true" /> Add your first account
                </Button>
              }
            />
          ) : (
            <section className={styles.accountsPanel} aria-labelledby="accounts-heading">
              <div className={styles.listHeader}>
                <div className={styles.listTitle}>
                  <Typography variant="title" id="accounts-heading">
                    Your accounts
                  </Typography>
                  <Typography variant="small">
                    {filtered.length} shown · {accounts.length} active
                  </Typography>
                </div>
                <div className={styles.filters} role="group" aria-label="Filter accounts by type">
                  {filters.map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={`${styles.filterButton} ${filter === value ? styles.filterActive : ''}`}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {filtered.length === 0 ? (
                <FinanceEmptyState
                  kind="search"
                  compact
                  title="No accounts match this search"
                  description="Try another name or account type."
                />
              ) : (
                <div className={styles.accountRows}>
                  {filtered.map((account) => {
                    const color = account.color?.trim() || 'var(--finapp-primary)';
                    const TypeIcon =
                      account.type === 'cash'
                        ? Banknote
                        : account.type === 'bank'
                          ? Landmark
                          : account.type === 'card'
                            ? CreditCard
                            : account.type === 'loan'
                              ? CircleDollarSign
                              : account.type === 'wallet'
                                ? Wallet
                                : Building2;
                    const kind =
                      account.type === 'other' && account.customType
                        ? account.customType
                        : account.type.replace(/^./, (letter) => letter.toUpperCase());
                    return (
                      <a
                        className={styles.accountRow}
                        key={account.id}
                        href={`/account/${encodeURIComponent(account.id)}`}
                        onClick={(event) => {
                          if (
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          )
                            return;
                          event.preventDefault();
                          onOpenAccount(account.id);
                        }}
                        aria-label={`Open ${account.name} account`}
                      >
                        <span
                          className={styles.accountIcon}
                          style={{ '--account-color': color } as React.CSSProperties}
                          aria-hidden="true"
                        >
                          {account.icon ? (
                            <EntityIcon
                              value={account.icon}
                              size={22}
                              color="var(--finapp-background)"
                            />
                          ) : (
                            <TypeIcon size={22} color="var(--finapp-background)" />
                          )}
                        </span>
                        <span className={styles.accountMeta}>
                          <span className={styles.accountName}>{account.name}</span>
                          <span className={styles.accountKind}>
                            {kind} · {account.currency}
                          </span>
                        </span>
                        <span className={styles.accountBalance}>
                          <Money amountMinor={account.balanceMinor} currency={account.currency} />
                        </span>
                        <span
                          className={`${styles.inclusion} ${account.isIncludedInTotal ? styles.included : ''}`}
                        >
                          {account.isIncludedInTotal ? (
                            <Check size={13} aria-hidden="true" />
                          ) : (
                            <EyeOff size={13} aria-hidden="true" />
                          )}
                          {account.isIncludedInTotal ? 'In total' : 'Excluded'}
                        </span>
                        <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
                      </a>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          <aside className={styles.totalNote}>
            <span className={styles.noteIcon} aria-hidden="true">
              <CircleDollarSign size={22} />
            </span>
            <div>
              <Typography variant="small">Included balances</Typography>
              {totals.length ? (
                totals.map(({ currency, amountMinor }) => (
                  <span key={currency} className={styles.noteTotal}>
                    <Money amountMinor={amountMinor} currency={currency} size="body" />
                  </span>
                ))
              ) : (
                <FinanceEmptyState
                  kind="account"
                  compact
                  title="No included balances"
                  description="Mark an account as included to show it in your overall balance."
                />
              )}
            </div>
            <p>Only accounts marked “In total” count toward your overall balance.</p>
          </aside>
        </>
      )}
    </div>
  );
}

export type AccountDetailViewProps = {
  account: AccountListEntry & { createdAt?: number; archivedAt?: number };
  activity: AccountActivityEntry[];
  flowActivity: { occurredAt: number; cashFlowMinor: bigint }[];
  isBusy: boolean;
  error?: string | null;
  rangeNotice?: string | null;
  onEdit: () => void;
  onRename: (name: string) => Promise<boolean>;
  onArchive: () => Promise<boolean>;
  onSetIcon: (icon: string | null) => void;
  onSetColor: (color: string | null) => void;
  onAddTransaction: () => void;
  onOpenTransaction: (id: string) => void;
};

export function AccountDetailView({
  account,
  activity,
  flowActivity,
  isBusy,
  error,
  rangeNotice,
  onEdit,
  onRename,
  onArchive,
  onSetIcon,
  onSetColor,
  onAddTransaction,
  onOpenTransaction,
}: AccountDetailViewProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(account.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const isArchived = account.archivedAt !== undefined;
  const accountKind =
    account.type === 'other' && account.customType
      ? account.customType
      : account.type.replace(/^./, (letter) => letter.toUpperCase());
  const chartDays = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    const byDay = new Map<string, { date: Date; amount: bigint }>();
    for (let offset = 0; offset < 30; offset += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      byDay.set(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`, { date, amount: 0n });
    }
    for (const transaction of flowActivity) {
      const date = new Date(transaction.occurredAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const bucket = byDay.get(key);
      if (bucket) bucket.amount += transaction.cashFlowMinor;
    }
    return [...byDay.values()];
  }, [flowActivity]);
  const incoming = flowActivity.reduce(
    (total, transaction) =>
      total + (transaction.cashFlowMinor > 0n ? transaction.cashFlowMinor : 0n),
    0n,
  );
  const outgoing = flowActivity.reduce(
    (total, transaction) =>
      total + (transaction.cashFlowMinor < 0n ? -transaction.cashFlowMinor : 0n),
    0n,
  );
  const net = incoming - outgoing;
  const maxBar = chartDays.reduce((maximum, day) => {
    const magnitude = day.amount < 0n ? -day.amount : day.amount;
    return magnitude > maximum ? magnitude : maximum;
  }, 0n);

  async function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRenameError(null);
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setRenameError('Enter an account name.');
      return;
    }
    if (await onRename(trimmed)) setRenameOpen(false);
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <a href="/accounts">
          <ArrowLeft size={16} aria-hidden="true" /> Accounts
        </a>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{account.name}</span>
      </nav>
      <header className={styles.detailHeader}>
        <span
          className={styles.detailIcon}
          style={
            {
              '--account-color': account.color?.trim() || 'var(--finapp-primary)',
            } as React.CSSProperties
          }
          aria-hidden="true"
        >
          {account.icon ? (
            <EntityIcon value={account.icon} size={27} color="var(--finapp-background)" />
          ) : (
            <Landmark size={27} color="var(--finapp-background)" />
          )}
        </span>
        <div className={styles.detailTitle}>
          <Typography variant="hero">{account.name}</Typography>
          <div className={styles.detailMeta}>
            <span>{accountKind}</span>
            <span aria-hidden="true">·</span>
            <span>{account.currency}</span>
            <span
              className={`${styles.inclusion} ${account.isIncludedInTotal ? styles.included : ''}`}
            >
              {account.isIncludedInTotal ? 'In total' : 'Excluded from total'}
            </span>
          </div>
        </div>
        <div className={styles.detailActions}>
          {!isArchived && (
            <Button variant="outline" onPress={onEdit}>
              Edit details
            </Button>
          )}
          {!isArchived && (
            <Button
              variant="outline"
              onPress={() => {
                setNameDraft(account.name);
                setRenameError(null);
                setRenameOpen(true);
              }}
            >
              Rename
            </Button>
          )}
          {!isArchived && (
            <Button onPress={onAddTransaction}>
              <Plus size={17} aria-hidden="true" /> Add transaction
            </Button>
          )}
          {!isArchived && (
            <Button variant="destructive" onPress={() => setArchiveOpen(true)}>
              Archive
            </Button>
          )}
        </div>
      </header>

      <section className={styles.balanceAndFlow}>
        <div className={styles.balancePanel}>
          <Typography variant="small">Current balance</Typography>
          <Money amountMinor={account.balanceMinor} currency={account.currency} size="hero" />
          <div className={styles.flowCards} aria-label="Account cash flow for the last 30 days">
            <div>
              <span className={`${styles.flowIcon} ${styles.flowIn}`}>
                <ArrowUpRight size={17} aria-hidden="true" />
              </span>
              <Typography variant="caption">Money in</Typography>
              <Money amountMinor={incoming} currency={account.currency} size="body" />
            </div>
            <div>
              <span className={`${styles.flowIcon} ${styles.flowOut}`}>
                <ArrowUpRight size={17} aria-hidden="true" />
              </span>
              <Typography variant="caption">Money out</Typography>
              <Money amountMinor={outgoing} currency={account.currency} size="body" />
            </div>
            <div>
              <span className={styles.flowIcon}>
                <CircleDollarSign size={17} aria-hidden="true" />
              </span>
              <Typography variant="caption">Net change</Typography>
              <span className={net >= 0n ? styles.positive : styles.negative}>
                {net >= 0n ? '+' : '−'}
                <Money
                  amountMinor={net >= 0n ? net : -net}
                  currency={account.currency}
                  size="body"
                />
              </span>
            </div>
          </div>
        </div>
        <section className={styles.chartPanel} aria-labelledby="cashflow-heading">
          <div className={styles.chartHeader}>
            <div>
              <Typography variant="title" id="cashflow-heading">
                Account cash flow
              </Typography>
              <Typography variant="caption">
                Last 30 days · {flowActivity.length} posted transactions
              </Typography>
            </div>
            <span className={styles.periodLabel}>
              <CalendarDays size={15} aria-hidden="true" /> Last 30 days
            </span>
          </div>
          <div
            className={styles.chart}
            role="img"
            aria-label={`Daily net cash flow across the last 30 days. Net change ${net >= 0n ? 'positive' : 'negative'}.`}
          >
            <div className={styles.chartGrid} aria-hidden="true">
              <span>High</span>
              <span>0</span>
              <span>Low</span>
            </div>
            <div className={styles.chartPlot}>
              <div className={styles.zeroLine} />
              {chartDays.map(({ date, amount }, index) => {
                const magnitude = amount < 0n ? -amount : amount;
                const height = maxBar === 0n ? 0 : Math.max(4, Number((magnitude * 44n) / maxBar));
                return (
                  <span
                    key={date.toISOString()}
                    className={`${styles.chartBar} ${amount >= 0n ? styles.chartPositive : styles.chartNegative}`}
                    style={{
                      left: `${(index / chartDays.length) * 100 + 0.2}%`,
                      top: amount >= 0n ? `${48 - height}%` : '48%',
                      height: `${height}%`,
                    }}
                    title={`${date.toLocaleDateString()}: ${amount >= 0n ? '+' : '−'}${amount >= 0n ? amount : -amount} minor units`}
                  />
                );
              })}
            </div>
            <div className={styles.chartDates} aria-hidden="true">
              <span>
                {chartDays[0]?.date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span>
                {chartDays[7]?.date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span>
                {chartDays[14]?.date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span>
                {chartDays[21]?.date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span>Today</span>
            </div>
          </div>
          <div className={styles.chartLegend}>
            <span>
              <i className={styles.legendIncome} /> Money in
            </span>
            <span>
              <i className={styles.legendExpense} /> Money out
            </span>
            <span className={styles.netLegend}>Bars show daily net</span>
          </div>
        </section>
      </section>

      <section className={styles.propertiesPanel} aria-labelledby="account-properties-heading">
        <div className={styles.propertiesHeading}>
          <Typography variant="title" id="account-properties-heading">
            Account details
          </Typography>
          <Typography variant="caption">Settings and identity</Typography>
        </div>
        <div className={styles.propertyGrid}>
          <div className={styles.property}>
            <span className={styles.propertyGlyph}>
              <Building2 size={18} />
            </span>
            <span>
              <Typography variant="caption">Type</Typography>
              <strong>{accountKind}</strong>
            </span>
          </div>
          <div className={styles.property}>
            <span className={styles.propertyGlyph}>
              <CircleDollarSign size={18} />
            </span>
            <span>
              <Typography variant="caption">Currency</Typography>
              <strong>{account.currency}</strong>
            </span>
          </div>
          <div className={styles.property}>
            <span className={styles.propertyGlyph}>
              <Check size={18} />
            </span>
            <span>
              <Typography variant="caption">Included in total</Typography>
              <strong>
                {account.isIncludedInTotal ? 'Counts in total balance' : 'Not counted in balance'}
              </strong>
            </span>
          </div>
          <div className={styles.property}>
            <span className={styles.propertyGlyph}>
              <CalendarDays size={18} />
            </span>
            <span>
              <Typography variant="caption">Added on</Typography>
              <strong>
                {typeof account.createdAt === 'number'
                  ? new Date(account.createdAt).toLocaleDateString()
                  : 'Date unavailable'}
              </strong>
            </span>
          </div>
        </div>
        {!isArchived && (
          <div className={styles.customize}>
            <div className={styles.customizeHeader}>
              <span
                className={styles.customizeIcon}
                style={
                  {
                    '--account-color': account.color?.trim() || 'var(--finapp-primary)',
                  } as React.CSSProperties
                }
              >
                {account.icon ? (
                  <EntityIcon
                    value={account.icon}
                    size={22}
                    color={account.color?.trim() || 'var(--finapp-primary)'}
                  />
                ) : (
                  <Landmark size={22} color={account.color?.trim() || 'var(--finapp-primary)'} />
                )}
              </span>
              <div>
                <Typography variant="bodyLarge">Personalize account</Typography>
                <Typography variant="caption">Choose a color and icon</Typography>
              </div>
            </div>
            <EntityColorPicker
              compact
              value={account.color ?? undefined}
              onChange={(color) => onSetColor(color ?? null)}
              disabled={isBusy}
              label="Account color"
            />
            <div className={isBusy ? styles.disabledPicker : undefined} aria-busy={isBusy}>
              <EntityIconPicker
                mode="lucide"
                value={account.icon}
                onChange={(icon) => onSetIcon(icon ?? null)}
                compact
                label="Change account icon"
              />
            </div>
          </div>
        )}
      </section>

      {error ? (
        <p className={styles.errorMessage} role="alert">
          {error}
        </p>
      ) : null}
      {rangeNotice ? (
        <p className={styles.rangeNotice} role="status">
          {rangeNotice}
        </p>
      ) : null}
      {isArchived ? (
        <p className={styles.rangeNotice}>
          Archived accounts remain available for reference and cannot receive new transactions.
        </p>
      ) : null}

      <section className={styles.activityPanel} aria-labelledby="recent-activity-heading">
        <div className={styles.activityHeader}>
          <div>
            <Typography variant="title" id="recent-activity-heading">
              Recent activity
            </Typography>
            <Typography variant="caption">
              Last 30 days · {flowActivity.length} posted transactions
            </Typography>
          </div>
          <Button variant="outline" onPress={onAddTransaction} disabled={isArchived}>
            <Plus size={16} aria-hidden="true" /> Add transaction
          </Button>
        </div>
        {activity.length === 0 ? (
          <FinanceEmptyState
            kind="activity"
            compact
            title="No posted activity yet"
            description="Record a transaction to see it here."
            action={
              !isArchived ? (
                <Button onPress={onAddTransaction}>
                  <Plus size={16} aria-hidden="true" /> Add transaction
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={styles.activityRows}>
            {activity.map((transaction) => (
              <div className={styles.activityRow} key={transaction.id}>
                <TransactionRow
                  title={transaction.title}
                  category={transaction.category}
                  categoryIcon={transaction.categoryIcon}
                  date={transaction.date}
                  status={transaction.status}
                  amountMinor={transaction.amountMinor}
                  currency={transaction.currency}
                  type={transaction.type}
                  semanticType={transaction.semanticType}
                  onPress={() => onOpenTransaction(transaction.id)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <Sheet visible={renameOpen} title="Rename account" onClose={() => setRenameOpen(false)}>
        <form className={styles.sheetForm} onSubmit={(event) => void submitRename(event)}>
          <Label htmlFor="account-name">Account name</Label>
          <Input
            id="account-name"
            accessibilityLabel="Account name"
            value={nameDraft}
            onChangeText={setNameDraft}
            maxLength={80}
            autoFocus
            required
          />
          {renameError || error ? (
            <p className={styles.errorMessage} role="alert">
              {renameError ?? error}
            </p>
          ) : null}
          <Button type="submit" disabled={isBusy || !nameDraft.trim()}>
            {isBusy ? 'Saving…' : 'Save name'}
          </Button>
          <Button type="button" variant="outline" onPress={() => setRenameOpen(false)}>
            Cancel
          </Button>
        </form>
      </Sheet>
      <Sheet visible={archiveOpen} title="Archive account?" onClose={() => setArchiveOpen(false)}>
        <div className={styles.sheetForm}>
          <Typography variant="small">
            Past transactions and balances remain in your history. This account will no longer be
            available for new activity.
          </Typography>
          {error ? (
            <p className={styles.errorMessage} role="alert">
              {error}
            </p>
          ) : null}
          <Button variant="destructive" disabled={isBusy} onPress={() => void onArchive()}>
            {isBusy ? 'Archiving…' : `Archive ${account.name}`}
          </Button>
          <Button variant="outline" onPress={() => setArchiveOpen(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
