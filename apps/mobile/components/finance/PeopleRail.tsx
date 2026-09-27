import React, { useState } from 'react';
import { pickDeviceContact, type DeviceContact } from '@/lib/contacts';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { PeopleRail as SharedPeopleRail } from '@finapp/ui/finance';

export function PeopleRail({
  title = 'Recent people',
  onSelect,
}: {
  title?: string;
  onSelect?: (contact: DeviceContact) => void;
}) {
  const [loading, setLoading] = useState(false);
  const { userId } = useLocalSync();
  const { data: profiles } = useLocalRecords<LocalRecord>(userId, 'profile');
  const profile = profiles?.[0];
  const phoneVerified = Boolean(profile?.phone && profile.phoneVerificationTime !== undefined);

  async function chooseContact() {
    if (!phoneVerified) return;
    setLoading(true);
    try {
      const contact = await pickDeviceContact();
      if (contact) onSelect?.(contact);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SharedPeopleRail
      title={title}
      phoneVerified={phoneVerified}
      checking={profile === undefined}
      loading={loading}
      onChoose={chooseContact}
    />
  );
}
