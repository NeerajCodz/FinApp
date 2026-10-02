'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Info,
  Landmark,
  Wallet,
  HandCoins,
  Boxes,
} from 'lucide-react';
import { Button, Input, Label, Select, Typography } from '@finapp/ui/web';
import { CurrencyInput } from './CurrencyInput';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIcon, EntityIconPicker } from './EntityIconPicker';
import { EntityActivityTable, type EntityActivity } from './EntityActivityTable';
import styles from './AccountFormScreen.module.css';
import { FinanceEmptyState } from './FinanceEmptyState';

export type AccountFormValue = {
  name: string;
  type: 'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other';
  customType: string;
  currency: string;
  openingBalance: string;
  icon?: string;
  color?: string;
  isIncludedInTotal: boolean;
  notes?: string;
  provider?: string;
  accountNumber?: string;
  openedAt?: number;
  includeInAnalytics?: boolean;
};
const accountTypes = [
  {
    label: 'Bank account',
    value: 'bank',
    icon: Landmark,
    text: 'Checking or savings accounts from banks and financial institutions.',
  },
  { label: 'Cash', value: 'cash', icon: Banknote, text: 'Physical cash you keep with you.' },
  {
    label: 'Credit card',
    value: 'card',
    icon: CreditCard,
    text: 'Track payments and balances on your credit cards.',
  },
  { label: 'Wallet', value: 'wallet', icon: Wallet, text: 'Digital wallets and payment accounts.' },
  {
    label: 'Loan',
    value: 'loan',
    icon: HandCoins,
    text: 'Loans you owe, such as home and personal loans.',
  },
  {
    label: 'Custom',
    value: 'other',
    icon: Boxes,
    text: 'Other accounts, including savings vaults and investments.',
  },
] as const;
export function AccountFormScreen({
  title,
  subtitle,
  value,
  currencies,
  loading = false,
  saving = false,
  error,
  onChange,
  onSubmit,
  onBack,
  submitLabel,
  mode = 'create',
  createdAt,
  activity = [],
  onOpenTransaction,
  onViewTransactions,
  isPrimary,
  onPrimaryChange,
}: {
  title: string;
  subtitle: string;
  value: AccountFormValue;
  currencies: readonly string[];
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onChange: (value: AccountFormValue) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  submitLabel: string;
  mode?: 'create' | 'edit';
  createdAt?: number;
  activity?: readonly EntityActivity[];
  onOpenTransaction?: (id: string) => void;
  onViewTransactions?: () => void;
  isPrimary?: boolean;
  onPrimaryChange?: (value: boolean) => void;
}) {
  const edit = mode === 'edit';
  const set = (patch: Partial<AccountFormValue>) => onChange({ ...value, ...patch });
  const icon = (
    <span className={styles.iconTile} style={{ color: value.color ?? 'var(--finapp-primary)' }}>
      {value.icon ? (
        <EntityIcon value={value.icon} size={36} color={value.color} />
      ) : (
        <Landmark size={36} />
      )}
    </span>
  );
  const selector = (
    <Select
      label=""
      id="account-type"
      value={value.type}
      onChange={(next) =>
        set({
          type: next as AccountFormValue['type'],
          customType: next === 'other' ? value.customType : '',
        })
      }
      options={accountTypes.map((type) => ({ value: type.value, label: type.label }))}
    />
  );
  const currency = (
    <Select
      label=""
      id="account-currency"
      value={value.currency}
      onChange={(next) => set({ currency: next })}
      options={[
        ...(!value.currency ? [{ value: '', label: 'Choose currency' }] : []),
        ...currencies.map((code) => ({
          value: code,
          label: `${code} – ${new Intl.DisplayNames(['en'], { type: 'currency' }).of(code)}`,
        })),
      ]}
    />
  );
  const [revealNumber, setRevealNumber] = useState(false);
  const inclusion = (
    <label className={styles.setting}>
      <span>
        <strong>Include in total</strong>
        <small>Include this account in your total balance.</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value.isIncludedInTotal}
        onChange={(event) => set({ isIncludedInTotal: event.target.checked })}
      />
    </label>
  );
  const appearance = (
    <div className={styles.appearance}>
      {icon}
      <EntityIconPicker
        mode="lucide"
        value={value.icon}
        onChange={(icon) => set({ icon })}
        label={edit ? 'Change account icon' : 'Choose account icon'}
      />
      <EntityColorPicker
        value={value.color}
        onChange={(color) => set({ color })}
        label="Choose color"
      />
    </div>
  );
  const notes = (
    <textarea
      id="account-notes"
      value={value.notes ?? ''}
      onChange={(event) => set({ notes: event.target.value })}
      maxLength={200}
      placeholder="e.g. Primary bank account, office expenses, etc."
      rows={3}
    />
  );
  return (
    <main className={styles.page}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={18} /> Accounts {edit && <span>› {title} › Edit</span>}
      </button>
      <header className={styles.header}>
        {edit && icon}
        <div>
          <Typography variant="title">{title}</Typography>
          <p>{subtitle}</p>
        </div>
      </header>
      <form className={edit ? styles.editLayout : styles.createLayout} onSubmit={onSubmit}>
        <section className={`${styles.panel} ${edit ? styles.basic : styles.rowForm}`}>
          {edit && (
            <div>
              <h2>Basic information</h2>
              <p>Update the essential details for this account.</p>
            </div>
          )}
          {!edit && (
            <div className={styles.row}>
              <div>
                <Label>Account icon</Label>
                <p>Choose an icon to identify this account.</p>
              </div>
              {appearance}
            </div>
          )}
          <div className={styles.row}>
            <div>
              <Label htmlFor="account-name">Account name</Label>
              {!edit && <p>Give your account a clear name.</p>}
            </div>
            <Input
              id="account-name"
              accessibilityLabel="Account name"
              value={value.name}
              onChangeText={(name) => set({ name })}
              placeholder="e.g. HDFC Bank, Cash, PayPal"
              maxLength={80}
              required
            />
          </div>
          <div className={styles.row}>
            <div>
              <Label htmlFor="account-type">Account type</Label>
              {!edit && <p>Select the type of account.</p>}
            </div>
            {selector}
          </div>
          {value.type === 'other' && (
            <div className={styles.row}>
              <Label htmlFor="account-custom">Custom type</Label>
              <Input
                id="account-custom"
                value={value.customType}
                onChangeText={(customType) => set({ customType })}
                maxLength={40}
                required
              />
            </div>
          )}
          {!edit && (
            <div className={styles.row}>
              <div>
                <Label htmlFor="account-currency">Currency</Label>
                <p>Choose the account currency.</p>
              </div>
              {currency}
            </div>
          )}
          <div className={styles.row}>
            <div>
              <Label>Opening balance</Label>
              {!edit && <p>Set the initial balance in this account.</p>}
            </div>
            {value.currency ? (
              <CurrencyInput
                currency={value.currency}
                value={value.openingBalance}
                onChangeText={(openingBalance) => set({ openingBalance })}
              />
            ) : (
              <p>Choose a currency first.</p>
            )}
          </div>
          {!edit && (
            <div className={styles.row}>
              <div>
                <Label>Include in total</Label>
                <p>Include this account in your total balance.</p>
              </div>
              <label className={styles.inlineSwitch}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={value.isIncludedInTotal}
                  onChange={(event) => set({ isIncludedInTotal: event.target.checked })}
                />{' '}
                Include in total
              </label>
            </div>
          )}
          {edit && (
            <div className={styles.row}>
              <Label htmlFor="account-number">
                Account number <span>(optional)</span>
              </Label>
              <div className={styles.secret}>
                <Input
                  id="account-number"
                  type={revealNumber ? 'text' : 'password'}
                  value={value.accountNumber ?? ''}
                  onChangeText={(accountNumber) => set({ accountNumber })}
                  autoComplete="off"
                  maxLength={80}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onPress={() => setRevealNumber(!revealNumber)}
                >
                  {revealNumber ? 'Hide' : 'Reveal / edit'}
                </Button>
              </div>
            </div>
          )}
          {edit && (
            <div className={styles.row}>
              <Label htmlFor="account-provider">Bank / Provider</Label>
              <Input
                id="account-provider"
                value={value.provider ?? ''}
                onChangeText={(provider) => set({ provider })}
                maxLength={80}
              />
            </div>
          )}
          <div className={styles.row}>
            <div>
              <Label htmlFor="account-notes">
                Notes <span>(optional)</span>
              </Label>
              {!edit && <p>Add any additional information.</p>}
            </div>
            {notes}
          </div>
          {!edit && (
            <div className={styles.footer}>
              <Button type="button" variant="outline" onPress={onBack}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  loading ||
                  saving ||
                  !value.name.trim() ||
                  !value.currency ||
                  !value.color ||
                  (value.type === 'other' && !value.customType.trim())
                }
              >
                {saving ? 'Saving…' : submitLabel}
              </Button>
            </div>
          )}
        </section>
        {edit ? (
          <aside className={styles.stack}>
            <section className={styles.panel}>
              <h2>Account icon</h2>
              <p>Choose an icon to help you easily identify this account.</p>
              {appearance}
            </section>
            <section className={styles.panel}>
              <h2>Settings</h2>
              <p>Manage how this account works in your finances.</p>
              <label className={styles.setting}>
                <span>
                  <strong>Include in analytics</strong>
                  <small>Show this account in charts and insights.</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={value.includeInAnalytics !== false}
                  onChange={(event) => set({ includeInAnalytics: event.target.checked })}
                />
              </label>
              {inclusion}
              {onPrimaryChange && (
                <label className={styles.setting}>
                  <span>
                    <strong>Set as primary account</strong>
                    <small>Use as the default account for new transactions.</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={isPrimary === true}
                    onChange={(event) => onPrimaryChange(event.target.checked)}
                  />
                </label>
              )}
            </section>
            <section className={styles.panel}>
              <h2>Metadata</h2>
              <p>Additional information about this account.</p>
              <div className={styles.metadata}>
                <div>
                  <Label htmlFor="account-opened">Opened on</Label>
                  <input
                    id="account-opened"
                    type="date"
                    className={styles.readonly}
                    value={
                      value.openedAt ? new Date(value.openedAt).toISOString().slice(0, 10) : ''
                    }
                    onChange={(event) =>
                      set({
                        openedAt: event.target.value
                          ? Date.parse(`${event.target.value}T00:00:00Z`)
                          : undefined,
                      })
                    }
                  />
                  <p>
                    Added{' '}
                    {createdAt ? new Date(createdAt).toLocaleDateString() : 'date unavailable'}
                  </p>
                </div>
                <div>
                  <Label htmlFor="account-currency">Currency</Label>
                  {currency}
                </div>
              </div>
            </section>
          </aside>
        ) : (
          <aside className={`${styles.panel} ${styles.types}`}>
            <div className={styles.about}>
              <Info size={26} />
              <div>
                <h2>About account types</h2>
                <p>
                  Choose the type that best matches your account. This helps categorize and analyze
                  your finances.
                </p>
              </div>
            </div>
            {accountTypes.map((type) => (
              <div className={styles.typeInfo} key={type.value}>
                <span>
                  <type.icon size={25} />
                </span>
                <div>
                  <strong>{type.label}</strong>
                  <p>{type.text}</p>
                </div>
              </div>
            ))}
          </aside>
        )}
        {edit && (
          <section className={`${styles.panel} ${styles.recent}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Recent transactions</h2>
                <p>Showing the five most recent transactions from this account.</p>
              </div>
              {onViewTransactions && (
                <Button type="button" variant="outline" onPress={onViewTransactions}>
                  View all transactions
                </Button>
              )}
            </div>
            {activity.length ? (
              <EntityActivityTable rows={activity.slice(0, 5)} onOpen={onOpenTransaction} />
            ) : (
              <FinanceEmptyState
                kind="activity"
                compact
                title="No posted transactions yet"
                description="Transactions from this account will appear here."
              />
            )}
          </section>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {edit && (
          <div className={`${styles.footer} ${styles.full}`}>
            <Button type="button" variant="outline" onPress={onBack}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                saving ||
                !value.name.trim() ||
                !value.currency ||
                !value.color ||
                (value.type === 'other' && !value.customType.trim())
              }
            >
              {saving ? 'Saving…' : submitLabel}
            </Button>
          </div>
        )}
      </form>
    </main>
  );
}
