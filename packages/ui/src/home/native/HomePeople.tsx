import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { UsersThree } from '@finapp/ui/icons/native';
import { Avatar, SectionHeader, Text, Typography, useTheme } from '@finapp/ui/native';
import { formatMinor } from '@finapp/ui/finance/money';
import type { HomePerson } from '../types';
import { FinanceEmptyState } from '../../finance/native/FinanceEmptyState';
export function HomePeople({
  people,
  loading,
  error,
  currency,
  onOpenPerson,
}: {
  people: readonly HomePerson[];
  loading: boolean;
  error: boolean;
  currency: string;
  onOpenPerson: (username: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 9 }}>
      <SectionHeader
        title="People you transact with"
        action={<UsersThree size={17} color={tokens.foregroundMuted} />}
      />
      {loading ? (
        <Typography variant="small">Loading shared activity…</Typography>
      ) : error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: tokens.foregroundMuted, lineHeight: 20 }}
        >
          Shared activity couldn’t load. The rest of your dashboard is still available.
        </Text>
      ) : people.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 9, paddingRight: 4 }}
        >
          {people.map((person) => (
            <TouchableOpacity
              key={person.id}
              accessibilityRole={person.username ? 'button' : undefined}
              accessibilityLabel={`${person.name}, ${person.transactionCount} shared transactions`}
              disabled={!person.username}
              onPress={() => person.username && onOpenPerson(person.username)}
              activeOpacity={0.76}
              style={{
                width: 142,
                minHeight: 144,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                borderRadius: 15,
                padding: 12,
                backgroundColor: tokens.card,
              }}
            >
              <Avatar
                initials={person.name.trim().slice(0, 1).toLocaleUpperCase() || 'F'}
                label={person.name}
                avatarId={person.avatarId}
                imageUrl={person.image}
                size={42}
              />
              <Typography
                variant="bodyLarge"
                numberOfLines={1}
                style={{ maxWidth: 120, fontSize: 14 }}
              >
                {person.name}
              </Typography>
              <Typography variant="caption" numberOfLines={1}>
                {person.transactionCount} shared transactions
              </Typography>
              <Typography variant="small" numberOfLines={1}>
                {formatMinor(person.amountMinor, currency)}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <FinanceEmptyState
          kind="group"
          title="No shared activity yet."
          description="Shared expenses with group members will appear here once you transact together."
          compact
        />
      )}
    </View>
  );
}
