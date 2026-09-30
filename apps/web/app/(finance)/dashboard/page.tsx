'use client';

import { useConvexAuth, useQueries, type RequestForQueries } from 'convex/react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@convex/_generated/api';
import { HomeDashboard, buildHomeDashboard, type HomeRecord } from '@finapp/ui/home';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { LocalSyncSheet } from '@/components/finance/dashboard/LocalSyncSheet';
import { SpendingPeriodSheet } from '@/components/finance/dashboard/SpendingPeriodSheet';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const {
    identityReady,
    userId,
    isConnected,
    isSyncing,
    syncError,
    status,
    failedEntries,
    conflicts,
    retryNow,
    retryEntry,
    resolveConflict,
  } = useBrowserSync();
  const { records: accounts } = useLocalRecords<HomeRecord>('account');
  const { records: transactions } = useLocalRecords<HomeRecord>('transaction');
  const { records: categories } = useLocalRecords<HomeRecord>('category');
  const { records: groups } = useLocalRecords<HomeRecord>('group');
  const { records: groupMembers } = useLocalRecords<HomeRecord>('groupMember');
  const { records: profiles } = useLocalRecords<HomeRecord>('profile');
  const { records: budgets } = useLocalRecords<HomeRecord>('budget');
  const { records: recurringRules } = useLocalRecords<HomeRecord>('recurringRule');
  const { records: goals } = useLocalRecords<HomeRecord>('goal');
  const { records: goalContributions } = useLocalRecords<HomeRecord>('goalContribution');
  const [now] = React.useState(() => Date.now());
  const [period, setPeriod] = React.useState('This month');
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [customDate, setCustomDate] = React.useState('');
  const [appliedDate, setAppliedDate] = React.useState<Date | null>(null);
  const [dateError, setDateError] = React.useState('');
  const [syncOpen, setSyncOpen] = React.useState(false);
  const [selectedAccountId, setSelectedAccountId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const range = React.useMemo(() => {
    const start = period === 'Custom date' && appliedDate ? new Date(appliedDate) : new Date(now);
    if (period === 'Today') start.setHours(0, 0, 0, 0);
    else if (period === 'This week') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      start.setHours(0, 0, 0, 0);
    } else if (period === 'Custom date' && appliedDate) start.setHours(0, 0, 0, 0);
    else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    const end = new Date(start);
    if (period === 'Today' || (period === 'Custom date' && appliedDate))
      end.setDate(end.getDate() + 1);
    else if (period === 'This week') end.setDate(end.getDate() + 7);
    else end.setMonth(end.getMonth() + 1);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }, [appliedDate, now, period]);
  React.useEffect(() => {
    if (identityReady && !userId && !authLoading && !isAuthenticated) router.replace('/welcome');
  }, [authLoading, identityReady, isAuthenticated, router, userId]);
  const currency =
    typeof profiles[0]?.defaultCurrency === 'string' ? profiles[0].defaultCurrency : 'INR';
  const timeZone = typeof profiles[0]?.timezone === 'string' ? profiles[0].timezone : undefined;
  const peopleQueries = React.useMemo<RequestForQueries>(() => {
    const queries: RequestForQueries = {};
    if (isConnected) {
      queries.frequentPeople = { query: api.dashboard.queries.frequentPeople, args: {} };
    }
    return queries;
  }, [isConnected]);
  const peopleQuery = useQueries(peopleQueries).frequentPeople;
  const peopleQueryError = peopleQuery instanceof Error;
  const people = Array.isArray(peopleQuery) ? peopleQuery.filter((person) => person !== null) : [];
  const data = React.useMemo(
    () =>
      buildHomeDashboard({
        now,
        startAt: range.startAt,
        endAt: range.endAt,
        currency,
        timeZone,
        accountId: selectedAccountId,
        search,
        accounts,
        transactions,
        categories,
        groups,
        groupMembers,
        budgets,
        recurringRules,
        goals,
        goalContributions,
      }),
    [
      accounts,
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
      selectedAccountId,
      transactions,
    ],
  );
  const accountOptions = accounts
    .filter((account) => account.currency === currency && account.archivedAt === undefined)
    .map((account) => ({
      id: String(account.id ?? account._id ?? account.cloudId ?? ''),
      name: typeof account.name === 'string' ? account.name : 'Account',
      currency: typeof account.currency === 'string' ? account.currency : currency,
    }))
    .filter((account) => account.id.length > 0);
  const dateLabel = `${new Date(range.startAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(range.endAt - 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  const peopleLoading = isConnected && peopleQuery === undefined;
  if (!userId) return null;

  return (
    <div className="finance-home-page">
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
        onOpenNotifications={() => router.push('/notifications')}
        onOpenTransaction={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
        onSeeAllTransactions={() => router.push('/activity')}
        onOpenBudget={(id) => router.push(`/budget/${encodeURIComponent(id)}`)}
        onSeeAllBudgets={() => router.push('/budget')}
        onOpenGoal={(id) => router.push(`/goals/${encodeURIComponent(id)}`)}
        onSeeAllGoals={() => router.push('/goals')}
        onOpenCategory={(id) => router.push(`/category/${encodeURIComponent(id)}`)}
        onSeeAllCategories={() => router.push('/categories')}
        onOpenGroup={(id) => router.push(`/group/${encodeURIComponent(id)}`)}
        onSeeAllGroups={() => router.push('/groups')}
        onOpenPerson={(username) => router.push(`/person/${encodeURIComponent(username)}`)}
        onSeeAllBills={() => router.push('/recurring')}
      />
      <SpendingPeriodSheet
        visible={periodOpen}
        period={period}
        customDate={customDate}
        dateError={dateError}
        onClose={() => setPeriodOpen(false)}
        onSelectPeriod={(option) => {
          setPeriod(option);
          if (option !== 'Custom date') setPeriodOpen(false);
        }}
        onDateChange={setCustomDate}
        onApplyDate={() => {
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
      />
      <LocalSyncSheet
        visible={syncOpen}
        isSignedIn={Boolean(userId)}
        isConnected={isConnected}
        isSyncing={isSyncing}
        status={status}
        failedEntries={failedEntries}
        conflicts={conflicts}
        syncError={syncError}
        onClose={() => setSyncOpen(false)}
        onRetry={() => void retryNow()}
        onRetryEntry={(localId) => void retryEntry(localId)}
        onResolveConflict={(conflictId, winner) => void resolveConflict(conflictId, winner)}
        onOpenSettings={() => {
          setSyncOpen(false);
          router.push('/settings/sync');
        }}
      />
    </div>
  );
}
