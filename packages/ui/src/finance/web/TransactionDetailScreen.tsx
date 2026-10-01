'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Pencil, ReceiptText } from 'lucide-react';
import { Button, Empty, Typography } from '@finapp/ui/web';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';
import { SemanticMarker } from './SemanticMarker';
import { SettingsRow } from './ScreenPrimitives';
import type { SemanticType, TransactionType } from '../types';

export type TransactionDetailScreenProps = {
  title: string;
  amountMinor: bigint;
  currency: string;
  type: TransactionType;
  semanticType: SemanticType;
  status?: string;
  category: string;
  categoryIcon?: string;
  account: string;
  destination?: string;
  date: string;
  merchant?: string;
  note?: string;
  loading?: boolean;
  error?: string | null;
  unavailable?: boolean;
  missingId?: boolean;
  canEdit?: boolean;
  canDuplicate?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onRetry?: () => void;
};

export function TransactionDetailScreen(props: TransactionDetailScreenProps) {
  const {
    title,
    amountMinor,
    currency,
    type,
    semanticType,
    status,
    category,
    categoryIcon,
    account,
    destination,
    date,
    merchant,
    note,
    loading = false,
    error,
    unavailable = false,
    missingId = false,
    canEdit = false,
    canDuplicate = false,
    onBack,
    onEdit,
    onDuplicate,
    onRetry,
  } = props;
  if (missingId)
    return (
      <main className="finance-page">
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={18} /> Back to transactions
        </Button>
        <Empty
          title="Missing transaction ID"
          description="Choose a transaction from your saved activity."
        />
      </main>
    );
  if (loading)
    return (
      <main className="finance-page">
        <p className="finance-muted" role="status">
          Loading transaction…
        </p>
      </main>
    );
  if (error)
    return (
      <main className="finance-page">
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={18} /> Back to transactions
        </Button>
        <p className="finance-form-error" role="alert">
          Transaction data could not be opened: {error}
        </p>
        {onRetry && (
          <Button variant="outline" onPress={onRetry}>
            Try again
          </Button>
        )}
      </main>
    );
  if (unavailable)
    return (
      <main className="finance-page">
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={18} /> Back to transactions
        </Button>
        <Empty
          title="Transaction unavailable"
          description="This transaction was removed or is no longer available in your saved data."
        />
      </main>
    );
  return (
    <main
      className="finance-page"
      style={{ display: 'grid', gap: 20, maxWidth: 1240, marginInline: 'auto' }}
    >
      <button
        type="button"
        className="finance-inline-link"
        onClick={onBack}
        style={{ justifySelf: 'start' }}
      >
        <ArrowLeft size={18} /> Back to transactions
      </button>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(320px,1fr)',
          gap: 20,
          border: '1px solid var(--finance-line)',
          borderRadius: 20,
          padding: 22,
          background: 'var(--finapp-surface-raised)',
        }}
      >
        <div style={{ display: 'grid', alignContent: 'start', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <CategoryIcon label={category} icon={categoryIcon} />
            <div>
              <h1 style={{ margin: 0 }}>{title}</h1>
              {merchant && (
                <p className="finance-muted" style={{ margin: '4px 0 0' }}>
                  {merchant}
                </p>
              )}
            </div>
          </div>
          <Money amountMinor={amountMinor} currency={currency} type={type} size="display" />
          <Typography variant="small" style={{ color: 'var(--finapp-foreground-muted)' }}>
            {date}
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SemanticMarker type={semanticType} />
            {status && <span className="finance-muted">{status}</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {canEdit && (
              <Button onPress={onEdit}>
                <Pencil size={17} /> Edit transaction
              </Button>
            )}
            {canDuplicate && (
              <Button variant="outline" onPress={onDuplicate}>
                <ReceiptText size={17} /> Duplicate transaction <ArrowRight size={17} />
              </Button>
            )}
          </div>
          {note && (
            <section
              style={{ border: '1px solid var(--finance-line)', borderRadius: 14, padding: 16 }}
            >
              <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Transaction notes</h2>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{note}</p>
            </section>
          )}
        </div>
        <section
          aria-label="Transaction details"
          style={{
            alignSelf: 'start',
            border: '1px solid var(--finance-line)',
            borderRadius: 16,
            paddingInline: 14,
          }}
        >
          <SettingsRow
            label="Category"
            leadingIcon={<CategoryIcon label={category} icon={categoryIcon} />}
            value={category}
          />
          <SettingsRow
            label="Type"
            value={semanticType === 'split' ? 'Split expense' : semanticType}
          />
          <SettingsRow label="Account" value={account} />
          {destination && <SettingsRow label="Destination" value={destination} />}
          <SettingsRow label="Date & time" value={date} />
          <SettingsRow label="Status" value={status ?? 'Saved'} />
          {merchant && <SettingsRow label="Merchant / Payee" value={merchant} />}
        </section>
      </section>
    </main>
  );
}
