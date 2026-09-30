'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Button, Card } from '@finapp/ui/web';
import { PeopleRail } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { EntityIconPicker } from '@finapp/ui/finance';
import { FinanceInput } from '@/components/finance/FinanceInput';

type ContactPicker = {
  select: (
    properties: string[],
    options?: { multiple?: boolean },
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
};
type SearchResult = { id: string; username?: string; displayName?: string };
const normalizeUsername = (value: string) => value.replace(/^@+/, '').trim().toLowerCase();
const normalizePhone = (value: string) => value.replace(/[\s().-]/g, '');

export default function NewGroupPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: profiles } = useLocalRecords<LocalRecord>('profile');
  const [name, setName] = React.useState('');
  const [usernameInput, setUsernameInput] = React.useState('');
  const [icon, setIcon] = React.useState<string>();
  const [usernames, setUsernames] = React.useState<string[]>([]);
  const [phoneInput, setPhoneInput] = React.useState('');
  const [phones, setPhones] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [contactBusy, setContactBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const profile = profiles[0];
  const phoneVerified = Boolean(profile?.phone && profile.phoneVerificationTime !== undefined);
  const query = normalizeUsername(usernameInput);
  const suggestions = useQuery(
    api.users.queries.search,
    userId && query.length >= 2 ? { query } : 'skip',
  ) as SearchResult[] | undefined;
  const pickerAvailable =
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof (navigator as Navigator & { contacts?: ContactPicker }).contacts?.select === 'function';

  function addUsername(value = usernameInput) {
    const handle = normalizeUsername(value);
    if (!/^[a-z0-9_]{3,32}$/.test(handle) || usernames.includes(handle)) {
      setError('Enter a valid, unique username.');
      return;
    }
    setUsernames((current) => [...current, handle]);
    setUsernameInput('');
    setError('');
  }

  function addPhone(value = phoneInput) {
    if (!phoneVerified) {
      setError('Verify your phone number in your profile before inviting by phone.');
      return;
    }
    const phone = normalizePhone(value);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setError('Use an international phone number, for example +919876543210.');
      return;
    }
    if (phones.includes(phone)) {
      setError('That phone number is already on the invite list.');
      return;
    }
    setPhones((current) => [...current, phone]);
    setPhoneInput('');
    setError('');
  }

  async function chooseContacts() {
    if (!phoneVerified || !pickerAvailable) return;
    setContactBusy(true);
    setError('');
    try {
      const picker = (navigator as Navigator & { contacts: ContactPicker }).contacts;
      const selected = await picker.select(['name', 'tel'], { multiple: true });
      const chosenPhones = selected
        .flatMap((contact) => contact.tel ?? [])
        .map(normalizePhone)
        .filter((phone) => /^\+[1-9]\d{7,14}$/.test(phone));
      setPhones((current) => [...new Set([...current, ...chosenPhones])]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The selected contacts were not added.');
    } finally {
      setContactBusy(false);
    }
  }

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy) return;
    if (!name.trim()) {
      setError('Enter a group name.');
      return;
    }
    if (phones.length && !phoneVerified) {
      setError('Phone invitations require a manually verified phone number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const cleanName = name.trim();
      const localId = await commitLocalWrite(
        userId,
        'group',
        'group.create',
        {
          ownerId: userId,
          ...(icon ? { icon } : {}),
          name: cleanName,
          currency: 'INR',
          participantUsernames: usernames,
          memberPhones: phones,
          createdAt: Date.now(),
        },
        {
          name: cleanName,
          currency: 'INR',
          memberUsernames: usernames,
          memberPhones: phones,
          ...(icon ? { icon } : {}),
        },
      );
      router.replace(`/group/${encodeURIComponent(localId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the group.');
    } finally {
      setBusy(false);
    }
  }

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">NEW GROUP</p>
        <h1>Bring everyone together.</h1>
        <p>Sign in to create a shared group that is saved to this browser first.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link className="finance-secondary-action" href="/groups" aria-label="Go back">
            <ArrowLeft size={18} />
          </Link>
          <h1>New group</h1>
        </div>
      </header>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2>Name the group.</h2>
        <p className="finance-muted">
          Add people by @username or from your phone contacts. Unknown people receive a pending
          invite.
        </p>
      </section>
      <Card className="finance-form-panel">
        <form className="finance-form" onSubmit={createGroup}>
          <FinanceInput
            label="Group name"
            value={name}
            onChangeText={setName}
            placeholder="Goa Trip"
            maxLength={80}
            required
          />
          <EntityIconPicker
            mode="either"
            value={icon}
            onChange={setIcon}
            label="Group icon"
            compact
            allowClear
          />
          <PeopleRail
            title="From your contacts"
            phoneVerified={phoneVerified}
            loading={contactBusy}
            onChoose={pickerAvailable ? chooseContacts : undefined}
          />
          <div className="finance-form-field">
            <span>Phone number to invite</span>
            <div className="finance-form-row">
              <input
                aria-label="Phone number to invite"
                type="tel"
                inputMode="tel"
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addPhone();
                  }
                }}
                placeholder="+91 98765 43210"
                disabled={!phoneVerified}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!phoneVerified || !phoneInput.trim()}
                onPress={() => addPhone()}
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
                      onPress={() =>
                        setPhones((current) => current.filter((item) => item !== phone))
                      }
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
              <input
                aria-label="Username to invite"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addUsername();
                  }
                }}
                placeholder="@username"
                autoComplete="off"
              />
              <Button type="button" variant="outline" onPress={() => addUsername()}>
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
                      onPress={() => person.username && addUsername(person.username)}
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
                      onPress={() =>
                        setUsernames((current) => current.filter((item) => item !== handle))
                      }
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
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Saving locally…' : 'Create group'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
