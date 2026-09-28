import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQueries, type RequestForQueries } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeDashboard, buildHomeDashboard, type HomeRecord } from '@finapp/ui/home';
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
  const { data: transactions } = useLocalRecords<HomeRecord>(userId, 'transaction');
  const { data: budgets } = useLocalRecords<HomeRecord>(userId, 'budget');
  const { data: recurringRules } = useLocalRecords<HomeRecord>(userId, 'recurringRule');
  const { data: goals } = useLocalRecords<HomeRecord>(userId, 'goal');
  const { data: goalContributions } = useLocalRecords<HomeRecord>(userId, 'goalContribution');
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
  const profile = profiles?.[0];
  const currency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
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
  const syncHasIssue = status.failed > 0 || status.conflicts > 0;
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
          onAddTransaction={() => router.push('/transaction/new' as never)}
          onOpenTransaction={(id) => router.push(`/transaction/${id}` as never)}
          onSeeAllTransactions={() => router.push('/(tabs)/activity' as never)}
          onOpenBudget={(id) => router.push(`/budget/${id}` as never)}
          onSeeAllBudgets={() => router.push('/budget' as never)}
          onOpenGoal={(id) => router.push(`/goals/${id}` as never)}
          onSeeAllGoals={() => router.push('/goals' as never)}
          onOpenCategory={(id) => router.push(`/category/${id}` as never)}
          onSeeAllCategories={() => router.push('/category' as never)}
          onOpenGroup={(id) => router.push(`/group/${id}` as never)}
          onSeeAllGroups={() => router.push('/(tabs)/groups' as never)}
          onOpenPerson={(username) => router.push(`/person/${username}` as never)}
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
        <View style={{ gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Typography variant="heading">
              {!isConnected
                ? 'Offline'
                : isSyncing
                  ? 'Syncing changes'
                  : syncHasIssue
                    ? 'Action needed'
                    : status.pending > 0
                      ? 'Changes pending'
                      : 'Up to date'}
            </Typography>
            <Text style={{ color: tokens.foregroundMuted }}>
              {!isConnected
                ? 'Your cached records stay available. New edits are queued on this device.'
                : 'Local changes sync to your cloud account when connected.'}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <Text>Connection: {isConnected ? 'Online' : 'Offline'}</Text>
            <Text>Pending: {status.pending}</Text>
            <Text>Active sync: {isSyncing ? 'Yes' : 'No'}</Text>
            <Text>Failed: {status.failed}</Text>
            <Text>Conflicts: {status.conflicts}</Text>
            <Text>
              Last successful cloud sync:{' '}
              {status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never'}
            </Text>
          </View>
          {failedEntries.length > 0 && (
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 10 }}>
              {failedEntries.map((entry) => (
                <View key={entry.localId} style={{ gap: 5 }}>
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
            </ScrollView>
          )}
          {conflicts.length > 0 && (
            <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 12 }}>
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
                  <View key={conflict.id} style={{ gap: 6 }}>
                    <Typography variant="small">
                      {conflict.entityType} · {conflict.recordId}
                    </Typography>
                    <Text style={{ color: tokens.foregroundMuted }}>Local: {localValue}</Text>
                    <Text style={{ color: tokens.foregroundMuted }}>Cloud: {cloudValue}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSyncing}
                        onPress={() => void resolveConflict(conflict.id, 'local')}
                      >
                        Keep local
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
            </ScrollView>
          )}
          {!!syncError && (
            <Typography style={{ color: tokens.destructive }}>{syncError}</Typography>
          )}
          <Button size="lg" disabled={isSyncing} onPress={() => void retryNow()}>
            Retry now
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              setSyncOpen(false);
              router.push('/settings/sync' as never);
            }}
          >
            Local sync settings
          </Button>
        </View>
      </Sheet>
    </>
  );
}
