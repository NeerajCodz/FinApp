import React from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretRight, ChartBar, MagnifyingGlass } from '@finapp/ui/icons/native';
import { Avatar, Text, useTheme } from '@finapp/ui/native';
import { GroupTile } from './GroupPrimitives';
import { FinanceEmptyState } from './FinanceEmptyState';
import {
  matchesHubSearch,
  personStatus,
  unreadBadge,
  type HubGroup,
  type HubPerson,
} from '../peopleHub';

export type PeopleHubScreenProps = {
  people: readonly HubPerson[] | undefined;
  groups: readonly HubGroup[] | undefined;
  peopleTruncated?: boolean;
  /** Rendered at the top right next to the analytics button (e.g. the profile avatar). */
  headerAction?: React.ReactNode;
  onOpenAnalytics: () => void;
  onOpenPeople: () => void;
  onOpenGroups: () => void;
  onOpenPerson: (person: HubPerson) => void;
  onOpenPersonAnalytics: (person: HubPerson) => void;
  onOpenGroup: (group: HubGroup) => void;
  onOpenGroupAnalytics: (group: HubGroup) => void;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

function Badge({ label }: { label: string }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -6,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 5,
        borderRadius: 10,
        backgroundColor: tokens.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: tokens.primaryForeground, fontSize: 11, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function SectionTitle({ title, onPress }: { title: string; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`All ${title.toLowerCase()}`}
      onPress={onPress}
      hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }}
    >
      <Text
        style={{ color: tokens.foreground, fontSize: 18, fontFamily: 'SpaceGrotesk_600SemiBold' }}
      >
        {title}
      </Text>
      <CaretRight size={16} color={tokens.foregroundMuted} />
    </Pressable>
  );
}

function AnalyticsChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 28,
        height: 28,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.popover,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ChartBar size={15} color={tokens.foregroundMuted} />
    </Pressable>
  );
}

/** People hub: search, a horizontal row of people, then your groups. */
export function PeopleHubScreen(p: PeopleHubScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = React.useState('');
  const people = (p.people ?? []).filter((person) => matchesHubSearch(person, query));
  const groups = (p.groups ?? []).filter((group) => matchesHubSearch(group, query));
  const card = {
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
    borderRadius: 18,
    backgroundColor: tokens.card,
  } as const;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: 32,
        gap: 22,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: tokens.foreground,
            fontSize: 30,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            letterSpacing: -1,
          }}
        >
          People
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="People analytics"
          onPress={p.onOpenAnalytics}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.surfaceSubtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChartBar size={20} color={tokens.foreground} />
        </Pressable>
        {p.headerAction}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          height: 46,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        <MagnifyingGlass size={18} color={tokens.foregroundMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people and groups"
          placeholderTextColor={tokens.foregroundSubtle}
          accessibilityLabel="Search people and groups"
          autoCapitalize="none"
          style={{ flex: 1, color: tokens.foreground, fontSize: 15 }}
        />
      </View>

      <View>
        <SectionTitle title="People" onPress={p.onOpenPeople} />
        {p.people === undefined ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[card, { width: 128, height: 150, backgroundColor: tokens.surfaceSubtle }]}
              />
            ))}
          </View>
        ) : people.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 4 }}
            style={{ marginHorizontal: -16 }}
          >
            <View style={{ width: 4 }} />
            {people.map((person) => {
              const badge = unreadBadge(person.unreadCount, person.unreadCapped);
              const status = personStatus(person);
              return (
                <View key={person.id} style={[card, { width: 128 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${person.displayName}${badge ? `, ${badge} new messages` : ''}`}
                    onPress={() => p.onOpenPerson(person)}
                    style={{
                      alignItems: 'center',
                      gap: 4,
                      paddingTop: 18,
                      paddingBottom: 14,
                      paddingHorizontal: 10,
                    }}
                  >
                    <View>
                      <Avatar
                        initials={initialsOf(person.displayName)}
                        label={person.displayName}
                        size={56}
                        imageUrl={person.avatarUrl}
                        avatarId={person.avatarId}
                      />
                      {person.active ? (
                        <View
                          style={{
                            position: 'absolute',
                            right: 2,
                            bottom: 2,
                            width: 13,
                            height: 13,
                            borderRadius: 7,
                            borderWidth: 2,
                            borderColor: tokens.card,
                            backgroundColor: tokens.positive,
                          }}
                        />
                      ) : null}
                      {badge ? <Badge label={badge} /> : null}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 6,
                        color: tokens.foreground,
                        fontSize: 14,
                        fontWeight: '600',
                      }}
                    >
                      {person.displayName}
                    </Text>
                    <Text numberOfLines={1} style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
                      {status || (person.username ? `@${person.username}` : ' ')}
                    </Text>
                  </Pressable>
                  <View style={{ position: 'absolute', top: 8, right: 8 }}>
                    <AnalyticsChip
                      label={`${person.displayName} analytics`}
                      onPress={() => p.onOpenPersonAnalytics(person)}
                    />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>
            {query ? 'No people match your search.' : 'Add friends to see them here.'}
          </Text>
        )}
        {p.peopleTruncated ? (
          <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
            Showing a limited set of people; some contacts may be omitted.
          </Text>
        ) : null}
      </View>

      <View>
        <SectionTitle title="Groups" onPress={p.onOpenGroups} />
        {p.groups === undefined ? (
          <View style={[card, { height: 76, backgroundColor: tokens.surfaceSubtle }]} />
        ) : groups.length ? (
          <View style={{ gap: 10 }}>
            {groups.map((group) => {
              const badge = unreadBadge(group.unreadCount, group.unreadCapped);
              return (
                <View key={group.id} style={[card, { flexDirection: 'row', alignItems: 'center' }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${group.name}${badge ? `, ${badge} new messages` : ''}`}
                    onPress={() => p.onOpenGroup(group)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                    }}
                  >
                    <View>
                      <GroupTile icon={group.icon} color={group.color} size={46} />
                      {badge ? <Badge label={badge} /> : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: tokens.foreground, fontSize: 15, fontWeight: '600' }}
                      >
                        {group.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: tokens.foregroundMuted, fontSize: 12 }}
                      >
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                        {group.balanceLabel ? (
                          <Text
                            style={{
                              color:
                                group.balanceTone === 'positive'
                                  ? tokens.income
                                  : group.balanceTone === 'negative'
                                    ? tokens.expense
                                    : tokens.foregroundMuted,
                            }}
                          >
                            {` · ${group.balanceLabel}`}
                          </Text>
                        ) : null}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={{ paddingRight: 12 }}>
                    <AnalyticsChip
                      label={`${group.name} analytics`}
                      onPress={() => p.onOpenGroupAnalytics(group)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : query ? (
          <Text style={{ color: tokens.foregroundMuted }}>No groups match your search.</Text>
        ) : (
          <FinanceEmptyState
            kind="group"
            title="No groups yet"
            description="Create a group to split trips, rent or dinners."
          />
        )}
      </View>
    </ScrollView>
  );
}
