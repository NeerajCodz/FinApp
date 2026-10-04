import React, { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Check, ClockCounterClockwise, TriangleAlert } from '@finapp/ui/icons/native';
import { router } from 'expo-router';
import { useQueries, type RequestForQueries } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  normalizeNotificationPreferences,
  notificationTypes,
  type NotificationType,
} from '@convex/notifications/domain';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeDashboard, buildHomeDashboard, type HomeRecord } from '@finapp/ui/home';
import { FinanceBrand, resolveDefaultCurrency } from '@finapp/ui/finance';
import { Button, Input, Sheet, Text, Typography, useTheme } from '@finapp/ui/native';
import { layoutTokens } from '@finapp/ui/tokens';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';

export default function HomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    userId,
    isConnected,
    isSyncing,
    status,
    syncError,
    retryNow,
    retryEntry,
    resolveConflict,
    failedEntries,
    conflicts,
    fetchTransactionRange,
  } = useLocalSync();
  const [syncOpen, setSyncOpen] = useState(false);
  const [period, setPeriod] = useState('This month');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [appliedDate, setAppliedDate] = useState<Date | null>(null);
  const [dateError, setDateError] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [now] = useState(() => Date.now());
  const periodOptions = ['Today', 'This week', 'This month', 'Custom date'];
  const range = useMemo(() => {
    const start = period === 'Custom date' && appliedDate ? new Date(appliedDate) : new Date(now);
    if (period === 'Today') start.setHours(0, 0, 0, 0);
    else if (period === 'This week') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      start.setHours(0, 0, 0, 0);
    } else if (period === 'This month' || (period === 'Custom date' && !appliedDate)) {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (period === 'Today' || (period === 'Custom date' && appliedDate))
      end.setDate(end.getDate() + 1);
    else if (period === 'This week') end.setDate(end.getDate() + 7);
    else end.setMonth(end.getMonth() + 1);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }, [appliedDate, now, period]);
  const { data: groups } = useLocalRecords<HomeRecord>(userId, 'group');
  const { data: groupMembers } = useLocalRecords<HomeRecord>(userId, 'groupMember');
  const { data: accounts } = useLocalRecords<HomeRecord>(userId, 'account');
  const { data: categories } = useLocalRecords<HomeRecord>(userId, 'category');
  const { data: profiles } = useLocalRecords<HomeRecord>(userId, 'profile');
  const profile = profiles?.[0];
  const { data: transactions } = useLocalRecords<HomeRecord>(userId, 'transaction');
  const { data: budgets } = useLocalRecords<HomeRecord>(userId, 'budget');
  const { data: recurringRules } = useLocalRecords<HomeRecord>(userId, 'recurringRule');
  const { data: goals } = useLocalRecords<HomeRecord>(userId, 'goal');
  const { data: goalContributions } = useLocalRecords<HomeRecord>(userId, 'goalContribution');
  const { data: notificationRecords } = useLocalRecords<HomeRecord>(userId, 'notification');
  const { data: settings } = useLocalRecords<HomeRecord>(userId, 'settings');
  const transactionRange = useLocalTransactionRange<HomeRecord>(
    userId,
    range.startAt,
    range.endAt,
    fetchTransactionRange,
  );
  const peopleQueries = useMemo<RequestForQueries>(() => {
    const queries: RequestForQueries = {};
    if (isConnected) {
      queries.frequentPeople = { query: api.dashboard.queries.frequentPeople, args: {} };
    }
    return queries;
  }, [isConnected]);
  const peopleQuery = useQueries(peopleQueries).frequentPeople;
  const peopleQueryError = peopleQuery instanceof Error;
  const people = Array.isArray(peopleQuery) ? peopleQuery.filter((person) => person !== null) : [];
  const currency = resolveDefaultCurrency(profiles, settings) ?? 'INR';
  const timeZone = typeof profile?.timezone === 'string' ? profile.timezone : undefined;
  const unreadNotificationCount = useMemo(() => {
    if (!settings) return 0;
    const preferences = normalizeNotificationPreferences(settings[0]?.notificationPreferences);
    return (notificationRecords ?? []).filter((record) => {
      const type = record.type;
      return (
        record.readAt === undefined &&
        typeof type === 'string' &&
        notificationTypes.includes(type as NotificationType) &&
        preferences[type as NotificationType]
      );
    }).length;
  }, [notificationRecords, settings]);
  const allTransactions = useMemo(() => {
    const byId = new Map<string, HomeRecord>();
    for (const transaction of [...(transactions ?? []), ...(transactionRange.data ?? [])]) {
      const id = String(transaction.id ?? transaction._id ?? transaction.cloudId ?? '');
      if (id) byId.set(id, transaction);
    }
    return [...byId.values()];
  }, [transactions, transactionRange.data]);
  const data = useMemo(
    () =>
      buildHomeDashboard({
        now,
        startAt: range.startAt,
        endAt: range.endAt,
        currency,
        timeZone,
        accountId: selectedAccountId,
        search,
        accounts: accounts ?? [],
        transactions: allTransactions,
        categories: categories ?? [],
        groups: groups ?? [],
        groupMembers: groupMembers ?? [],
        budgets: budgets ?? [],
        recurringRules: recurringRules ?? [],
        goals: goals ?? [],
        goalContributions: goalContributions ?? [],
      }),
    [
      selectedAccountId,
      accounts,
      allTransactions,
      budgets,
      categories,
      currency,
      timeZone,
      goalContributions,
      goals,
      groupMembers,
      groups,
      now,
      range.endAt,
      range.startAt,
      recurringRules,
      search,
    ],
  );
  const accountOptions = (accounts ?? [])
    .filter((account) => account.currency === currency && account.archivedAt === undefined)
    .map((account) => ({
      id: String(account.id ?? account._id ?? account.cloudId ?? ''),
      name: typeof account.name === 'string' ? account.name : 'Account',
      currency,
    }))
    .filter((account) => account.id.length > 0);
  const startLabel = new Date(range.startAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const endLabel = new Date(range.endAt - 1).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const dateLabel = `${startLabel} – ${endLabel}`;
  const syncHasIssue = status.failed > 0 || status.conflicts > 0 || Boolean(syncError);
  const syncState = syncHasIssue
    ? 'attention'
    : !isConnected
      ? 'offline'
      : isSyncing
        ? 'syncing'
        : status.pending > 0
          ? 'pending'
          : 'synced';
  const syncTitle =
    syncState === 'attention'
      ? 'Needs attention'
      : syncState === 'offline'
        ? 'Offline'
        : syncState === 'syncing'
          ? 'Syncing now'
          : syncState === 'pending'
            ? 'Changes waiting'
            : 'Up to date';
  const syncDescription =
    syncState === 'attention'
      ? 'Some changes need a retry or conflict decision.'
      : syncState === 'offline'
        ? 'Changes stay on this device and sync after you reconnect.'
        : syncState === 'syncing'
          ? 'Your latest changes are moving to your cloud account.'
          : syncState === 'pending'
            ? 'Changes are saved on this device and waiting to sync.'
            : 'Your changes are synced across your devices.';
  const SyncIcon =
    syncState === 'synced'
      ? Check
      : syncState === 'attention' || syncState === 'offline'
        ? TriangleAlert
        : ClockCounterClockwise;
  const syncColor =
    syncState === 'synced'
      ? tokens.positive
      : syncState === 'offline'
        ? tokens.warning
        : syncState === 'attention'
          ? tokens.destructive
          : tokens.primary;
  const connectionColor = isConnected ? tokens.positive : tokens.warning;
  const lastSynced = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Never';
  const syncMetrics = [
    {
      label: 'Pending',
      value: String(status.pending),
      color: status.pending ? tokens.warning : tokens.foreground,
    },
    {
      label: 'Failed',
      value: String(status.failed),
      color: status.failed ? tokens.destructive : tokens.foreground,
    },
    {
      label: 'Conflicts',
      value: String(status.conflicts),
      color: status.conflicts ? tokens.destructive : tokens.foreground,
    },
    { label: 'Active sync', value: isSyncing ? 'Running' : 'Idle', color: tokens.foreground },
  ];
  const { height: windowHeight } = useWindowDimensions();
  const peopleLoading = isConnected && peopleQuery === undefined;
  if (!userId) return null;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: layoutTokens.sectionGap,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <FinanceBrand />
        <HomeDashboard
          data={data}
          people={people}
          peopleLoading={peopleLoading}
          peopleError={peopleQueryError}
          accounts={accountOptions}
          selectedAccountId={selectedAccountId}
          search={search}
          dateLabel={dateLabel}
          currency={currency}
          onSearchChange={setSearch}
          onAccountChange={setSelectedAccountId}
          onChooseDate={() => setPeriodOpen(true)}
          onOpenSync={() => setSyncOpen(true)}
          syncLabel={syncTitle}
          syncIcon={<SyncIcon size={19} color={syncColor} />}
          notificationCount={unreadNotificationCount}
          onOpenNotifications={() => router.push('/notifications' as never)}
          onOpenTransaction={(id) => router.push(`/transaction/${id}` as never)}
          onSeeAllTransactions={() => router.push('/(tabs)/activity' as never)}
          onOpenBudget={(id) => router.push(`/budget/${id}` as never)}
          onSeeAllBudgets={() => router.push('/budgets' as never)}
          onOpenGoal={(id) => router.push(`/goals/${id}` as never)}
          onSeeAllGoals={() => router.push('/goals' as never)}
          onOpenCategory={(id) => router.push(`/category/${id}` as never)}
          onSeeAllCategories={() => router.push('/categories' as never)}
          onOpenGroup={(id) => router.push(`/group/${id}` as never)}
          onSeeAllGroups={() => router.push('/(tabs)/people' as never)}
          onOpenPerson={(username) => router.push(`/@${encodeURIComponent(username)}` as never)}
          onSeeAllBills={() => router.push('/recurring' as never)}
        />
      </ScrollView>

      <Sheet visible={periodOpen} onClose={() => setPeriodOpen(false)} title="Spending period">
        <View style={{ gap: 8 }}>
          {periodOptions.map((option) => (
            <Button
              key={option}
              variant={period === option ? 'primary' : 'ghost'}
              onPress={() => {
                setPeriod(option);
                if (option !== 'Custom date') setPeriodOpen(false);
              }}
              style={{ justifyContent: 'flex-start', minHeight: 54 }}
            >
              {option}
            </Button>
          ))}
          {period === 'Custom date' && (
            <View style={{ gap: 10, marginTop: 8 }}>
              <Text style={{ color: tokens.foregroundMuted }}>
                Show spending for one date (YYYY-MM-DD).
              </Text>
              <Input
                accessibilityLabel="Custom date"
                placeholder="2026-08-27"
                value={customDate}
                onChangeText={setCustomDate}
              />
              {!!dateError && (
                <Typography style={{ color: tokens.expense }}>{dateError}</Typography>
              )}
              <Button
                size="lg"
                disabled={!customDate.trim()}
                onPress={() => {
                  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(customDate.trim());
                  const selected = match
                    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
                    : null;
                  if (
                    !selected ||
                    selected.getFullYear() !== Number(match?.[1]) ||
                    selected.getMonth() + 1 !== Number(match?.[2]) ||
                    selected.getDate() !== Number(match?.[3])
                  ) {
                    setDateError('Enter a valid date as YYYY-MM-DD.');
                    return;
                  }
                  setAppliedDate(selected);
                  setDateError('');
                  setPeriodOpen(false);
                }}
              >
                Apply date
              </Button>
            </View>
          )}
        </View>
      </Sheet>
      <Sheet visible={syncOpen} onClose={() => setSyncOpen(false)} title="Local sync">
        <View style={{ gap: 12 }}>
          <ScrollView
            style={{ maxHeight: windowHeight * 0.54 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 2 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                borderRadius: 16,
                padding: 14,
                backgroundColor: tokens.surfaceRaised,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  flex: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.borderSubtle,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <SyncIcon size={20} color={syncColor} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Typography
                  variant="caption"
                  style={{
                    color: syncColor,
                    fontSize: 10,
                    letterSpacing: 1.1,
                    fontWeight: '600',
                  }}
                >
                  SYNC STATUS
                </Typography>
                <Typography variant="heading" style={{ fontSize: 18, lineHeight: 23 }}>
                  {syncTitle}
                </Typography>
                <Text style={{ color: tokens.foregroundMuted, lineHeight: 20 }}>
                  {syncDescription}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {syncMetrics.map((metric) => (
                <View
                  key={metric.label}
                  style={{
                    flexBasis: '48%',
                    flexGrow: 1,
                    minHeight: 66,
                    justifyContent: 'center',
                    gap: 4,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                >
                  <Typography variant="caption">{metric.label}</Typography>
                  <Text
                    style={{
                      color: metric.color,
                      fontSize: 17,
                      lineHeight: 21,
                      fontFamily: 'SpaceGrotesk_600SemiBold',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {metric.value}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={{
                gap: 9,
                borderTopWidth: 1,
                borderColor: tokens.borderSubtle,
                paddingTop: 10,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: tokens.foregroundMuted }}>Connection</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: connectionColor,
                    }}
                  />
                  <Text style={{ color: connectionColor }}>
                    {isConnected ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Text style={{ color: tokens.foregroundMuted, flexShrink: 0 }}>
                  Last successful sync
                </Text>
                <Text style={{ flexShrink: 1, textAlign: 'right' }}>{lastSynced}</Text>
              </View>
            </View>

            {failedEntries.length > 0 && (
              <View style={{ gap: 8 }}>
                <Typography variant="small" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                  Failed changes
                </Typography>
                {failedEntries.map((entry) => (
                  <View
                    key={entry.localId}
                    style={{
                      gap: 6,
                      borderTopWidth: 1,
                      borderColor: tokens.borderSubtle,
                      paddingTop: 10,
                    }}
                  >
                    <Typography variant="small">{entry.operation}</Typography>
                    <Text style={{ color: tokens.destructive }}>
                      {entry.lastError ?? 'Cloud rejected this change.'}
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSyncing}
                      onPress={() => void retryEntry(entry.localId)}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      Retry this change
                    </Button>
                  </View>
                ))}
              </View>
            )}

            {conflicts.length > 0 && (
              <View style={{ gap: 8 }}>
                <Typography variant="small" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                  Conflicts
                </Typography>
                {conflicts.map((conflict) => {
                  const localValue = String(
                    conflict.localRecord.title ??
                      conflict.localRecord.name ??
                      conflict.localRecord.amountMinor ??
                      'Local version',
                  );
                  const cloudValue = String(
                    conflict.cloudRecord.title ??
                      conflict.cloudRecord.name ??
                      conflict.cloudRecord.amountMinor ??
                      'Cloud version',
                  );
                  return (
                    <View
                      key={conflict.id}
                      style={{
                        gap: 6,
                        borderTopWidth: 1,
                        borderColor: tokens.borderSubtle,
                        paddingTop: 10,
                      }}
                    >
                      <Typography variant="small">
                        {conflict.entityType} · {conflict.recordId}
                      </Typography>
                      <Text style={{ color: tokens.foregroundMuted }}>
                        On this device: {localValue}
                      </Text>
                      <Text style={{ color: tokens.foregroundMuted }}>In cloud: {cloudValue}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSyncing}
                          onPress={() => void resolveConflict(conflict.id, 'local')}
                        >
                          Keep this device
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSyncing}
                          onPress={() => void resolveConflict(conflict.id, 'cloud')}
                        >
                          Use cloud
                        </Button>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {!!syncError && (
              <View
                accessibilityRole="alert"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: `${tokens.destructive}55`,
                  borderRadius: 12,
                  padding: 11,
                  backgroundColor: `${tokens.destructive}12`,
                }}
              >
                <TriangleAlert size={16} color={tokens.destructive} />
                <Text style={{ flex: 1, color: tokens.destructive }}>{syncError}</Text>
              </View>
            )}
          </ScrollView>

          <View style={{ gap: 8 }}>
            <Button size="lg" disabled={isSyncing} onPress={() => void retryNow()}>
              <ClockCounterClockwise size={17} color={tokens.primaryForeground} />
              <Text style={{ color: tokens.primaryForeground }}>
                {status.failed > 0 ? 'Retry now' : 'Sync now'}
              </Text>
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                setSyncOpen(false);
                router.push('/settings/sync' as never);
              }}
            >
              <Text style={{ color: tokens.foreground }}>Local sync settings</Text>
            </Button>
          </View>
        </View>
      </Sheet>
    </>
  );
}
