import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChatCircle } from '@finapp/ui/icons/native';
import { Avatar, Text, useTheme } from '@finapp/ui/native';
import { GroupTile } from './GroupPrimitives';
import { personStatus, type HubGroup, type HubPerson } from '../peopleHub';

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const shortDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function useCard() {
  const { tokens } = useTheme();
  return {
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
    borderRadius: 18,
    backgroundColor: tokens.card,
  } as const;
}

function Screen({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 32,
        gap: 16,
      }}
    >
      {children}
    </ScrollView>
  );
}

function Header({
  title,
  subtitle,
  onBack,
  leading,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  leading?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft size={18} color={tokens.foreground} />
      </Pressable>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ color: tokens.foreground, fontSize: 22, fontFamily: 'SpaceGrotesk_600SemiBold' }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: tokens.foregroundMuted, fontSize: 13 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Kpis({ items }: { items: readonly { label: string; value: string; note?: string }[] }) {
  const { tokens } = useTheme();
  const card = useCard();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((item) => (
        <View key={item.label} style={[card, { flexBasis: '47%', flexGrow: 1, gap: 4 }]}>
          <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>{item.label}</Text>
          <Text style={{ color: tokens.foreground, fontSize: 20, fontWeight: '600' }}>
            {item.value}
          </Text>
          {item.note ? (
            <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>{item.note}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const { tokens } = useTheme();
  const card = useCard();
  return (
    <View style={[card, { gap: 12 }]}>
      <Text style={{ color: tokens.foreground, fontSize: 16, fontWeight: '600' }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  leading,
  title,
  subtitle,
  trailing,
  trailingTone,
  onPress,
}: {
  leading: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: string;
  trailingTone?: HubGroup['balanceTone'];
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: tokens.foreground, fontWeight: '600' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text
          style={{
            fontSize: 12,
            color:
              trailingTone === 'positive'
                ? tokens.income
                : trailingTone === 'negative'
                  ? tokens.expense
                  : tokens.foregroundMuted,
          }}
        >
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}

export type PeopleAnalyticsScreenProps = {
  people: readonly HubPerson[] | undefined;
  groups: readonly HubGroup[];
  onBack: () => void;
  onOpenPerson: (person: HubPerson) => void;
  onOpenGroup: (group: HubGroup) => void;
};

/** Analytics across your network: people, groups and unread. */
export function PeopleAnalyticsScreen(p: PeopleAnalyticsScreenProps) {
  const { tokens } = useTheme();
  const people = p.people ?? [];
  const unread =
    people.reduce((sum, person) => sum + person.unreadCount, 0) +
    p.groups.reduce((sum, group) => sum + (group.unreadCount ?? 0), 0);
  const maxMembers = Math.max(1, ...p.groups.map((group) => group.memberCount));
  return (
    <Screen>
      <Header title="People analytics" subtitle="Your conversations and groups" onBack={p.onBack} />
      <Kpis
        items={[
          {
            label: 'People',
            value: String(people.length),
            note: `${people.filter((person) => person.active).length} active now`,
          },
          { label: 'Groups', value: String(p.groups.length) },
          { label: 'Unread', value: String(unread), note: 'Across chats' },
          {
            label: 'Chatting with',
            value: String(people.filter((person) => person.conversationId).length),
            note: 'Direct conversations',
          },
        ]}
      />
      <Panel title="Group sizes">
        {p.groups.length ? (
          [...p.groups]
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 8)
            .map((group) => (
              <View key={group.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text
                  numberOfLines={1}
                  style={{ width: '32%', color: tokens.foreground, fontSize: 13 }}
                >
                  {group.name}
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.max(4, (group.memberCount / maxMembers) * 100)}%`,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: tokens.primary,
                    }}
                  />
                </View>
                <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
                  {group.memberCount}
                </Text>
              </View>
            ))
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>No groups yet.</Text>
        )}
      </Panel>
      <Panel title="People">
        {people.length ? (
          people.map((person) => (
            <Row
              key={person.id}
              leading={
                <Avatar
                  initials={initialsOf(person.displayName)}
                  size={36}
                  imageUrl={person.avatarUrl}
                  avatarId={person.avatarId}
                />
              }
              title={person.displayName}
              subtitle={
                personStatus(person) || (person.username ? `@${person.username}` : undefined)
              }
              trailing={person.unreadCount ? `${person.unreadCount} unread` : undefined}
              onPress={() => p.onOpenPerson(person)}
            />
          ))
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>
            {p.people === undefined ? 'Loading…' : 'No people yet.'}
          </Text>
        )}
      </Panel>
      <Panel title="Groups">
        {p.groups.length ? (
          p.groups.map((group) => (
            <Row
              key={group.id}
              leading={<GroupTile icon={group.icon} color={group.color} size={36} />}
              title={group.name}
              subtitle={`${group.memberCount} members`}
              trailing={group.balanceLabel}
              trailingTone={group.balanceTone}
              onPress={() => p.onOpenGroup(group)}
            />
          ))
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>No groups yet.</Text>
        )}
      </Panel>
    </Screen>
  );
}

export type PersonAnalyticsData = {
  profile: {
    displayName: string;
    username?: string;
    avatarId?: string;
    avatarUrl?: string | null;
  };
  friends: boolean;
  friendsSince: number | null;
  conversationSince: number | null;
  active: boolean | null;
  lastSeenAt: number | null;
  days: readonly { dayStart: number; sent: number; received: number }[];
  totalMessages: number;
  mix: { text: number; image: number; audio: number; ai: number };
  sharedGroups: readonly { id: string; name: string; icon?: string; color?: string }[];
};

export type PersonAnalyticsScreenProps = {
  data: PersonAnalyticsData | null | undefined;
  onBack: () => void;
  onMessage?: () => void;
  onOpenProfile?: () => void;
  onOpenGroup: (id: string) => void;
};

/** One person: 30-day message activity, message mix and shared groups. */
export function PersonAnalyticsScreen(p: PersonAnalyticsScreenProps) {
  const { tokens } = useTheme();
  if (p.data === undefined)
    return (
      <Screen>
        <Header title="Analytics" onBack={p.onBack} />
        <Text style={{ color: tokens.foregroundMuted }}>Loading analytics…</Text>
      </Screen>
    );
  if (p.data === null)
    return (
      <Screen>
        <Header title="Analytics" subtitle="Not available" onBack={p.onBack} />
        <Text style={{ color: tokens.foregroundMuted }}>
          Analytics are available for people you&apos;re friends with, message, or share a group
          with.
        </Text>
      </Screen>
    );
  const d = p.data;
  const sent = d.days.reduce((sum, day) => sum + day.sent, 0);
  const received = d.days.reduce((sum, day) => sum + day.received, 0);
  const activeDays = d.days.filter((day) => day.sent + day.received > 0).length;
  const max = Math.max(1, ...d.days.map((day) => day.sent + day.received));
  const since = d.friendsSince ?? d.conversationSince;
  const received_color = tokens.chart.blue;
  const mix = (
    [
      ['Text', d.mix.text],
      ['Photos', d.mix.image],
      ['Voice', d.mix.audio],
      ['FinAI replies', d.mix.ai],
    ] as const
  ).filter(([, value]) => value > 0);
  return (
    <Screen>
      <Header
        title={d.profile.displayName}
        subtitle={[d.profile.username ? `@${d.profile.username}` : '', personStatus(d)]
          .filter(Boolean)
          .join(' · ')}
        onBack={p.onBack}
        leading={
          <Avatar
            initials={initialsOf(d.profile.displayName)}
            size={44}
            imageUrl={d.profile.avatarUrl}
            avatarId={d.profile.avatarId}
          />
        }
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {p.onMessage ? (
          <Pressable
            accessibilityRole="button"
            onPress={p.onMessage}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: tokens.primary,
            }}
          >
            <ChatCircle size={16} color={tokens.primaryForeground} />
            <Text style={{ color: tokens.primaryForeground, fontWeight: '600' }}>Message</Text>
          </Pressable>
        ) : null}
        {p.onOpenProfile ? (
          <Pressable
            accessibilityRole="button"
            onPress={p.onOpenProfile}
            style={{
              justifyContent: 'center',
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <Text style={{ color: tokens.foreground, fontWeight: '600' }}>View profile</Text>
          </Pressable>
        ) : null}
      </View>
      <Kpis
        items={[
          { label: 'Messages', value: String(d.totalMessages), note: 'Last 30 days' },
          { label: 'Sent / received', value: `${sent} / ${received}` },
          { label: 'Active days', value: String(activeDays), note: 'of 30' },
          {
            label: d.friends ? 'Friends since' : 'Chatting since',
            value: since ? shortDate(since) : '—',
          },
        ]}
      />
      <Panel title="Message activity">
        <View
          accessible
          accessibilityLabel={`${d.totalMessages} messages in the last 30 days`}
          style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 2 }}
        >
          {d.days.map((day) => (
            <View
              key={day.dayStart}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end', gap: 1 }}
            >
              {day.received ? (
                <View
                  style={{
                    height: `${(day.received / max) * 100}%`,
                    borderRadius: 2,
                    backgroundColor: received_color,
                  }}
                />
              ) : null}
              {day.sent ? (
                <View
                  style={{
                    height: `${(day.sent / max) * 100}%`,
                    borderRadius: 2,
                    backgroundColor: tokens.primary,
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>
            {d.days[0] ? shortDate(d.days[0].dayStart) : ''}
          </Text>
          <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>Today</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {[
            ['You', tokens.primary],
            [d.profile.displayName, received_color],
          ].map(([label, color]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
              <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>{label}</Text>
            </View>
          ))}
        </View>
      </Panel>
      <Panel title="Message mix">
        {mix.length ? (
          mix.map(([label, value]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ width: 64, color: tokens.foreground, fontSize: 13 }}>{label}</Text>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <View
                  style={{
                    width: `${Math.max(4, (value / Math.max(1, d.totalMessages)) * 100)}%`,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: tokens.primary,
                  }}
                />
              </View>
              <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
                {Math.round((value / Math.max(1, d.totalMessages)) * 100)}%
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>No messages in the last 30 days.</Text>
        )}
      </Panel>
      <Panel title="Shared groups">
        {d.sharedGroups.length ? (
          d.sharedGroups.map((group) => (
            <Row
              key={group.id}
              leading={<GroupTile icon={group.icon} color={group.color} size={36} />}
              title={group.name}
              onPress={() => p.onOpenGroup(group.id)}
            />
          ))
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>No shared groups.</Text>
        )}
      </Panel>
    </Screen>
  );
}
