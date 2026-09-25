import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { Plus, UsersThree } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupCard, PeopleRail } from '@/components/finance';
import { Button, Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { layoutTokens } from '@/lib/theme/tokens';

export default function GroupsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const groupState = useLocalRecords<Record<string, unknown>>(userId, 'group');
  const groups = groupState.data;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 16,
        paddingBottom: layoutTokens.sectionGap,
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
      <View style={{ gap: 6 }}>
        <Typography variant="label">Shared ledgers</Typography>
        <Typography variant="small">
          {groups ? `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}` : 'Your groups will appear here when available.'}
        </Typography>
      </View>
      <PeopleRail
        title="People to split with"
        onSelect={() => router.push('/group/new' as never)}
      />
      <View style={{ gap: 14 }}>
        <Typography variant="heading">Your groups</Typography>
        {groups && groups.length > 0 ? (
          groups.map((group) => {
            const groupId = String(group.id ?? group._id ?? '');
            return (
              <GroupCard
                key={groupId}
                name={String(group.name ?? 'Group')}
                meta={`${String(group.currency ?? 'INR')} · shared ledger`}
                balance="View balance"
                meaning="Calculated from the complete group ledger"
                onPress={() => router.push(`/group/${groupId}` as never)}
              />
            );
          })
        ) : groupState.loading ? (
          <Typography variant="small">Loading groups…</Typography>
        ) : groupState.error ? (
          <Empty
            title="Groups unavailable"
            description="Your saved groups could not be loaded."
            icon={<UsersThree size={28} color={tokens.foregroundMuted} />}
            action={<Button size="sm" variant="outline" onPress={groupState.retry}>Retry</Button>}
          />
        ) : (
          <Empty
            title="No groups yet"
            description="Create one for a trip, home, or any expense shared with people."
            icon={<UsersThree size={28} color={tokens.foregroundMuted} />}
            action={<Button size="sm" variant="outline" onPress={() => router.push('/group/new' as never)}>Create group</Button>}
          />
        )}
      </View>
    </ScrollView>
  );
}
