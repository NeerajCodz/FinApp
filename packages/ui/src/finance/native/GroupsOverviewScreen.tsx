import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronRight, Plus, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Input, Text, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { EntityIcon } from './EntityIconPicker';
import {
  InvitationInbox,
  type IncomingInvitation,
  type InvitationResponse,
} from './IncomingInvitations';
const NETWORK_PURPLE = '#C277F5';
const ICON_INK = '#16131B';
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
  members?: readonly { name: string; avatarId?: string; avatarUrl?: string }[];
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

export function GroupsOverviewScreen(p: GroupsOverviewScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'invited'>('all');
  const [invitationsOpen, setInvitationsOpen] = useState(!!p.showInvitations);
  useEffect(() => {
    if (p.showInvitations) setInvitationsOpen(true);
  }, [p.showInvitations]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return p.groups.filter(
      (group) =>
        !search || `${group.name} ${group.description ?? ''}`.toLocaleLowerCase().includes(search),
    );
  }, [p.groups, query]);
  const lastActivityByGroup = useMemo(() => {
    const latest = new Map<string, GroupOverviewActivity>();
    for (const activity of p.activities) {
      if (!latest.has(activity.groupName)) latest.set(activity.groupName, activity);
    }
    return latest;
  }, [p.activities]);
  const filters = [
    { id: 'all' as const, label: 'All' },
    { id: 'mine' as const, label: 'My Groups' },
    { id: 'invited' as const, label: 'Invited' },
  ];
  const renderGroup = (group: GroupOverviewItem) => {
    const members = group.members ?? [];
    const activity = lastActivityByGroup.get(group.name);
    return (
      <Pressable
        key={group.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${group.name}`}
        onPress={() => p.onOpenGroup(group.id)}
        style={({ pressed }) => ({
          minHeight: 108,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: 16,
          paddingHorizontal: 13,
          paddingVertical: 12,
          backgroundColor: pressed ? tokens.surfaceRaised : tokens.surfaceSubtle,
        })}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: group.color ?? tokens.surfaceRaised,
          }}
        >
          <EntityIcon value={group.icon ?? 'phosphor:UsersThree'} size={32} color={ICON_INK} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Typography variant="label" numberOfLines={1}>
            {group.name}
          </Typography>
          <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }} numberOfLines={1}>
            {group.memberCount
              ? `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`
              : 'Group'}
            {' · '}
            {activity ? `Last activity ${activity.date}` : 'No activity yet'}
          </Text>
          {members.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 2 }}>
              {members.slice(0, 4).map((member, index) => (
                <View
                  key={`${group.id}:${member.name}:${index}`}
                  style={{
                    marginLeft: index ? -9 : 0,
                    borderRadius: 18,
                    borderWidth: 2,
                    borderColor: tokens.background,
                  }}
                >
                  <Avatar
                    label={member.name}
                    initials={member.name
                      .split(/\\s+/)
                      .map((part) => part[0] ?? '')
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                    size={28}
                    avatarId={member.avatarId}
                    imageUrl={member.avatarUrl}
                  />
                </View>
              ))}
              {group.memberCount > members.length && (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    marginLeft: -8,
                    borderWidth: 2,
                    borderColor: tokens.background,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tokens.surfaceRaised,
                  }}
                >
                  <Text style={{ fontSize: 10, color: tokens.foregroundMuted }}>
                    +{group.memberCount - members.length}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        <ChevronRight size={20} color={tokens.foregroundMuted} />
      </Pressable>
    );
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 24,
          gap: 17,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text
              style={{ color: NETWORK_PURPLE, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 }}
            >
              GROUPS
            </Text>
            <Typography variant="title">Groups</Typography>
            <Text style={{ color: tokens.foregroundMuted, lineHeight: 20 }}>
              Split expenses, chat, and plan together.
            </Text>
          </View>
          <Button
            onPress={p.onCreate}
            style={{ minHeight: 42, paddingHorizontal: 15, backgroundColor: NETWORK_PURPLE }}
          >
            <Plus size={18} color={ICON_INK} />
            <Text style={{ color: ICON_INK, fontWeight: '700' }}>New</Text>
          </Button>
        </View>

        <View
          style={{
            minHeight: 48,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            borderRadius: 13,
            paddingHorizontal: 13,
            backgroundColor: tokens.surfaceSubtle,
          }}
        >
          <Search size={19} color={tokens.foregroundMuted} />
          <Input
            accessibilityLabel="Search groups"
            placeholder="Search groups"
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent', minHeight: 44 }}
          />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {filters.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.id }}
              onPress={() => {
                setFilter(item.id);
                if (item.id === 'invited') setInvitationsOpen(true);
              }}
              style={{
                minHeight: 38,
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: filter === item.id ? NETWORK_PURPLE : tokens.borderSubtle,
                borderRadius: 13,
                paddingHorizontal: 16,
                backgroundColor: filter === item.id ? NETWORK_PURPLE : 'transparent',
              }}
            >
              <Text style={{ color: filter === item.id ? ICON_INK : tokens.foreground }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {p.error ? (
          <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {p.error}
          </Text>
        ) : null}
        {p.loading ? (
          <Typography accessibilityLiveRegion="polite">Loading groups…</Typography>
        ) : filtered.length ? (
          <View style={{ gap: 9 }}>{filtered.map(renderGroup)}</View>
        ) : (
          <FinanceEmptyState
            kind={query ? 'search' : 'group'}
            title={query ? 'No matching groups' : 'No groups yet'}
            description={
              query
                ? 'Try another group name.'
                : 'Create a group to split expenses and plan together.'
            }
            action={!query ? <Button onPress={p.onCreate}>Create a group</Button> : undefined}
          />
        )}
      </ScrollView>
      <InvitationInbox
        invitations={p.invitations}
        loading={p.invitationsLoading}
        error={p.invitationsError}
        onRespond={p.onRespondToInvitation}
        open={invitationsOpen}
        onClose={() => setInvitationsOpen(false)}
      />
    </>
  );
}
