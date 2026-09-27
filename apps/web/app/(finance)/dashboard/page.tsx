'use client';

import { useConvexAuth } from 'convex/react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { History, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Separator, useTheme } from '@finapp/ui/web';
import {
  BalanceHero,
  MetricPair,
  PeopleRail,
  type TransactionType,
} from '@finapp/ui/finance';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { CategorySection } from '@/components/finance/dashboard/CategorySection';
import { DashboardHeader } from '@/components/finance/dashboard/DashboardHeader';
import { GroupsSection } from '@/components/finance/dashboard/GroupsSection';
import { LocalSyncSheet } from '@/components/finance/dashboard/LocalSyncSheet';
import { RecentSection } from '@/components/finance/dashboard/RecentSection';
import { SpendingPeriodSheet } from '@/components/finance/dashboard/SpendingPeriodSheet';
import { SpendingSection } from '@/components/finance/dashboard/SpendingSection';

type Account = LocalRecord & {
  name?: string;
  currency?: string;
  balanceMinor?: bigint | number | string;
  openingBalanceMinor?: bigint | number | string;
};
type Transaction = LocalRecord & {
  title?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  categoryId?: string;
  groupId?: string;
  accountId?: string;
  transferAccountId?: string;
  status?: string;
  deletedAt?: number;
  clientUpdatedAt?: number;
};
type Category = LocalRecord & { name?: string; icon?: string };
type Group = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Profile = LocalRecord & {
  defaultCurrency?: string;
  phone?: string;
  phoneVerificationTime?: number;
};

function asMinor(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function recordId(record: LocalRecord): string {
  return String(record.id ?? record._id ?? '');
}


export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { tokens } = useTheme();
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
  const { records: accounts, loading: accountsLoading } = useLocalRecords<Account>('account');
  const { records: transactions, loading: transactionsLoading } =
    useLocalRecords<Transaction>('transaction');
  const { records: categories, loading: categoriesLoading } = useLocalRecords<Category>('category');
  const { records: groups, loading: groupsLoading } = useLocalRecords<Group>('group');
  const { records: profiles, loading: profilesLoading } = useLocalRecords<Profile>('profile');
  const [now, setNow] = React.useState<number | null>(null);
  const [period, setPeriod] = React.useState('This month');
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [customDate, setCustomDate] = React.useState('');
  const [appliedDate, setAppliedDate] = React.useState<Date | null>(null);
  const [dateError, setDateError] = React.useState('');
  const [syncOpen, setSyncOpen] = React.useState(false);

  React.useEffect(() => setNow(Date.now()), []);
  React.useEffect(() => {
    if (identityReady && !userId && !authLoading && !isAuthenticated) {
      router.replace('/welcome');
    }
  }, [authLoading, identityReady, isAuthenticated, router, userId]);

  const currency = profiles[0]?.defaultCurrency ?? 'INR';
  const profile = profiles[0];
  const phoneVerified = Boolean(profile?.phone && profile.phoneVerificationTime !== undefined);
  const currencyAccounts = accounts.filter((account) => account.currency === currency);
  const accountIds = new Set(
    currencyAccounts.flatMap((account) =>
      [account.id, account._id, account.cloudId].filter(
        (value): value is string => typeof value === 'string',
      ),
    ),
  );
  const totalBalance =
    currencyAccounts.reduce(
      (total, account) => total + asMinor(account.balanceMinor ?? account.openingBalanceMinor),
      0n,
    ) +
    transactions.reduce((delta, transaction) => {
      if (
        typeof transaction.clientUpdatedAt !== 'number' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== currency
      ) {
        return delta;
      }
      const amount = asMinor(transaction.amountMinor);
      const sourceDelta = accountIds.has(transaction.accountId ?? '')
        ? transaction.type === 'expense' || transaction.type === 'transfer'
          ? -amount
          : amount
        : 0n;
      const destinationDelta =
        transaction.type === 'transfer' &&
        transaction.transferAccountId &&
        accountIds.has(transaction.transferAccountId)
          ? amount
          : 0n;
      return delta + sourceDelta + destinationDelta;
    }, 0n);
  const range = React.useMemo(() => {
    if (now === null) return { startAt: 0, endAt: 0 };
    const start =
      period === 'Custom date' && appliedDate ? new Date(appliedDate) : new Date(now);
    if (period === 'Today') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'This week') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      start.setHours(0, 0, 0, 0);
    } else if (period === 'Custom date' && appliedDate) {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    const end = new Date(start);
    if (period === 'Today' || (period === 'Custom date' && appliedDate)) {
      end.setDate(end.getDate() + 1);
    } else if (period === 'This week') {
      end.setDate(end.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return { startAt: start.getTime(), endAt: end.getTime() };
  }, [appliedDate, now, period]);
  const summary = React.useMemo(() => {
    if (now === null) return undefined;
    const chart = Array<number>(8).fill(0);
    let incomeMinor = 0n;
    let spentMinor = 0n;
    for (const transaction of transactions) {
      if (
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== currency ||
        typeof transaction.occurredAt !== 'number' ||
        transaction.occurredAt < range.startAt ||
        transaction.occurredAt >= range.endAt
      ) {
        continue;
      }
      const amount = asMinor(transaction.amountMinor);
      if (transaction.type === 'income') incomeMinor += amount;
      if (transaction.type === 'expense') {
        spentMinor += amount;
        const bucket = Math.min(
          7,
          Math.floor(
            ((transaction.occurredAt - range.startAt) / (range.endAt - range.startAt)) * 8,
          ),
        );
        chart[bucket] = (chart[bucket] ?? 0) + Number(amount) / 100;
      }
    }
    return { chart, incomeMinor, spentMinor };
  }, [currency, now, range.endAt, range.startAt, transactions]);
  const recent = [...transactions]
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 4);
  const hasSyncIssue = status.failed > 0 || status.conflicts > 0;
  const SyncIcon = hasSyncIssue
    ? TriangleAlert
    : !isConnected || isSyncing || status.pending > 0
      ? History
      : ShieldCheck;
  const syncIconColor = hasSyncIssue
    ? tokens.destructive
    : isConnected
      ? tokens.primary
      : tokens.foregroundMuted;
  const syncAccessibilityLabel = `Local sync, ${isConnected ? 'online' : 'offline'}, ${status.pending} pending, ${status.failed} failed, ${status.conflicts} conflicts`;

  if (!userId) return null;

  const openGroupCreation = () => router.push('/group/new');
  const categoryItems = categories.map((category) => ({
    id: recordId(category),
    name: category.name ?? 'Category',
    icon: category.icon,
  }));
  const groupItems = groups.map((group) => ({
    id: recordId(group),
    name: group.name ?? 'Shared group',
    currency: group.currency ?? currency,
  }));
  const recentItems = recent.map((transaction) => {
    const id = recordId(transaction);
    const category = categories.find((item) => recordId(item) === transaction.categoryId);
    return {
      id,
      title: transaction.title ?? 'Transaction',
      category: category?.name,
      categoryIcon: typeof category?.icon === 'string' ? category.icon : undefined,
      amountMinor: asMinor(transaction.amountMinor),
      currency: transaction.currency ?? currency,
      type: (transaction.type ?? 'expense') as TransactionType,
      semanticType: transaction.groupId ? ('split' as const) : undefined,
      date:
        typeof transaction.occurredAt === 'number'
          ? new Date(transaction.occurredAt).toLocaleDateString()
          : 'Saved offline',
    };
  });

  return (
    <div className="finance-home-page" style={{ display: 'grid', gap: 36 }}>
      <DashboardHeader
        syncLabel={syncAccessibilityLabel}
        syncIcon={<SyncIcon size={20} color={syncIconColor} />}
        onOpenSync={() => setSyncOpen(true)}
      />
      <BalanceHero amountMinor={accountsLoading ? 0n : totalBalance} currency={currency} />
      <MetricPair
        left={{ label: 'Income', value: formatMinor(summary?.incomeMinor ?? 0n, currency) }}
        right={{ label: 'Spent', value: formatMinor(summary?.spentMinor ?? 0n, currency) }}
      />
      <SpendingSection
        period={period}
        values={summary?.chart}
        startAt={range.startAt}
        endAt={range.endAt}
        loading={now === null}
        onChoosePeriod={() => setPeriodOpen(true)}
      />
      <CategorySection
        categories={categoryItems}
        loading={categoriesLoading}
        onSeeAll={() => router.push('/category')}
        onOpen={(id) => router.push(`/category/${encodeURIComponent(id)}`)}
        onCreate={() => router.push('/category/new')}
      />
      <Separator />
      <PeopleRail
        phoneVerified={phoneVerified}
        checking={profilesLoading}
        onChoose={openGroupCreation}
      />
      <GroupsSection
        groups={groupItems}
        loading={groupsLoading}
        currency={currency}
        onSeeAll={() => router.push('/groups')}
        onOpen={(id) => router.push(`/group/${encodeURIComponent(id)}`)}
        onCreate={openGroupCreation}
      />
      <Separator />
      <RecentSection
        transactions={recentItems}
        loading={transactionsLoading}
        onSeeAll={() => router.push('/activity')}
        onOpen={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
        onCreate={() => router.push('/transaction/new')}
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
