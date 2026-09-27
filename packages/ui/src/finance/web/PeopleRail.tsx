import React from 'react';
import { ContactRound } from 'lucide-react';
import { Button, Text, Typography, useTheme } from '@finapp/ui/web';

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
  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingBlock: 8,
  };
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <Typography variant="heading">{title}</Typography>
      <div style={row}>
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            width: 40,
            height: 40,
            flex: '0 0 40px',
            placeItems: 'center',
            borderRadius: 12,
            backgroundColor: tokens.surfaceRaised,
            color: tokens.foregroundMuted,
          }}
        >
          <ContactRound size={19} />
        </span>
        <span style={{ display: 'grid', flex: 1, gap: 2 }}>
          <Text style={{ color: tokens.foreground }}>
            {phoneVerified
              ? 'Choose one person to invite'
              : 'Verify a phone number to use contacts'}
          </Text>
          <Typography variant="caption">
            {phoneVerified
              ? 'Only the selected contact’s name and phone number are used.'
              : checking
                ? 'Checking verification status…'
                : 'Add a phone number in your profile. Contacts unlock after manual verification.'}
          </Typography>
        </span>
        {phoneVerified && onChoose && (
          <Button size="sm" variant="outline" disabled={loading} onPress={onChoose}>
            {loading ? 'Opening' : 'Choose'}
          </Button>
        )}
      </div>
    </section>
  );
}
