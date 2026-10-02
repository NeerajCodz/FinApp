import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowLeftRight, UsersThree } from '@finapp/ui/icons/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FinanceEmptyState,
  formatTransactionDate,
  Money,
  TransactionRow,
} from '@finapp/ui/finance';
import { Avatar, Button, IconButton, SectionHeader, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import {
  useLocalGroupRange,
  useLocalRecords,
  type FetchCloudGroupRangePage,
} from '@/hooks/useLocalRecords';
import { calculateBilateralBalance } from '../../../../convex/splits/domain';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type GroupRecord = LocalRecord & { id?: string; _id?: string; name?: string; currency?: string };
type GroupMemberRecord = LocalRecord & {
  id?: string;
  _id?: string;
  groupId?: string;
  userId?: string;
  memberId?: string;
  username?: string;
  avatarId?: string;
  avatarUrl?: string | null;
};
type TimelineRecord = LocalRecord & {
  id?: string;
  _id?: string;
  groupId?: string;
  amountMinor?: bigint;
  currency?: string;
  title?: string;
  occurredAt?: number;
  hasTime?: boolean;
};

function GroupTimeline({
  userId,
  group,
  startAt,
  endAt,
  fetchGroupRange,
  onRangeStatus,
}: {
  userId: string | null;
  group: GroupRecord;
  startAt: number;
  endAt: number;
  fetchGroupRange: FetchCloudGroupRangePage;
  onRangeStatus: (groupId: string, covered: boolean) => void;
}) {
  const groupId = String(group.id ?? group._id ?? '');
  const { transactions, covered } = useLocalGroupRange<TimelineRecord>(
    userId,
    groupId,
    startAt,
    endAt,
    fetchGroupRange,
  );
  React.useEffect(() => {
    onRangeStatus(groupId, covered);
  }, [covered, groupId, onRangeStatus]);
  const groupAliases = new Set(
    [group.id, group._id, group.cloudId].filter(
      (value): value is string => typeof value === 'string',
    ),
  );
  const expenses =
    transactions?.filter(
      (record) => typeof record.groupId === 'string' && groupAliases.has(record.groupId),
    ) ?? [];
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
          semanticType="split"
          date={formatTransactionDate(
            Number(transaction.occurredAt ?? Date.now()),
            Boolean(transaction.hasTime),
          )}
        />
      ))}
    </>
  ) : (
    <FinanceEmptyState
      kind="activity"
      title="Nothing shared yet."
      description="Expenses between you will appear here, grouped across your shared groups."
      compact
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
  const transactionsState = useLocalRecords<LocalRecord & { groupId?: string }>(
    userId,
    'transaction',
  );
  const payerState = useLocalRecords<LocalRecord & { transactionId?: string }>(
    userId,
    'expensePayer',
  );
  const participantState = useLocalRecords<LocalRecord & { transactionId?: string }>(
    userId,
    'expenseParticipant',
  );
  const settlementState = useLocalRecords<LocalRecord & { groupId?: string }>(userId, 'settlement');
  const ledger = [transactionsState, payerState, participantState, settlementState] as const;
  const handle = username?.replace(/^@+/, '') ?? 'person';
  const matchingMembers = (allMembers ?? []).filter(
    (member) => member.username?.replace(/^@+/, '').toLowerCase() === handle.toLowerCase(),
  );
  const personId = String(matchingMembers[0]?.userId ?? matchingMembers[0]?.memberId ?? '');
  const groupIds = new Set(
    matchingMembers.map((member) => String(member.groupId ?? '')).filter(Boolean),
  );
  const sharedGroups = (groups ?? []).filter((group) =>
    [group.id, group._id, group.cloudId].some((id) => typeof id === 'string' && groupIds.has(id)),
  );
  const [rangeStates, setRangeStates] = React.useState<Record<string, boolean>>({});
  const reportRangeStatus = React.useCallback((groupId: string, covered: boolean) => {
    setRangeStates((previous) =>
      previous[groupId] === covered ? previous : { ...previous, [groupId]: covered },
    );
  }, []);
  const startAt = React.useMemo(() => Date.now() - 90 * 24 * 60 * 60 * 1000, []);
  const endAt = React.useMemo(() => Date.now() + 1, []);
  const recordsReady = ledger.every(
    (state) => state.data !== undefined && !state.loading && !state.error,
  );
  const rangesCovered = sharedGroups.every(
    (group) => rangeStates[String(group.id ?? group._id ?? '')] === true,
  );
  const balanceAvailable =
    Boolean(userId && personId && groups && allMembers) && recordsReady && rangesCovered;
  const bilateralBalance = balanceAvailable
    ? calculateBilateralBalance(
        userId!,
        personId,
        sharedGroups,
        ledger[0].data ?? [],
        ledger[1].data ?? [],
        ledger[2].data ?? [],
        ledger[3].data ?? [],
      )
    : 0n;
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
          <Avatar
            initials={handle.slice(0, 2).toUpperCase()}
            label={`@${handle}`}
            size={60}
            imageUrl={matchingMembers[0]?.avatarUrl}
            avatarId={matchingMembers[0]?.avatarId}
          />
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
          {balanceAvailable ? (
            <Money
              amountMinor={bilateralBalance < 0n ? -bilateralBalance : bilateralBalance}
              currency={String(sharedGroups[0]?.currency ?? 'INR')}
              size="display"
            />
          ) : (
            <Typography variant="small">
              Balance unavailable until saved group ranges are complete.
            </Typography>
          )}
          <Typography variant="caption">
            {balanceAvailable
              ? bilateralBalance === 0n
                ? 'Even across shared groups'
                : bilateralBalance > 0n
                  ? 'They owe you across shared groups'
                  : 'You owe across shared groups'
              : 'Across shared groups'}
          </Typography>
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
              onRangeStatus={reportRangeStatus}
            />
          ))
        ) : (
          <FinanceEmptyState
            kind="group"
            title="Nothing shared yet."
            description="Expenses between you will appear here, grouped across your shared groups."
            compact
          />
        )}
      </View>
    </ScrollView>
  );
}
