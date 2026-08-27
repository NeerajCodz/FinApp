import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ContactRound } from '@/lib/icons';
import { readDeviceContacts, type DeviceContact } from '@/lib/contacts';
import { Avatar, Button, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export function PeopleRail({
  title = 'Recent people',
  onSelect,
}: {
  title?: string;
  onSelect?: (contact: DeviceContact) => void;
}) {
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [loading, setLoading] = useState(false);
  const { tokens } = useTheme();

  async function allowContacts() {
    setLoading(true);
    try {
      setContacts(await readDeviceContacts());
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="heading">{title}</Typography>
        {contacts.length > 0 && <Typography variant="caption">{contacts.length} found</Typography>}
      </View>
      {contacts.length === 0 ? (
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
            <Text style={{ color: tokens.foreground }}>Find people you already know</Text>
            <Typography variant="caption">
              We only read names and phone numbers on this device.
            </Typography>
          </View>
          <Button size="sm" variant="outline" disabled={loading} onPress={allowContacts}>
            {loading ? 'Loading' : 'Allow'}
          </Button>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 18, paddingRight: 12 }}
        >
          {contacts.map((contact) => (
            <Pressable
              key={contact.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${contact.name}`}
              onPress={() => onSelect?.(contact)}
              style={({ pressed }) => ({
                alignItems: 'center',
                gap: 7,
                width: 62,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Avatar initials={contact.name.slice(0, 2)} label={contact.name} size={48} />
              <Typography
                variant="caption"
                numberOfLines={1}
                style={{ color: tokens.foreground, maxWidth: 62 }}
              >
                {contact.name.split(' ')[0]}
              </Typography>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
