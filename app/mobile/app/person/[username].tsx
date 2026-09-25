import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowLeftRight, UsersThree } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money, TransactionRow } from '@/components/finance';
import { Avatar, Button, Empty, IconButton, SectionHeader, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import {
  useLocalGroupRange,
  useLocalRecords,
  type FetchCloudGroupRangePage,
} from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type GroupRecord = LocalRecord & { id?: string; _id?: string; name?: string; currency?: string };
type GroupMemberRecord = LocalRecord & {
  id?: string;
  _id?: string;
  groupId?: string;
  username?: string;
};
type TimelineRecord = LocalRecord & {
  id?: string;
  _id?: string;
  groupId?: string;
  amountMinor?: bigint;
  currency?: string;
  title?: string;
  occurredAt?: number;
};

function GroupTimeline({
  userId,
  group,
  startAt,
  endAt,
  fetchGroupRange,
}: {
  userId: string | null;
  group: GroupRecord;
  startAt: number;
  endAt: number;
  fetchGroupRange: FetchCloudGroupRangePage;
}) {
  const groupId = String(group.id ?? group._id ?? '');
  const { transactions } = useLocalGroupRange<TimelineRecord>(
    userId,
    groupId,
    startAt,
    endAt,
    fetchGroupRange,
  );
  const expenses = transactions?.filter((record) => String(record.groupId) === groupId) ?? [];
  return expenses.length > 0 ? (
    <>
      {expenses.map((transaction) => (
        <TransactionRow
          key={String(transaction.id ?? transaction._id ?? '')}
          title={String(transaction.title ?? 'Group expense')}
          category="Shared expense"
          account={String(group.name ?? 'Group')}
          amountMinor={transaction.amountMinor ?? 0n}
          currency={String(transaction.currency ?? group.currency ?? 'INR')}
          type="expense"
          date={new Date(Number(transaction.occurredAt ?? Date.now())).toLocaleDateString()}
        />
      ))}
    </>
  ) : (
    <Empty
      title="Nothing shared yet."
      description="Expenses between you will appear here, grouped across your shared groups."
    />
  );
}

export default function PersonTimelineScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchGroupRange } = useLocalSync();
  const { data: groups } = useLocalRecords<GroupRecord>(userId, 'group');
  const { data: allMembers } = useLocalRecords<GroupMemberRecord>(userId, 'groupMember');
  const handle = username?.replace(/^@+/, '') ?? 'person';
  const matchingMembers = (allMembers ?? []).filter(
    (member) => member.username?.replace(/^@+/, '').toLowerCase() === handle.toLowerCase(),
  );
  const groupIds = new Set(matchingMembers.map((member) => String(member.groupId ?? '')));
  const sharedGroups = (groups ?? []).filter((group) => groupIds.has(String(group.id ?? group._id)));
  const startAt = React.useMemo(() => Date.now() - 90 * 24 * 60 * 60 * 1000, []);
  const endAt = React.useMemo(() => Date.now() + 1, []);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading">Person</Typography>
      </View>

      <View
        style={{
          padding: 20,
          gap: 18,
          borderRadius: 22,
          backgroundColor: tokens.surfaceSubtle,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar initials={handle.slice(0, 2).toUpperCase()} label={`@${handle}`} size={60} />
          <View style={{ flex: 1, gap: 3 }}>
            <Typography variant="heading">@{handle}</Typography>
            <Typography variant="small">Shared money timeline</Typography>
          </View>
        </View>
        <View
          style={{
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: tokens.borderSubtle,
            gap: 5,
          }}
        >
          <Typography variant="label">Shared balance</Typography>
          <Money amountMinor={0n} currency={String(sharedGroups[0]?.currency ?? 'INR')} size="display" />
          <Typography variant="caption">Across shared groups</Typography>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button size="lg" style={{ flex: 1 }} onPress={() => router.push('/split/new' as never)}>
          <UsersThree size={18} color={tokens.primaryForeground} />
          <Text
            style={{
              marginLeft: 8,
              color: tokens.primaryForeground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Split
          </Text>
        </Button>
        <Button
          size="lg"
          style={{ flex: 1 }}
          variant="outline"
          onPress={() => router.push(`/settle/${handle}` as never)}
        >
          <ArrowLeftRight size={18} color={tokens.foreground} />
          <Text
            style={{
              marginLeft: 8,
              color: tokens.foreground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Settle
          </Text>
        </Button>
      </View>
      <View style={{ gap: 12 }}>
        <SectionHeader title="Between you" />
        {sharedGroups.length > 0 ? (
          sharedGroups.map((group) => (
            <GroupTimeline
              key={String(group.id ?? group._id)}
              userId={userId}
              group={group}
              startAt={startAt}
              endAt={endAt}
              fetchGroupRange={fetchGroupRange}
            />
          ))
        ) : (
          <Empty
            title="Nothing shared yet."
            description="Expenses between you will appear here, grouped across your shared groups."
          />
        )}
      </View>
    </ScrollView>
  );
}
