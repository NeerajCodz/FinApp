'use client';

import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Card, Checkbox, Tabs } from '@finapp/ui/web';
import { CurrencyInput } from './CurrencyInput';
import { SemanticMarker } from './SemanticMarker';
import { formatMinor } from '@convex/shared/money';

export type GroupExpenseMethod = 'equal' | 'exact' | 'percentage' | 'shares';
export type GroupExpenseGroupOption = { id: string; name: string; currency?: string };
export type GroupExpenseAccountOption = { id: string; name: string };
export type GroupExpenseMemberOption = { userId: string; name: string };
export type GroupExpenseShare = { userId: string; amountMinor: bigint };
export type GroupExpenseFormScreenProps = {
  signedIn: boolean;
  fixedGroupId?: string;
  groups: readonly GroupExpenseGroupOption[];
  selectedGroupId: string;
  groupName?: string;
  currency: string;
  accounts: readonly GroupExpenseAccountOption[];
  selectedAccountId: string;
  members: readonly GroupExpenseMemberOption[];
  payerName: string;
  title: string;
  amount: string;
  method: GroupExpenseMethod;
  selectedMemberIds: readonly string[];
  basis: Readonly<Record<string, string>>;
  shares: readonly GroupExpenseShare[];
  totalMinor: bigint | null;
  validation?: string;
  error?: string;
  saving?: boolean;
  onGroupChange: (id: string) => void;
  onAccountChange: (id: string) => void;
  onTitleChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onMethodChange: (method: GroupExpenseMethod) => void;
  onParticipantChange: (userId: string, selected: boolean) => void;
  onBasisChange: (userId: string, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onCreateGroup?: () => void;
  onSignIn?: () => void;
};

export function GroupExpenseFormScreen(props: GroupExpenseFormScreenProps) {
  const {
    signedIn,
    fixedGroupId,
    groups,
    selectedGroupId,
    groupName,
    currency,
    accounts,
    selectedAccountId,
    members,
    payerName,
    title,
    amount,
    method,
    selectedMemberIds,
    basis,
    shares,
    totalMinor,
    validation,
    error,
    saving = false,
    onGroupChange,
    onAccountChange,
    onTitleChange,
    onAmountChange,
    onMethodChange,
    onParticipantChange,
    onBasisChange,
    onSubmit,
    onBack,
    onCreateGroup,
    onSignIn,
  } = props;
  if (!signedIn)
    return (
      <main className="finance-page">
        <section className="finance-welcome">
          <p className="finance-kicker">SHARED EXPENSE</p>
          <h1>Split a cost fairly.</h1>
          <p>Sign in to create an offline-first shared expense for a saved group.</p>
          <button type="button" className="finance-primary-link" onClick={onSignIn}>
            Sign in <ArrowRight size={16} />
          </button>
        </section>
      </main>
    );
  return (
    <main className="finance-page">
      <header className="finance-page-heading">
        <button
          type="button"
          className="finance-secondary-action"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ flex: 1, margin: 0 }}>Split expense{groupName ? ` · ${groupName}` : ''}</h1>
        <SemanticMarker type="split" />
      </header>
      <div className="finance-accounts-layout" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <Card className="finance-form-panel">
          <form className="finance-form" onSubmit={onSubmit}>
            {!fixedGroupId && (
              <label className="finance-form-field">
                <span>Group</span>
                <select
                  aria-label="Group"
                  className="finance-form-input"
                  value={selectedGroupId}
                  onChange={(event) => onGroupChange(event.currentTarget.value)}
                >
                  <option value="">Choose a saved group</option>
                  {groups.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.currency ?? 'INR'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!fixedGroupId && !groups.length && (
              <p className="finance-form-note">No saved groups yet.</p>
            )}
            {!fixedGroupId && (
              <button type="button" className="finance-secondary-action" onClick={onCreateGroup}>
                Create a group <ArrowRight size={16} />
              </button>
            )}
            {selectedGroupId && (
              <>
                <CurrencyInput currency={currency} value={amount} onChangeText={onAmountChange} />
                <label className="finance-form-field">
                  <span>What was it for?</span>
                  <input
                    className="finance-form-input"
                    aria-label="What was it for?"
                    value={title}
                    onChange={(event) => onTitleChange(event.currentTarget.value)}
                    maxLength={120}
                    placeholder="Dinner, travel, supplies"
                  />
                </label>
                <div className="finance-form-field">
                  <span>Paid by</span>
                  <strong>{payerName}</strong>
                  <p className="finance-form-note">
                    Recorded from your account. Another payer is not supported here.
                  </p>
                </div>
                <label className="finance-form-field">
                  <span>Account in {currency}</span>
                  <select
                    aria-label={`Account in ${currency}`}
                    className="finance-form-input"
                    value={selectedAccountId}
                    onChange={(event) => onAccountChange(event.currentTarget.value)}
                  >
                    <option value="">Choose an account</option>
                    {accounts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!accounts.length && (
                  <p className="finance-form-note">
                    No account uses {currency}. Add one before saving a split.
                  </p>
                )}
                <Tabs
                  label="Split method"
                  tabs={[
                    { label: 'Equal', value: 'equal' },
                    { label: 'Exact', value: 'exact' },
                    { label: '%', value: 'percentage' },
                    { label: 'Shares', value: 'shares' },
                  ]}
                  value={method}
                  onChange={(value) => onMethodChange(value as GroupExpenseMethod)}
                />
                <section className="finance-form-field">
                  <span>Group members sharing this expense</span>
                  <ul className="finance-record-list">
                    {members.map((member) => {
                      const share = shares.find((item) => item.userId === member.userId);
                      return (
                        <li key={member.userId}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <Checkbox
                              checked={selectedMemberIds.includes(member.userId)}
                              onChange={(checked) => onParticipantChange(member.userId, checked)}
                              label={member.name}
                            />
                            {share && <small>{formatMinor(share.amountMinor, currency)}</small>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {members.length === 1 && (
                    <p className="finance-form-note">
                      Other group members will be available once their memberships are saved on this
                      device.
                    </p>
                  )}
                </section>
                {method !== 'equal' &&
                  selectedMemberIds.map((memberId) => {
                    const member = members.find((item) => item.userId === memberId);
                    const label =
                      method === 'exact'
                        ? `Amount for ${member?.name ?? 'Member'}`
                        : method === 'percentage'
                          ? `Percentage for ${member?.name ?? 'Member'}`
                          : `Shares for ${member?.name ?? 'Member'}`;
                    return (
                      <label className="finance-form-field" key={memberId}>
                        <span>{label}</span>
                        <input
                          className="finance-form-input"
                          aria-label={label}
                          type="number"
                          min="0"
                          step={method === 'shares' ? '1' : '0.01'}
                          placeholder={
                            method === 'percentage'
                              ? '0–100%'
                              : method === 'shares'
                                ? 'Whole shares'
                                : currency
                          }
                          value={basis[memberId] ?? ''}
                          onChange={(event) => onBasisChange(memberId, event.currentTarget.value)}
                        />
                      </label>
                    );
                  })}
                <div
                  className="finance-form-field"
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>Total</span>
                  <strong className="finance-record-amount">
                    {totalMinor !== null ? formatMinor(totalMinor, currency) : currency}
                  </strong>
                </div>
              </>
            )}
            {validation && (
              <p className="finance-form-error" role="alert">
                {validation}
              </p>
            )}
            {error && (
              <p className="finance-form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={saving || Boolean(validation)}>
              {saving ? 'Saving…' : 'Save split'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
