import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowRight, MagnifyingGlass, Plus, UsersThree } from '@finapp/ui/icons/native';
import { Button, Empty, Input, Typography, useTheme } from '@finapp/ui/native';
import { layoutTokens } from '@finapp/ui/tokens';
import { GroupCard } from './GroupCard';
import { PeopleRail } from './PeopleRail';

export type GroupOverviewItem = {
  id: string;
  name: string;
  currency: string;
  icon?: string;
  color?: string;
  memberCount: number;
  balance: string;
  balanceMeaning: string;
};
export type GroupOverviewSummary = { currency: string; owed: string; owing: string };
export type GroupOverviewActivity = {
  id: string;
  title: string;
  groupName: string;
  kind: 'expense' | 'settlement';
  amount: string;
  date: string;
};
export type GroupsOverviewScreenProps = {
  groups: readonly GroupOverviewItem[];
  summaries: readonly GroupOverviewSummary[];
  activities: readonly GroupOverviewActivity[];
  balancesLoading: boolean;
  loading: boolean;
  error?: string;
  phoneVerified: boolean;
  onCreate: () => void;
  onInvite: () => void;
  onOpenGroup: (id: string) => void;
  onOpenChat: (id: string) => void;
};

export function GroupsOverviewScreen({
  groups,
  summaries,
  activities,
  balancesLoading,
  loading,
  error,
  phoneVerified,
  onCreate,
  onInvite,
  onOpenGroup,
  onOpenChat,
}: GroupsOverviewScreenProps) {
  const { tokens } = useTheme();
  const [query, setQuery] = useState('');
  const filteredGroups = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return groups.filter((group) => !search || group.name.toLocaleLowerCase().includes(search));
  }, [groups, query]);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: layoutTokens.sectionGap,
        gap: 28,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: 12 }}>
        <Typography variant="caption" style={{ color: tokens.primary }}>
          SHARED FINANCES
        </Typography>
        <Typography variant="title">Groups</Typography>
        <Typography variant="small">
          Share expenses, settle up, and keep the conversation going.
        </Typography>
        <Button onPress={onCreate}>
          <Plus size={18} color={tokens.primaryForeground} /> New group
        </Button>
        <Typography variant="caption">
          {loading
            ? 'Loading your groups…'
            : error
              ? 'Your groups are temporarily unavailable.'
              : `${groups.length} active ${groups.length === 1 ? 'group' : 'groups'} saved on this device`}
        </Typography>
      </View>
      <PeopleRail title="People to split with" onChoose={onInvite} phoneVerified={phoneVerified} />
      <View
        accessibilityLabel="Balances across groups"
        style={{
          padding: 16,
          gap: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <Typography variant="heading">Your balances</Typography>
        {summaries.length ? (
          summaries.map((summary) => (
            <View key={summary.currency} style={{ flexDirection: 'row', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  padding: 12,
                  gap: 4,
                  borderRadius: 14,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <Typography variant="caption">Owed to you · {summary.currency}</Typography>
                <Typography variant="bodyLarge">{summary.owed}</Typography>
              </View>
              <View
                style={{
                  flex: 1,
                  padding: 12,
                  gap: 4,
                  borderRadius: 14,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <Typography variant="caption">You owe · {summary.currency}</Typography>
                <Typography variant="bodyLarge">{summary.owing}</Typography>
              </View>
            </View>
          ))
        ) : balancesLoading ? (
          <Typography variant="small">Loading complete group balances…</Typography>
        ) : groups.length === 0 ? (
          <Typography variant="small">Create a group to see shared balances.</Typography>
        ) : (
          <Typography variant="small">
            Complete balances are unavailable until each group’s full history is loaded.
          </Typography>
        )}
      </View>
      <View style={{ gap: 14 }}>
        <Typography variant="heading">Your groups</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MagnifyingGlass size={18} color={tokens.foregroundMuted} />
          <Input
            accessibilityLabel="Search groups"
            placeholder="Search groups"
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1 }}
          />
        </View>
        {loading ? (
          <Typography variant="small" accessibilityLiveRegion="polite">
            Loading groups…
          </Typography>
        ) : error ? (
          <Empty
            title="Groups unavailable"
            description="Your saved groups could not be loaded."
            icon={<UsersThree size={24} color={tokens.foregroundMuted} />}
          />
        ) : filteredGroups.length ? (
          filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              name={group.name}
              icon={group.icon}
              color={group.color}
              meta={`${group.currency}${group.currency ? ' · ' : ''}${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`}
              balance={group.balance}
              meaning={group.balanceMeaning}
              onPress={() => onOpenGroup(group.id)}
              onOpenChat={() => onOpenChat(group.id)}
            />
          ))
        ) : (
          <Empty
            title={query ? 'No matching groups' : 'No groups yet'}
            description={
              query
                ? 'Try another group name.'
                : 'Create a group for expenses you share with people.'
            }
            icon={<UsersThree size={24} color={tokens.foregroundMuted} />}
            action={
              !query ? (
                <Button variant="outline" onPress={onCreate}>
                  Create group <ArrowRight size={15} color={tokens.foreground} />
                </Button>
              ) : undefined
            }
          />
        )}
      </View>
      <View
        style={{
          padding: 16,
          gap: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <Typography variant="heading">Recent group activity</Typography>
        {activities.length ? (
          activities.map((activity) => (
            <View
              key={activity.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: tokens.borderSubtle,
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Typography variant="bodyLarge">{activity.title}</Typography>
                <Typography variant="caption">
                  {activity.groupName} ·{' '}
                  {activity.kind === 'expense' ? 'Expense' : 'Recorded settlement'} ·{' '}
                  {activity.date}
                </Typography>
              </View>
              <Typography variant="bodyLarge">{activity.amount}</Typography>
            </View>
          ))
        ) : (
          <Typography variant="small">
            {balancesLoading
              ? 'Loading recent activity…'
              : 'No recent group activity is available from the loaded ledgers.'}
          </Typography>
        )}
      </View>
    </ScrollView>
  );
}
