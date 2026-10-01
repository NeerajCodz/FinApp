'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { ArrowRight } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { GroupCreateScreen } from '@finapp/ui/finance';
import { currencies } from '@convex/shared/validators';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { groupMetadataDraft, groupMetadataPayload } from '../../group/formData';

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
  const [details, setDetails] = React.useState(() => groupMetadataDraft());
  const [usernameInput, setUsernameInput] = React.useState('');
  const [icon, setIcon] = React.useState<string | undefined>('phosphor:UsersThree');
  const [color, setColor] = React.useState<string | undefined>('#78e6a0');
  const [currency, setCurrency] = React.useState('');
  const [usernames, setUsernames] = React.useState<string[]>([]);
  const [phoneInput, setPhoneInput] = React.useState('');
  const [phones, setPhones] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [contactBusy, setContactBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const profile = profiles[0];
  React.useEffect(() => {
    const value = profile?.defaultCurrency;
    if (
      !currency &&
      typeof value === 'string' &&
      (currencies as readonly string[]).includes(value.toUpperCase())
    )
      setCurrency(value.toUpperCase());
  }, [currency, profile?.defaultCurrency]);
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
    if (!currency || !(currencies as readonly string[]).includes(currency)) {
      setError('Choose a supported currency.');
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
      const metadata = groupMetadataPayload(details);
      if (!icon || !color) {
        setError('Choose a group icon and color.');
        return;
      }
      const localId = await commitLocalWrite(
        userId,
        'group',
        'group.create',
        {
          ownerId: userId,
          icon,
          color,
          name: cleanName,
          ...metadata,
          currency,
          participantUsernames: usernames,
          memberPhones: phones,
          createdAt: Date.now(),
        },
        {
          name: cleanName,
          ...metadata,
          currency,
          memberUsernames: usernames,
          memberPhones: phones,
          icon,
          color,
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
    <GroupCreateScreen
      onBack={() => router.push('/groups')}
      name={name}
      onNameChange={setName}
      {...details}
      onDescriptionChange={(description) => setDetails((current) => ({ ...current, description }))}
      onGroupTypeChange={(groupType) => setDetails((current) => ({ ...current, groupType }))}
      onPurposeChange={(purpose) => setDetails((current) => ({ ...current, purpose }))}
      onLocationChange={(location) => setDetails((current) => ({ ...current, location }))}
      onStartDateChange={(startDate) => setDetails((current) => ({ ...current, startDate }))}
      onEndDateChange={(endDate) => setDetails((current) => ({ ...current, endDate }))}
      currency={currency}
      currencies={currencies}
      onCurrencyChange={setCurrency}
      icon={icon}
      onIconChange={setIcon}
      color={color}
      onColorChange={setColor}
      phoneVerified={phoneVerified}
      contactBusy={contactBusy}
      pickerAvailable={pickerAvailable}
      onChooseContacts={() => void chooseContacts()}
      phoneInput={phoneInput}
      onPhoneInputChange={setPhoneInput}
      phones={phones}
      onAddPhone={() => addPhone()}
      onRemovePhone={(phone) => setPhones((items) => items.filter((item) => item !== phone))}
      usernameInput={usernameInput}
      onUsernameInputChange={setUsernameInput}
      suggestions={suggestions}
      query={query}
      usernames={usernames}
      onAddUsername={(username) => addUsername(username)}
      onRemoveUsername={(username) =>
        setUsernames((items) => items.filter((item) => item !== username))
      }
      error={error}
      busy={busy}
      onSubmit={createGroup}
    />
  );
}
