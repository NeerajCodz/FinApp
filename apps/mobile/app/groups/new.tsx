import React, { useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { currencies } from '@convex/shared/validators';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import { pickDeviceContact, type DeviceContact } from '@/lib/contacts';
import type { LocalRecord } from '@/local/repository';
import { GroupCreateScreen } from '@finapp/ui/finance';
import { groupMetadataDraft, groupMetadataPayload } from '@/components/finance/groupFormData';
function normalizeHandle(value: string) {
  return value.replace(/^@+/, '').trim().toLowerCase();
}

export default function NewGroupScreen() {
  const [icon, setIcon] = useState<string | undefined>('phosphor:UsersThree');
  const [color, setColor] = useState<string | undefined>('#78e6a0');
  const [currency, setCurrency] = useState('');
  const [name, setName] = useState('');
  const [details, setDetails] = useState(() => groupMetadataDraft());
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [contactPhones, setContactPhones] = useState<string[]>([]);
  const [contactNames, setContactNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [error, setError] = useState('');
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const profile = profileState.data?.[0];
  const phoneVerified = Boolean(profile?.phone && profile.phoneVerificationTime !== undefined);
  React.useEffect(() => {
    const value = profile?.defaultCurrency;
    if (
      !currency &&
      typeof value === 'string' &&
      (currencies as readonly string[]).includes(value.toUpperCase())
    )
      setCurrency(value.toUpperCase());
  }, [currency, profile?.defaultCurrency]);
  const suggestions = useQuery(
    api.users.queries.search,
    normalizeHandle(memberInput).length >= 2 ? { query: normalizeHandle(memberInput) } : 'skip',
  );

  function addMember(value = memberInput) {
    const handle = normalizeHandle(value);
    if (!/^[a-z0-9_]{3,32}$/.test(handle) || members.includes(handle)) return;
    setMembers((current) => [...current, handle]);
    setMemberInput('');
  }

  function addContact(contact: DeviceContact) {
    if (!phoneVerified || contactPhones.includes(contact.phone)) return;
    setContactPhones((current) => [...current, contact.phone]);
    setContactNames((current) => [...current, contact.name]);
  }

  async function chooseContact() {
    if (!phoneVerified || contactBusy) return;
    setContactBusy(true);
    setError('');
    try {
      const contact = await pickDeviceContact();
      if (contact) addContact(contact);
    } finally {
      setContactBusy(false);
    }
  }

  async function save() {
    if (!userId || saving) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Enter a group name.');
      return;
    }
    if (!currency || !(currencies as readonly string[]).includes(currency)) {
      setError('Choose a supported currency.');
      return;
    }
    if (!icon || !color) {
      setError('Choose a group icon and color.');
      return;
    }
    if (contactPhones.length && !phoneVerified) {
      setError('Phone invitations require a manually verified phone number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const metadata = groupMetadataPayload(details);
      const groupId = await commitLocalWrite(
        userId,
        'group',
        'group.create',
        {
          icon,
          color,
          name: cleanName,
          ...metadata,
          currency,
          participantUsernames: members,
          contactPhones,
          contactNames,
        },
        {
          name: cleanName,
          ...metadata,
          currency,
          memberUsernames: members,
          icon,
          color,
          memberPhones: contactPhones,
        },
      );
      router.replace(`/group/${groupId}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create group');
    } finally {
      setSaving(false);
    }
  }

  return (
    <GroupCreateScreen
      onBack={() => router.back()}
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
      contacts={contactNames.map((contact, index) => ({
        name: contact,
        phone: contactPhones[index] ?? '',
      }))}
      phoneVerified={phoneVerified}
      contactBusy={contactBusy}
      onChooseContact={() => void chooseContact()}
      onRemoveContact={(index) => {
        setContactNames((current) => current.filter((_, item) => item !== index));
        setContactPhones((current) => current.filter((_, item) => item !== index));
      }}
      usernameInput={memberInput}
      onUsernameInputChange={setMemberInput}
      usernames={members}
      suggestions={suggestions}
      onAddUsername={(value) => addMember(value)}
      onRemoveUsername={(value) =>
        setMembers((current) => current.filter((item) => item !== value))
      }
      error={error}
      saving={saving}
      onSubmit={() => void save()}
    />
  );
}
