'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { Button, Card, Input } from '@finapp/ui/web';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIconPicker } from './EntityIconPicker';
import { PeopleRail } from './PeopleRail';

export type GroupCreateSuggestion = { id: string; username?: string; displayName?: string };
export type GroupCreateScreenProps = {
  onBack: () => void;
  name: string;
  onNameChange: (value: string) => void;
  currency: string;
  currencies: readonly string[];
  onCurrencyChange: (value: string) => void;
  icon?: string;
  onIconChange: (value?: string) => void;
  color?: string;
  onColorChange: (value?: string) => void;
  phoneVerified: boolean;
  contactBusy: boolean;
  pickerAvailable: boolean;
  onChooseContacts?: () => void;
  phoneInput: string;
  onPhoneInputChange: (value: string) => void;
  phones: readonly string[];
  onAddPhone: () => void;
  onRemovePhone: (phone: string) => void;
  usernameInput: string;
  onUsernameInputChange: (value: string) => void;
  suggestions?: readonly GroupCreateSuggestion[];
  query: string;
  usernames: readonly string[];
  onAddUsername: (username?: string) => void;
  onRemoveUsername: (username: string) => void;
  error?: string;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function GroupCreateScreen({
  onBack,
  name,
  onNameChange,
  currency,
  currencies,
  onCurrencyChange,
  icon,
  onIconChange,
  color,
  onColorChange,
  phoneVerified,
  contactBusy,
  pickerAvailable,
  onChooseContacts,
  phoneInput,
  onPhoneInputChange,
  phones,
  onAddPhone,
  onRemovePhone,
  usernameInput,
  onUsernameInputChange,
  suggestions,
  query,
  usernames,
  onAddUsername,
  onRemoveUsername,
  error,
  busy,
  onSubmit,
}: GroupCreateScreenProps) {
  return (
    <main className="finance-page">
      <header className="finance-page-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Back to groups"
            onPress={onBack}
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <p className="finance-kicker">SHARED FINANCES</p>
            <h1>New group</h1>
          </div>
        </div>
      </header>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2>Name the group.</h2>
        <p className="finance-muted">
          Start with a name, solid icon, and color. Invite people now or add them later from
          settings. Group details save on this device first and sync when connected.
        </p>
      </section>
      <Card className="finance-form-panel">
        <form className="finance-form" onSubmit={onSubmit}>
          <label className="finance-form-field">
            <span>Group name</span>
            <Input
              aria-label="Group name"
              value={name}
              onChangeText={onNameChange}
              placeholder="Name your group"
              maxLength={80}
              required
            />
          </label>
          <label className="finance-form-field">
            <span>Currency</span>
            <select
              className="finapp-input"
              aria-label="Group currency"
              value={currency}
              onChange={(event) => onCurrencyChange(event.currentTarget.value)}
              required
            >
              <option value="" disabled>
                Choose a currency
              </option>
              {currencies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <EntityIconPicker
            mode="phosphor"
            value={icon}
            onChange={onIconChange}
            label="Group icon"
            compact
          />
          <EntityColorPicker value={color} onChange={onColorChange} label="Group color" />
          <PeopleRail
            title="From your contacts"
            phoneVerified={phoneVerified}
            loading={contactBusy}
            onChoose={pickerAvailable ? onChooseContacts : undefined}
          />
          <div className="finance-form-field">
            <span>Phone number to invite</span>
            <div className="finance-form-row">
              <Input
                aria-label="Phone number to invite"
                type="tel"
                inputMode="tel"
                value={phoneInput}
                onChangeText={onPhoneInputChange}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddPhone();
                  }
                }}
                placeholder="+1 415 555 0138"
                disabled={!phoneVerified}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!phoneVerified || !phoneInput.trim()}
                onPress={onAddPhone}
              >
                <Plus size={15} /> Add
              </Button>
            </div>
            {!pickerAvailable && (
              <p className="finance-form-note">
                Contact Picker is unavailable in this browser. Use the manual phone field above.
              </p>
            )}
            {!!phones.length && (
              <ul className="finance-record-list">
                {phones.map((phone) => (
                  <li key={phone}>
                    <span className="finance-record-copy">
                      <strong>{phone}</strong>
                      <small>Selected invite number</small>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${phone}`}
                      onPress={() => onRemovePhone(phone)}
                    >
                      <X size={16} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <section className="finance-form-field" aria-labelledby="group-people">
            <span id="group-people">People · optional</span>
            <div className="finance-form-row">
              <Input
                aria-label="Username to invite"
                value={usernameInput}
                onChangeText={onUsernameInputChange}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddUsername();
                  }
                }}
                placeholder="@username"
                autoComplete="off"
              />
              <Button type="button" variant="outline" onPress={() => onAddUsername()}>
                <Plus size={15} /> Add
              </Button>
            </div>
            {query.length >= 2 && (
              <div className="finance-record-copy" aria-live="polite">
                {suggestions?.length ? (
                  suggestions.slice(0, 5).map((person) => (
                    <Button
                      key={person.id}
                      size="sm"
                      variant="ghost"
                      onPress={() => person.username && onAddUsername(person.username)}
                    >
                      {person.displayName ?? 'Finapp user'} · @{person.username}
                    </Button>
                  ))
                ) : suggestions ? (
                  <small>No username matches yet.</small>
                ) : (
                  <small>Search results load when you are online.</small>
                )}
              </div>
            )}
            {!!usernames.length && (
              <ul className="finance-record-list">
                {usernames.map((handle) => (
                  <li key={handle}>
                    <span className="finance-record-copy">
                      <strong>@{handle}</strong>
                      <small>Username invite</small>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove @${handle}`}
                      onPress={() => onRemoveUsername(handle)}
                    >
                      <X size={16} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {error && (
            <p className="finance-form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !name.trim() || !currency || !icon || !color}>
            {busy ? 'Saving locally…' : 'Create group'} <ArrowRight size={15} />
          </Button>
        </form>
      </Card>
    </main>
  );
}
