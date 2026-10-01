'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ReceiptText, UsersRound } from 'lucide-react';
import { Button, Input, Typography } from '@finapp/ui/web';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyInput } from './CurrencyInput';
import { DateTimePicker } from './DateTimePicker';

export type TransactionFormType = 'expense' | 'income' | 'transfer';
export type TransactionFormOption = { id: string; name: string; currency?: string; icon?: string };
export type TransactionFormScreenProps = {
  mode: 'create' | 'edit';
  type: TransactionFormType;
  title: string;
  amount: string;
  merchant: string;
  note: string;
  occurredAt: number;
  hasTime: boolean;
  currency: string;
  accounts: readonly TransactionFormOption[];
  categories: readonly TransactionFormOption[];
  accountId: string;
  categoryId: string;
  destinationId: string;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  dataError?: string | null;
  isDefaultAccount?: boolean;
  isDefaultCategory?: boolean;
  savingDefault?: boolean;
  onTypeChange: (type: TransactionFormType) => void;
  onTitleChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onMerchantChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onAccountChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
  onDestinationChange: (id: string) => void;
  onDateChange: (value: number) => void;
  onHasTimeChange: (enabled: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onToggleDefault?: (selection: 'account' | 'category') => void;
  onAddAccount?: () => void;
  onManageCategories?: () => void;
  onSplitExpense?: () => void;
  signedIn?: boolean;
  unavailableMessage?: string;
  submitDisabled?: boolean;
};

export function TransactionFormScreen(props: TransactionFormScreenProps) {
  const {
    mode,
    type,
    title,
    amount,
    merchant,
    note,
    occurredAt,
    hasTime,
    currency,
    accounts,
    categories,
    signedIn = true,
    unavailableMessage,
    accountId,
    categoryId,
    destinationId,
    loading = false,
    saving = false,
    error,
    dataError,
    isDefaultAccount = false,
    isDefaultCategory = false,
    savingDefault = false,
    onTypeChange,
    onTitleChange,
    onAmountChange,
    onMerchantChange,
    onNoteChange,
    onAccountChange,
    onCategoryChange,
    onDestinationChange,
    onDateChange,
    onHasTimeChange,
    onSubmit,
    onBack,
    onToggleDefault,
    onAddAccount,
    onManageCategories,
    onSplitExpense,
    submitDisabled = false,
  } = props;
  const account = accounts.find((item) => item.id === accountId);
  const category = categories.find((item) => item.id === categoryId);
  const destinations = accounts.filter(
    (item) => item.id !== accountId && item.currency === account?.currency,
  );
  if (!signedIn)
    return (
      <main className="finance-page">
        <p>Sign in to manage your personal transactions.</p>
      </main>
    );
  if (unavailableMessage)
    return (
      <main className="finance-page">
        <p className="finance-form-error" role="alert">
          {unavailableMessage}
        </p>
      </main>
    );
  if (loading)
    return (
      <main className="finance-page">
        <p className="finance-muted" role="status">
          Loading transaction options…
        </p>
      </main>
    );
  return (
    <main
      className="finance-page"
      style={{ display: 'grid', gap: 20, maxWidth: 1060, marginInline: 'auto', width: '100%' }}
    >
      <header style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: 14 }}>
        <button
          type="button"
          className="finance-secondary-action"
          onClick={onBack}
          aria-label="Back to transactions"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ margin: 0 }}>
            {mode === 'create' ? 'New transaction' : 'Edit transaction'}
          </h1>
          <p className="finance-muted" style={{ margin: '4px 0 0' }}>
            {mode === 'create'
              ? 'Add an income, expense, or transfer.'
              : 'Update the details of this transaction.'}
          </p>
        </div>
      </header>
      <form
        onSubmit={onSubmit}
        style={{
          display: 'grid',
          gap: 18,
          padding: 22,
          border: '1px solid var(--finance-line)',
          borderRadius: 18,
          background: 'var(--finapp-surface-raised)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px,.8fr) minmax(0,1.6fr)',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <div>
            <Typography variant="small" style={{ display: 'block', marginBottom: 8 }}>
              Transaction type
            </Typography>
            <div role="group" aria-label="Transaction type" style={{ display: 'grid', gap: 6 }}>
              {(['expense', 'income', 'transfer'] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={type === value ? 'primary' : 'outline'}
                  aria-pressed={type === value}
                  onPress={() => onTypeChange(value)}
                >
                  {value[0]!.toUpperCase() + value.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {type !== 'transfer' && (
              <label className="finance-form-field">
                <span>Title</span>
                <Input
                  accessibilityLabel="Transaction title"
                  placeholder="Describe this transaction"
                  value={title}
                  onChangeText={onTitleChange}
                  maxLength={120}
                />
              </label>
            )}
            <label className="finance-form-field">
              <span>Amount</span>
              <CurrencyInput
                currency={account?.currency ?? currency}
                value={amount}
                onChangeText={onAmountChange}
              />
            </label>
          </div>
        </div>
        {type !== 'transfer' && (
          <label className="finance-form-field">
            <span>Category</span>
            <select
              className="finance-form-input"
              aria-label="Category"
              value={categoryId}
              onChange={(event) => onCategoryChange(event.currentTarget.value)}
            >
              <option value="">Choose category</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {category && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <CategoryIcon label={category.name} icon={category.icon} />
                <span className="finance-muted">{category.name}</span>
              </div>
            )}
          </label>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
            gap: 14,
          }}
        >
          <label className="finance-form-field">
            <span>{type === 'transfer' ? 'From account' : 'Account'}</span>
            <select
              className="finance-form-input"
              aria-label="Account"
              value={accountId}
              onChange={(event) => onAccountChange(event.currentTarget.value)}
            >
              <option value="">Choose account</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.currency ?? 'INR'}
                </option>
              ))}
            </select>
          </label>
          {type === 'transfer' && (
            <label className="finance-form-field">
              <span>To account</span>
              <select
                className="finance-form-input"
                aria-label="Destination account"
                value={destinationId}
                onChange={(event) => onDestinationChange(event.currentTarget.value)}
              >
                <option value="">Choose destination</option>
                {destinations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.currency ?? 'INR'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="finance-form-field">
            <span>Date</span>
            <DateTimePicker value={occurredAt} showTime={hasTime} onChange={onDateChange} />
          </label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={hasTime}
            onChange={(event) => onHasTimeChange(event.currentTarget.checked)}
          />
          <span>Include time</span>
        </label>
        <label className="finance-form-field">
          <span>Merchant / Payee (optional)</span>
          <Input
            accessibilityLabel="Merchant or payee"
            placeholder="Store or person"
            value={merchant}
            onChangeText={onMerchantChange}
            maxLength={120}
          />
        </label>
        <label className="finance-form-field">
          <span>Notes (optional)</span>
          <textarea
            className="finance-form-input"
            aria-label="Transaction note"
            placeholder="Add a note"
            value={note}
            onChange={(event) => onNoteChange(event.currentTarget.value)}
            maxLength={500}
            rows={3}
          />
        </label>
        {mode === 'create' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
              gap: 10,
            }}
          >
            <div className="finance-secondary-action" style={{ justifyContent: 'space-between' }}>
              <span>Default account</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={savingDefault || !account}
                onPress={() => onToggleDefault?.('account')}
              >
                {isDefaultAccount ? 'Clear default' : 'Set default'}
              </Button>
            </div>
            {type !== 'transfer' && (
              <div className="finance-secondary-action" style={{ justifyContent: 'space-between' }}>
                <span>Default category</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={savingDefault || !category}
                  onPress={() => onToggleDefault?.('category')}
                >
                  {isDefaultCategory ? 'Clear default' : 'Set default'}
                </Button>
              </div>
            )}
          </div>
        )}
        {mode === 'create' && type === 'expense' && (
          <button
            type="button"
            className="finance-secondary-action"
            onClick={onSplitExpense}
            style={{ justifyContent: 'space-between', minHeight: 64 }}
          >
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <UsersRound size={19} />
              <span>Split this expense</span>
            </span>
            <ArrowRight size={18} />
          </button>
        )}
        {accounts.length === 0 && (
          <div className="finance-muted">
            No available accounts.{' '}
            <button type="button" className="finance-inline-link" onClick={onAddAccount}>
              Add an account
            </button>
          </div>
        )}
        {type !== 'transfer' && categories.length === 0 && (
          <div className="finance-muted">
            No available categories.{' '}
            <button type="button" className="finance-inline-link" onClick={onManageCategories}>
              Create a category
            </button>
          </div>
        )}
        {dataError && (
          <p className="finance-form-error" role="alert">
            Transaction options could not be opened: {dataError}
          </p>
        )}
        {error && (
          <p className="finance-form-error" role="alert">
            {error}
          </p>
        )}
        <footer
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            borderTop: '1px solid var(--finance-line)',
            paddingTop: 16,
          }}
        >
          <Button type="button" variant="outline" onPress={onBack}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || submitDisabled}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add transaction' : 'Save changes'}{' '}
            <ReceiptText size={17} />
          </Button>
        </footer>
      </form>
    </main>
  );
}
