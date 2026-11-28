import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ArrowLeft,
  ArrowLeftRight,
  ChartBar,
  ChatCircle,
  UsersThree,
} from '@finapp/ui/icons/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FinanceEmptyState,
  formatLowerBound,
  formatTransactionDate,
  isAnalyticsLinkAvailable,
  Money,
  personStatus,
  TransactionRow,
} from '@finapp/ui/finance';
import { Avatar, IconButton, SectionHeader, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import {
  useLocalGroupRange,
  useLocalRecords,
  type FetchCloudGroupRangePage,
} from '@/hooks/useLocalRecords';
import { bilateralBalancesByCurrency } from '../../../convex/splits/domain';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { toast } from '@/lib/toast';

type GroupRecord = LocalRecord & { id?: string; _id?: string; name?: string; currency?: string };
type GroupMemberRecord = LocalRecord & {
  id?: string;
  _id?: string;
  deletedAt?: number;
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

export default function PublicProfileScreen() {
  const { username: routeName } = useLocalSearchParams<{ username: string }>();
  const routeHandle = Array.isArray(routeName) ? routeName[0] : routeName;
  const handle =
    routeHandle?.startsWith('@') && !routeHandle.startsWith('@@') ? routeHandle.slice(1) : '';
  const publicProfile = useQuery(
    api.users.queries.publicProfile,
    handle ? { username: handle } : 'skip',
  );
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected, fetchGroupRange } = useLocalSync();
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
  const profileHandle = publicProfile?.username?.replace(/^@+/, '') ?? '';
  const activeMembers = (allMembers ?? []).filter((member) => member.deletedAt === undefined);
  const matchingMembers = activeMembers.filter(
    (member) => member.username?.replace(/^@+/, '').toLowerCase() === profileHandle.toLowerCase(),
  );
  const personId = String(matchingMembers[0]?.userId ?? matchingMembers[0]?.memberId ?? '');
  const groupIds = new Set(
    matchingMembers.map((member) => String(member.groupId ?? '')).filter(Boolean),
  );
  const viewerGroupIds = new Set(
    activeMembers
      .filter((member) => userId && (member.userId ?? member.memberId) === userId)
      .map((member) => String(member.groupId ?? ''))
      .filter(Boolean),
  );
  const sharedGroups = (groups ?? []).filter((group) =>
    [group.id, group._id, group.cloudId].some(
      (id) => typeof id === 'string' && groupIds.has(id) && viewerGroupIds.has(id),
    ),
  );
  const authorizedSharedTimeline = Boolean(
    publicProfile && userId && personId && matchingMembers.length > 0 && sharedGroups.length > 0,
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
    authorizedSharedTimeline &&
    Boolean(userId && personId && groups && allMembers) &&
    recordsReady &&
    rangesCovered;
  // One balance per shared currency; group order never picks the currency.
  const balances = balanceAvailable
    ? bilateralBalancesByCurrency(
        userId!,
        personId,
        sharedGroups,
        ledger[0].data ?? [],
        ledger[1].data ?? [],
        ledger[2].data ?? [],
        ledger[3].data ?? [],
      )
    : [];
  const bilateralBalance = balances[0]?.balanceMinor ?? 0n;
  const otherBalances = balances.slice(1).filter((row) => row.balanceMinor !== 0n);
  const otherId =
    publicProfile?.id && publicProfile.id !== userId ? (publicProfile.id as Id<'users'>) : null;
  const live = Boolean(userId && isConnected && otherId);
  const relationship = useQuery(
    api.social.queries.relationship,
    live && otherId ? { userId: otherId } : 'skip',
  );
  const analytics = useQuery(
    api.social.queries.personAnalytics,
    live && otherId
      ? { userId: otherId, tzOffsetMinutes: -new Date().getTimezoneOffset() }
      : 'skip',
  );
  const sendRequest = useMutation(api.social.mutations.sendRequest);
  const respondToRequest = useMutation(api.social.mutations.respondToRequest);
  const startConversation = useMutation(api.directMessages.mutations.startConversation);
  const [busy, setBusy] = React.useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const isSelf = Boolean(userId && publicProfile?.id === userId);
  const status = relationship?.status;
  const incomingId =
    relationship && 'incomingRequestId' in relationship
      ? relationship.incomingRequestId
      : undefined;
  const mutualFriends = relationship?.mutualFriends ?? [];
  const serverGroups = relationship?.sharedGroups ?? [];
  const canOpenAnalytics = isAnalyticsLinkAvailable(
    analytics,
    status === 'friends',
    serverGroups.length,
  );
  const presence = analytics ? personStatus(analytics) : '';
  const since = analytics?.friendsSince ?? analytics?.conversationSince;
  const card = {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
    backgroundColor: tokens.card,
  } as const;
  const chip = (label: string, accent = false) => (
    <View
      key={label}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: accent ? tokens.primary : tokens.borderSubtle,
      }}
    >
      <Text style={{ color: accent ? tokens.primary : tokens.foregroundMuted, fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
  const actionButton = (
    label: string,
    onPress: () => void,
    options: { primary?: boolean; icon?: React.ReactNode; disabled?: boolean } = {},
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={options.disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        height: 44,
        paddingHorizontal: 14,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: options.primary ? tokens.primary : tokens.borderSubtle,
        backgroundColor: options.primary ? tokens.primary : 'transparent',
        opacity: options.disabled ? 0.6 : pressed ? 0.8 : 1,
      })}
    >
      {options.icon}
      <Text
        style={{
          color: options.primary ? tokens.primaryForeground : tokens.foreground,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const primaryAction = () => {
    if (!otherId) return null;
    if (status === 'friends' || analytics?.conversationId)
      return actionButton(
        'Message',
        () =>
          void run(async () => {
            const conversationId =
              analytics?.conversationId ?? (await startConversation({ userId: otherId }));
            router.push(`/messages/${encodeURIComponent(String(conversationId))}` as never);
          }),
        { primary: true, icon: <ChatCircle size={17} color={tokens.primaryForeground} /> },
      );
    if (status === 'incoming' && incomingId)
      return actionButton(
        'Accept request',
        () =>
          void run(async () => {
            await respondToRequest({ requestId: incomingId, response: 'accept' });
          }),
        { primary: true },
      );
    if (status === 'outgoing') return actionButton('Request sent', () => {}, { disabled: true });
    if (status === 'none')
      return actionButton(
        'Add friend',
        () =>
          void run(async () => {
            await sendRequest({ recipientId: otherId });
          }),
        { primary: true },
      );
    return null;
  };
  const stat = (label: string, value: React.ReactNode, note?: string, tone?: string) => (
    <View key={label} style={[card, { flexBasis: '47%', flexGrow: 1, padding: 14, gap: 4 }]}>
      <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={{ color: tokens.foreground, fontSize: 20, fontWeight: '600' }}>{value}</Text>
      ) : (
        value
      )}
      {note ? (
        <Text style={{ color: tone ?? tokens.foregroundMuted, fontSize: 11 }}>{note}</Text>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 32,
        gap: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Text style={{ flex: 1, color: tokens.foregroundMuted, fontSize: 15 }}>Profile</Text>
        {otherId && userId && canOpenAnalytics ? (
          <IconButton
            label="Analytics"
            variant="ghost"
            onPress={() => router.push(`/network/person/${encodeURIComponent(otherId)}` as never)}
          >
            <ChartBar size={20} color={tokens.foreground} />
          </IconButton>
        ) : null}
      </View>

      {publicProfile === undefined && handle ? (
        <Typography variant="body">Loading…</Typography>
      ) : !publicProfile ? (
        <Typography variant="body">This profile could not be found.</Typography>
      ) : (
        <View style={[card, { overflow: 'hidden' }]}>
          <View style={{ height: 96, backgroundColor: tokens.surfaceSubtle }}>
            <View
              style={{
                position: 'absolute',
                left: -40,
                top: -60,
                width: 220,
                height: 160,
                borderRadius: 110,
                backgroundColor: tokens.primary,
                opacity: 0.22,
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: -30,
                bottom: -70,
                width: 200,
                height: 140,
                borderRadius: 100,
                backgroundColor: tokens.chart.violet,
                opacity: 0.2,
              }}
            />
          </View>
          <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>
            <View
              style={{
                marginTop: -46,
                alignSelf: 'flex-start',
                borderRadius: 60,
                borderWidth: 4,
                borderColor: tokens.card,
                backgroundColor: tokens.card,
              }}
            >
              <Avatar
                initials={publicProfile.displayName.slice(0, 2).toUpperCase()}
                label={`@${profileHandle}`}
                size={88}
                imageUrl={publicProfile.avatarUrl ?? undefined}
                avatarId={publicProfile.avatarId ?? undefined}
              />
              {analytics?.active ? (
                <View
                  accessibilityLabel="Active now"
                  style={{
                    position: 'absolute',
                    right: 4,
                    bottom: 4,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 3,
                    borderColor: tokens.card,
                    backgroundColor: tokens.positive,
                  }}
                />
              ) : null}
            </View>
            <View style={{ gap: 3 }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: tokens.foreground,
                  fontSize: 26,
                  fontFamily: 'SpaceGrotesk_600SemiBold',
                  letterSpacing: -0.8,
                }}
              >
                {publicProfile.displayName}
              </Text>
              <Text style={{ color: tokens.foregroundMuted, fontSize: 14 }}>
                @{profileHandle}
                {presence ? ` · ${presence}` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {isSelf ? chip('This is you') : null}
              {status === 'friends' ? chip('Friends', true) : null}
              {status === 'incoming' ? chip('Sent you a request') : null}
              {serverGroups.length
                ? chip(
                    `${serverGroups.length} shared ${serverGroups.length === 1 ? 'group' : 'groups'}`,
                  )
                : null}
              {mutualFriends.length ? chip(`${mutualFriends.length} mutual`) : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {isSelf
                ? actionButton('Edit profile', () => router.push('/(tabs)/profile' as never), {
                    primary: true,
                  })
                : userId
                  ? [
                      primaryAction(),
                      sharedGroups.length
                        ? actionButton('Split', () => router.push('/split/new' as never), {
                            icon: <UsersThree size={17} color={tokens.foreground} />,
                          })
                        : null,
                      sharedGroups.length
                        ? actionButton(
                            'Settle',
                            () => router.push(`/settle/${profileHandle}` as never),
                            { icon: <ArrowLeftRight size={17} color={tokens.foreground} /> },
                          )
                        : null,
                    ]
                  : null}
            </View>
          </View>
        </View>
      )}

      {publicProfile && userId && !isSelf ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {stat(
            'Balance',
            balanceAvailable ? (
              <Money
                amountMinor={bilateralBalance < 0n ? -bilateralBalance : bilateralBalance}
                currency={balances[0]?.currency ?? 'INR'}
                size="body"
              />
            ) : (
              '—'
            ),
            !balanceAvailable
              ? sharedGroups.length
                ? 'Loading…'
                : 'No shared groups'
              : bilateralBalance === 0n
                ? 'You’re even'
                : bilateralBalance > 0n
                  ? 'They owe you'
                  : 'You owe them',
            balanceAvailable && bilateralBalance > 0n
              ? tokens.income
              : balanceAvailable && bilateralBalance < 0n
                ? tokens.expense
                : undefined,
          )}
          {stat(
            'Messages',
            analytics
              ? formatLowerBound(analytics.totalMessages, analytics.totalMessagesCapped)
              : '—',
            'Last 30 days',
          )}
          {stat(
            analytics?.friends ? 'Friends since' : 'Connected since',
            since
              ? new Date(since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
              : '—',
          )}
          {stat('Shared groups', String(serverGroups.length || sharedGroups.length))}
          {otherBalances.map((row) => (
            <View key={row.currency} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Money
                amountMinor={row.balanceMinor < 0n ? -row.balanceMinor : row.balanceMinor}
                currency={row.currency}
                size="body"
              />
              <Typography variant="caption">
                {row.balanceMinor > 0n ? 'they owe you' : 'you owe'}
              </Typography>
            </View>
          ))}
        </View>
      ) : null}

      {serverGroups.length ? (
        <View style={[card, { padding: 16, gap: 6 }]}>
          <SectionHeader title="Shared groups" />
          {serverGroups.map((group) => (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityLabel={group.name}
              onPress={() => router.push(`/group/${encodeURIComponent(group.id)}` as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: group.color ?? tokens.primary,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: tokens.foreground, fontWeight: '600' }}>
                  {group.name}
                </Text>
                <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
                  {group.memberCount} members
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {mutualFriends.length ? (
        <View style={[card, { padding: 16, gap: 6 }]}>
          <SectionHeader title="Mutual friends" />
          {mutualFriends.map((friend) => (
            <Pressable
              key={friend.id}
              accessibilityRole="button"
              accessibilityLabel={friend.displayName}
              onPress={() =>
                friend.username
                  ? router.push(`/@${encodeURIComponent(friend.username)}` as never)
                  : undefined
              }
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
            >
              <Avatar
                initials={friend.displayName.slice(0, 2).toUpperCase()}
                size={34}
                imageUrl={friend.avatarUrl ?? undefined}
                avatarId={friend.avatarId}
              />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: tokens.foreground, fontWeight: '600' }}>
                  {friend.displayName}
                </Text>
                {friend.username ? (
                  <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
                    @{friend.username}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {authorizedSharedTimeline ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Between you" />
          {sharedGroups.map((group) => (
            <GroupTimeline
              key={String(group.id ?? group._id)}
              userId={userId}
              group={group}
              startAt={startAt}
              endAt={endAt}
              fetchGroupRange={fetchGroupRange}
              onRangeStatus={reportRangeStatus}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
