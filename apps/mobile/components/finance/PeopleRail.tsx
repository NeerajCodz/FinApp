import React, { useState } from 'react';
import { View } from 'react-native';
import { ContactRound } from '@/lib/icons';
import { pickDeviceContact, type DeviceContact } from '@/lib/contacts';
import { Button, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

export function PeopleRail({
  title = 'Recent people',
  onSelect,
}: {
  title?: string;
  onSelect?: (contact: DeviceContact) => void;
}) {
  const [loading, setLoading] = useState(false);
  const { tokens } = useTheme();
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
    <View style={{ gap: 14 }}>
      <Typography variant="heading">{title}</Typography>
      {!phoneVerified ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ContactRound size={19} color={tokens.foregroundMuted} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: tokens.foreground }}>Verify a phone number to use contacts</Text>
            <Typography variant="caption">
              {profile === undefined
                ? 'Checking verification status…'
                : 'Add a phone number in your profile. Contacts unlock after manual verification.'}
            </Typography>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ContactRound size={19} color={tokens.foregroundMuted} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: tokens.foreground }}>Choose one person to invite</Text>
            <Typography variant="caption">
              Only the selected contact’s name and phone number are used.
            </Typography>
          </View>
          <Button size="sm" variant="outline" disabled={loading} onPress={chooseContact}>
            {loading ? 'Opening' : 'Choose'}
          </Button>
        </View>
      )}
    </View>
  );
}
