import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Empty, Input, Typography, useTheme } from '@finapp/ui/native';
import { GroupCard } from './GroupCard';
import { GroupHeading, GroupMetric, GroupNote, GroupPanel, GroupTile } from './GroupPrimitives';
import {
  InvitationInbox,
  type IncomingInvitation,
  type InvitationResponse,
} from './IncomingInvitations';

export type GroupOverviewItem = {
  id: string;
  name: string;
  currency: string;
  icon?: string;
  color?: string;
  memberCount: number;
  balance: string;
  balanceMeaning: string;
  description?: string;
  members?: readonly { name: string; avatarUrl?: string }[];
  role?: string;
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
  onCreate: () => void;
  onOpenGroup: (id: string) => void;
  onOpenChat: (id: string) => void;
  invitations?: readonly IncomingInvitation[];
  invitationsLoading: boolean;
  invitationsError?: string;
  onRespondToInvitation: InvitationResponse;
  showInvitations?: boolean;
};

export function GroupsOverviewScreen({
  groups,
  summaries,
  activities,
  balancesLoading,
  loading,
  error,
  onCreate,
  onOpenGroup,
  onOpenChat,
  invitations,
  invitationsLoading,
  invitationsError,
  onRespondToInvitation,
  showInvitations,
}: GroupsOverviewScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [invitationsOpen, setInvitationsOpen] = useState(!!showInvitations);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const result = groups.filter(
      (group) =>
        !search || `${group.name} ${group.description ?? ''}`.toLocaleLowerCase().includes(search),
    );
    return sort === 'name' ? result.sort((a, b) => a.name.localeCompare(b.name)) : result;
  }, [groups, query, sort]);
  const unavailable = balancesLoading ? 'Loading…' : 'Unavailable';
  useEffect(() => {
    if (showInvitations) setInvitationsOpen(true);
  }, [showInvitations]);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 28,
        gap: 16,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <GroupHeading
        title="Groups"
        subtitle="Share expenses, settle up, and keep the conversation going."
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button onPress={onCreate}>+ New group</Button>
        <Button variant="outline" onPress={() => setInvitationsOpen(true)}>
          Invitations{invitations?.length ? ` (${invitations.length})` : ''}
        </Button>
      </View>
      <Input
        accessibilityLabel="Search groups"
        placeholder="Search groups…"
        value={query}
        onChangeText={setQuery}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <GroupMetric
          title="You are owed"
          value={
            summaries.length
              ? summaries.map((item) => `${item.owed} · ${item.currency}`).join('\n')
              : unavailable
          }
          detail="Complete group balances only"
          icon="phosphor:ArrowDownLeft"
          color={tokens.income}
        />
        <GroupMetric
          title="You owe"
          value={
            summaries.length
              ? summaries.map((item) => `${item.owing} · ${item.currency}`).join('\n')
              : unavailable
          }
          detail="Complete group balances only"
          icon="phosphor:ArrowUpRight"
          color={tokens.expense}
        />
        <GroupMetric
          title="Active groups"
          value={loading ? 'Loading…' : error ? 'Unavailable' : String(groups.length)}
          detail="Saved groups on this device"
          icon="phosphor:UsersThree"
          color={tokens.split}
        />
        <GroupMetric
          title="Pending settlements"
          value="Not scheduled"
          detail="Record a payment within a group"
          icon="phosphor:Receipt"
          color={tokens.warning}
        />
      </View>
      {!summaries.length && !balancesLoading && groups.length > 0 && (
        <Typography variant="caption">
          Complete balances are unavailable until each group’s full history is loaded. No partial
          total is shown.
        </Typography>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="heading">Your groups</Typography>
        <Button
          size="sm"
          variant="outline"
          onPress={() => setSort(sort === 'name' ? 'recent' : 'name')}
        >
          {sort === 'name' ? 'Name A–Z' : 'Most recent'}
        </Button>
      </View>
      {loading ? (
        <Typography accessibilityLiveRegion="polite">Loading groups…</Typography>
      ) : error ? (
        <Empty title="Groups unavailable" description={error} />
      ) : filtered.length ? (
        filtered.map((group) => (
          <GroupCard
            key={group.id}
            {...group}
            meta={`${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'} · ${group.currency}`}
            meaning={group.balanceMeaning}
            onPress={() => onOpenGroup(group.id)}
            onOpenChat={() => onOpenChat(group.id)}
          />
        ))
      ) : (
        <Empty
          title={query ? 'No matching groups' : 'No groups yet'}
          description={query ? 'Try another name.' : 'Create a group for expenses you share.'}
          action={!query ? <Button onPress={onCreate}>Create group</Button> : undefined}
        />
      )}
      <GroupPanel>
        <Typography variant="heading">Upcoming settlements</Typography>
        <Typography variant="small">
          No scheduled settlements. Payments are recorded manually from each group’s balances.
        </Typography>
      </GroupPanel>
      <GroupPanel>
        <Typography variant="heading">Recent group activity</Typography>
        {activities.length ? (
          activities.map((activity) => (
            <View
              key={activity.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderColor: tokens.borderSubtle,
              }}
            >
              <GroupTile
                size={34}
                icon={activity.kind === 'expense' ? 'phosphor:Receipt' : 'phosphor:ArrowsLeftRight'}
                color={activity.kind === 'expense' ? tokens.warning : tokens.income}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Typography variant="label">{activity.title}</Typography>
                <Typography variant="caption">
                  {activity.groupName} · {activity.date}
                </Typography>
              </View>
              <Typography variant="label">{activity.amount}</Typography>
            </View>
          ))
        ) : (
          <Typography variant="small">
            {balancesLoading
              ? 'Loading recent activity…'
              : 'No activity is available from the loaded ledgers.'}
          </Typography>
        )}
      </GroupPanel>
      <GroupPanel>
        <GroupNote
          title="Roles & permissions"
          text="Owners and admins manage group settings and membership. Members can add expenses and record their settlements."
          icon="phosphor:ShieldCheck"
        />
      </GroupPanel>
      <InvitationInbox
        invitations={invitations}
        loading={invitationsLoading}
        error={invitationsError}
        onRespond={onRespondToInvitation}
        open={invitationsOpen}
        onClose={() => setInvitationsOpen(false)}
      />
    </ScrollView>
  );
}
