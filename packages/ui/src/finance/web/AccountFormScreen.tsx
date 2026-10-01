'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Landmark } from 'lucide-react';
import { Button, IconButton, Input, Label, Sheet, Typography } from '@finapp/ui/web';
import { CurrencyInput } from './CurrencyInput';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIcon, EntityIconPicker } from './EntityIconPicker';

export type AccountFormValue = {
  name: string;
  type: 'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other';
  customType: string;
  currency: string;
  openingBalance: string;
  icon?: string;
  color?: string;
  isIncludedInTotal: boolean;
};

const accountTypes = [
  ['Cash', 'cash'],
  ['Bank', 'bank'],
  ['Card', 'card'],
  ['Wallet', 'wallet'],
  ['Loan', 'loan'],
  ['Custom', 'other'],
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
}) {
  const [sheet, setSheet] = useState<'type' | 'currency' | null>(null);
  const set = (patch: Partial<AccountFormValue>) => onChange({ ...value, ...patch });
  const field = { display: 'grid', gap: 7 } as const;
  const buttonStyle = {
    minHeight: 48,
    justifyContent: 'space-between',
    paddingInline: 15,
  } as const;
  return (
    <main
      className="finance-page"
      style={{ gap: 20, maxWidth: 1180, width: '100%', marginInline: 'auto' }}
    >
      <IconButton
        label="Back to accounts"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={onBack}
      >
        <ArrowLeft size={19} aria-hidden="true" />
      </IconButton>
      <header style={{ display: 'grid', gap: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            aria-hidden="true"
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              background: value.color ?? 'var(--finapp-surface-raised)',
              color: value.color ? '#fff' : 'var(--finapp-foreground)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {value.icon ? (
              <EntityIcon value={value.icon} size={20} color={value.color ? '#fff' : undefined} />
            ) : (
              <Landmark size={20} />
            )}
          </span>
          <div>
            <Typography variant="title">{title}</Typography>
            <Typography variant="small">{subtitle}</Typography>
          </div>
        </div>
      </header>
      <form
        onSubmit={onSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 410px), 1fr))',
          gap: 16,
        }}
      >
        <section
          style={{
            display: 'grid',
            alignContent: 'start',
            gap: 19,
            padding: 22,
            border: '1px solid var(--finapp-border)',
            borderRadius: 18,
            background: 'var(--finapp-surface-raised)',
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <Typography variant="bodyLarge">Basic information</Typography>
            <Typography variant="small">Set the details used throughout your finances.</Typography>
          </div>
          <div style={field}>
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              accessibilityLabel="Account name"
              value={value.name}
              onChangeText={(name) => set({ name })}
              placeholder="e.g. Everyday account"
              maxLength={80}
              required
            />
          </div>
          <div style={field}>
            <Label>Account type</Label>
            <Button
              type="button"
              variant="outline"
              aria-haspopup="dialog"
              onPress={() => setSheet('type')}
              style={buttonStyle}
            >
              <span>{accountTypes.find(([_, type]) => type === value.type)?.[0]}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </Button>
          </div>
          {value.type === 'other' && (
            <div style={field}>
              <Label htmlFor="account-custom-type">Custom type</Label>
              <Input
                id="account-custom-type"
                accessibilityLabel="Custom account type"
                value={value.customType}
                onChangeText={(customType) => set({ customType })}
                maxLength={40}
                required
              />
            </div>
          )}
          <div style={field}>
            <Label>Currency</Label>
            <Button
              type="button"
              variant="outline"
              aria-haspopup="dialog"
              onPress={() => setSheet('currency')}
              style={buttonStyle}
            >
              <span>{value.currency || 'Choose currency'}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </Button>
          </div>
          <div style={field}>
            <Label>Opening balance · {value.currency}</Label>
            {value.currency ? (
              <CurrencyInput
                currency={value.currency}
                value={value.openingBalance}
                onChangeText={(openingBalance) => set({ openingBalance })}
              />
            ) : (
              <Typography variant="small">Choose a currency first.</Typography>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={value.isIncludedInTotal}
              onChange={(event) => set({ isIncludedInTotal: event.target.checked })}
            />
            <span>
              <strong>Include in total</strong>
              <br />
              <Typography variant="small">Count this account in your total balance.</Typography>
            </span>
          </label>
        </section>
        <aside style={{ display: 'grid', alignContent: 'start', gap: 16 }}>
          <section
            style={{
              display: 'grid',
              gap: 14,
              padding: 22,
              border: '1px solid var(--finapp-border)',
              borderRadius: 18,
              background: 'var(--finapp-surface-raised)',
            }}
          >
            <div>
              <Typography variant="bodyLarge">Account icon</Typography>
              <Typography variant="small">
                Choose a Lucide icon to identify this account.
              </Typography>
            </div>
            <EntityIconPicker
              mode="lucide"
              value={value.icon}
              onChange={(icon) => set({ icon })}
              label="Account icon"
            />
          </section>
          <section
            style={{
              display: 'grid',
              gap: 12,
              padding: 22,
              border: '1px solid var(--finapp-border)',
              borderRadius: 18,
              background: 'var(--finapp-surface-raised)',
            }}
          >
            <div>
              <Typography variant="bodyLarge">Account color</Typography>
              <Typography variant="small">Choose a color for your account.</Typography>
            </div>
            <EntityColorPicker
              value={value.color}
              onChange={(color) => set({ color })}
              label="Account color"
            />
          </section>
          <div style={{ alignSelf: 'end', display: 'grid', gap: 10 }}>
            {error && (
              <p className="finance-form-error" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
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
        </aside>
      </form>
      <Sheet
        visible={sheet !== null}
        title={sheet === 'type' ? 'Account type' : 'Currency'}
        onClose={() => setSheet(null)}
      >
        <div style={{ display: 'grid', gap: 4, maxHeight: '60vh', overflow: 'auto' }}>
          {(sheet === 'type'
            ? accountTypes.map(([label, type]) => [label, type] as const)
            : currencies.map((currency) => [currency, currency] as const)
          ).map(([label, option]) => {
            const selected = sheet === 'type' ? value.type === option : value.currency === option;
            return (
              <Button
                key={option}
                type="button"
                variant={selected ? 'secondary' : 'ghost'}
                role="radio"
                aria-checked={selected}
                onPress={() => {
                  set(
                    sheet === 'type'
                      ? {
                          type: option as AccountFormValue['type'],
                          customType: option === 'other' ? value.customType : '',
                        }
                      : { currency: option },
                  );
                  setSheet(null);
                }}
                style={{ minHeight: 46, justifyContent: 'space-between' }}
              >
                <span>{label}</span>
                {selected && <Check size={18} color="var(--finapp-primary)" />}
              </Button>
            );
          })}
        </div>
      </Sheet>
    </main>
  );
}
