import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Plus } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupCard, Money, PeopleRail } from '@/components/finance';
import { Button, IconButton, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function GroupsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const groups = useQuery(api.groups.queries.list);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 180,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="title">Groups</Typography>
        <IconButton
          label="Create group"
          variant="ghost"
          onPress={() => router.push('/group/new' as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="label">You are owed</Typography>
        <Money amountMinor={0n} currency="INR" size="display" />
      </View>
      <PeopleRail
        title="People to split with"
        onSelect={() => router.push('/group/new' as never)}
      />
      <View style={{ gap: 14 }}>
        <Typography variant="heading">Your groups</Typography>
        {groups && groups.length > 0 ? (
          groups.map((group) => (
            <GroupCard
              key={group._id}
              name={group.name}
              meta={`${group.currency} · shared ledger`}
              balance="₹0"
              meaning="All settled"
              onPress={() => router.push(`/group/${group._id}` as never)}
            />
          ))
        ) : (
          <View style={{ gap: 10 }}>
            <Typography variant="heading">No groups yet.</Typography>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
              Create one for a trip, home, or any expense shared with people.
            </Text>
            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push('/group/new' as never)}
              style={{ alignSelf: 'flex-start' }}
            >
              Create group
            </Button>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
