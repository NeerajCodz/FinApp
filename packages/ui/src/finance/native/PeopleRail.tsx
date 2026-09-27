import React from 'react';
import { View } from 'react-native';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';
import { ContactRound } from '@finapp/ui/icons/native';

export function PeopleRail({
  title = 'Recent people',
  phoneVerified,
  checking = false,
  loading = false,
  onChoose,
}: {
  title?: string;
  phoneVerified: boolean;
  checking?: boolean;
  loading?: boolean;
  onChoose?: () => void;
}) {
  const { tokens } = useTheme();
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
              {checking
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
          {onChoose && (
            <Button size="sm" variant="outline" disabled={loading} onPress={onChoose}>
              {loading ? 'Opening' : 'Choose'}
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
