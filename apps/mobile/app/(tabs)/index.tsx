import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  CalendarDays,
  ClockCounterClockwise,
  ReceiptText,
  ShieldCheck,
  TriangleAlert,
  UsersThree,
} from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpendingLineChart } from '@/components/charts/BarChart';
import {
  BalanceHero,
  CategoryIcon,
  MetricPair,
  PeopleRail,
  SettingsRow,
  TransactionRow,
} from '@/components/finance';
import {
  Button,
  IconButton,
  Input,
  SectionHeader,
  Separator,
  Sheet,
  Text,
  Typography,
} from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { layoutTokens } from '@finapp/ui/tokens';
import { formatMinor } from '@/lib/money';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type HomeAccount = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  currency?: string;
  balanceMinor?: bigint;
  openingBalanceMinor?: bigint;
};
type HomeCategory = LocalRecord & { id?: string; _id?: string; name: string; icon?: string };
type HomeGroup = LocalRecord & { id?: string; _id?: string; name: string; currency: string };
type HomeTransaction = LocalRecord & {
  id?: string;
  _id?: string;
  accountId: string;
  transferAccountId?: string;
  categoryId?: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
  status: 'pending' | 'posted' | 'voided';
  occurredAt: number;
  deletedAt?: number;
  groupId?: string;
  clientUpdatedAt?: number;
};

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
  const periodOptions = ['Today', 'This week', 'This month', 'Custom date'];
  const range = useMemo(() => {
    const today = new Date();
    const start = period === 'Custom date' && appliedDate ? new Date(appliedDate) : new Date(today);
    if (period === 'This week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (period === 'This month' || (period === 'Custom date' && !appliedDate)) start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (period === 'This week') end.setDate(end.getDate() + 7);
    else if (period === 'This month' || (period === 'Custom date' && !appliedDate))
      end.setMonth(end.getMonth() + 1);
    else end.setDate(end.getDate() + 1);
    return { startAt: start.getTime(), endAt: end.getTime() };
  }, [period, appliedDate]);
  const { data: groups } = useLocalRecords<HomeGroup>(userId, 'group');
  const { data: accounts } = useLocalRecords<HomeAccount>(userId, 'account');
  const { data: categories } = useLocalRecords<HomeCategory>(userId, 'category');
  const { data: profiles } = useLocalRecords<LocalRecord>(userId, 'profile');
  const { data: transactions } = useLocalRecords<HomeTransaction>(userId, 'transaction');
  const transactionRange = useLocalTransactionRange<HomeTransaction>(
    userId,
    range.startAt,
    range.endAt,
    fetchTransactionRange,
  );
  const profile = profiles?.[0];
  const currency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
  const summary = useMemo(() => {
    if (!transactionRange.data) return undefined;
    const chart = Array<number>(8).fill(0);
    let incomeMinor = 0n;
    let spentMinor = 0n;
    for (const transaction of transactionRange.data) {
      if (
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== currency ||
        transaction.occurredAt < range.startAt ||
        transaction.occurredAt >= range.endAt
      )
        continue;
      if (transaction.type === 'income') incomeMinor += transaction.amountMinor;
      if (transaction.type === 'expense') {
        spentMinor += transaction.amountMinor;
        const bucket = Math.min(
          7,
          Math.floor(
            ((transaction.occurredAt - range.startAt) / (range.endAt - range.startAt)) * 8,
          ),
        );
        chart[bucket] = (chart[bucket] ?? 0) + Number(transaction.amountMinor) / 100;
      }
    }
    return { chart, incomeMinor, spentMinor };
  }, [currency, range, transactionRange.data]);
  const recentTransactions = useMemo(
    () =>
      [...(transactions ?? [])]
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .slice(0, 4),
    [transactions],
  );
  const currencyAccounts = accounts?.filter((account) => account.currency === currency) ?? [];
  const accountIds = new Set(
    currencyAccounts.flatMap((account) =>
      [account.id, account._id, account.cloudId].filter(
        (value): value is string => typeof value === 'string',
      ),
    ),
  );
  const balanceMinor =
    currencyAccounts.reduce(
      (total, account) => total + (account.balanceMinor ?? account.openingBalanceMinor ?? 0n),
      0n,
    ) +
    (transactions ?? []).reduce((delta, transaction) => {
      if (
        typeof transaction.clientUpdatedAt !== 'number' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== currency
      )
        return delta;
      const sourceDelta = accountIds.has(transaction.accountId)
        ? transaction.type === 'expense' || transaction.type === 'transfer'
          ? -transaction.amountMinor
          : transaction.amountMinor
        : 0n;
      const destinationDelta =
        transaction.type === 'transfer' &&
        transaction.transferAccountId &&
        accountIds.has(transaction.transferAccountId)
          ? transaction.amountMinor
          : 0n;
      return delta + sourceDelta + destinationDelta;
    }, 0n);
  const syncHasIssue = status.failed > 0 || status.conflicts > 0;
  const SyncIcon = syncHasIssue
    ? TriangleAlert
    : !isConnected
      ? ClockCounterClockwise
      : isSyncing || status.pending > 0
        ? ClockCounterClockwise
        : ShieldCheck;
  const syncIconColor = syncHasIssue
    ? tokens.destructive
    : isConnected
      ? tokens.primary
      : tokens.foregroundMuted;
  const syncAccessibilityLabel = `Local sync, ${isConnected ? 'online' : 'offline'}, ${status.pending} pending, ${status.failed} failed, ${status.conflicts} conflicts`;
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: layoutTokens.sectionGap,
          gap: 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="label">Overview</Typography>
          <IconButton
            label={syncAccessibilityLabel}
            variant="ghost"
            onPress={() => setSyncOpen(true)}
          >
            <SyncIcon size={20} color={syncIconColor} />
          </IconButton>
        </View>
        <BalanceHero amountMinor={balanceMinor} currency={currency} />
        <MetricPair
          left={{ label: 'Income', value: formatMinor(summary?.incomeMinor ?? 0n, currency) }}
          right={{ label: 'Spent', value: formatMinor(summary?.spentMinor ?? 0n, currency) }}
        />

        <View style={{ gap: 18 }}>
          <SectionHeader
            title="Spending"
            action={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Button variant="ghost" size="sm" onPress={() => setPeriodOpen(true)}>
                  {period}
                </Button>
                <IconButton label="Choose date" variant="ghost" onPress={() => setPeriodOpen(true)}>
                  <CalendarDays size={19} color={tokens.foreground} />
                </IconButton>
              </View>
            }
          />
          {summary ? (
            <SpendingLineChart
              values={summary.chart}
              labels={[
                new Date(range.startAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                }),
                new Date(range.endAt - 1).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                }),
              ]}
            />
          ) : (
            <Typography variant="small">Loading spending…</Typography>
          )}
        </View>

        <View style={{ gap: 16 }}>
          <SectionHeader
            title="Categories"
            action={
              <Button variant="ghost" size="sm" onPress={() => router.push('/category' as never)}>
                See all
              </Button>
            }
          />
          {categories === undefined ? (
            <Typography variant="small">Loading categories…</Typography>
          ) : categories.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
              <CategoryIcon label="Categories" />
              <Typography variant="bodyLarge">No categories yet</Typography>
              <Typography variant="small" style={{ textAlign: 'center', maxWidth: 290 }}>
                Create a category to organize transactions.
              </Typography>
              <Button
                size="sm"
                variant="outline"
                onPress={() => router.push('/category/new' as never)}
              >
                Add category
              </Button>
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              {categories.slice(0, 4).map((category) => (
                <Button
                  key={String(category.id ?? category._id)}
                  variant="ghost"
                  onPress={() =>
                    router.push(`/category/${String(category.id ?? category._id)}` as never)
                  }
                  accessibilityLabel={`Open ${category.name} category`}
                  style={{
                    width: '100%',
                    minHeight: 64,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    backgroundColor: tokens.surfaceSubtle,
                    justifyContent: 'flex-start',
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <CategoryIcon label={category.name} icon={category.icon} />
                    <Typography
                      variant="bodyLarge"
                      numberOfLines={2}
                      style={{ color: tokens.foreground, flex: 1 }}
                    >
                      {category.name}
                    </Typography>
                  </View>
                </Button>
              ))}
            </View>
          )}
        </View>

        <Separator />
        <PeopleRail onSelect={() => router.push('/group/new' as never)} />

        <View style={{ gap: 14 }}>
          <SectionHeader
            title="Groups"
            action={
              <Button variant="ghost" size="sm" onPress={() => router.push('/(tabs)/groups')}>
                See all
              </Button>
            }
          />
          {groups === undefined ? (
            <Typography variant="small">Loading groups…</Typography>
          ) : groups.length > 0 ? (
            groups.slice(0, 2).map((group) => {
              const groupId = String(group.id ?? group._id);
              return (
                <SettingsRow
                  key={groupId}
                  label={group.name}
                  value={group.currency}
                  onPress={() => router.push(`/group/${groupId}` as never)}
                />
              );
            })
          ) : (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 16,
                gap: 8,
              }}
            >
              <UsersThree size={22} color={tokens.foregroundMuted} />
              <Text style={{ color: tokens.foregroundMuted, textAlign: 'center' }}>
                Create a group to split money with people you know.
              </Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() => router.push('/group/new' as never)}
              >
                Create group
              </Button>
            </View>
          )}
        </View>

        <Separator />
        <View style={{ gap: 12 }}>
          <SectionHeader
            title="Recent"
            action={
              <Button variant="ghost" size="sm" onPress={() => router.push('/(tabs)/activity')}>
                All
              </Button>
            }
          />
          {transactions === undefined ? (
            <Typography variant="small">Loading activity…</Typography>
          ) : recentTransactions.length ? (
            recentTransactions.map((transaction) => {
              const transactionId = String(transaction.id ?? transaction._id);
              const category = categories?.find(
                (item) => String(item.id ?? item._id) === transaction.categoryId,
              );
              return (
                <TransactionRow
                  key={transactionId}
                  title={transaction.title}
                  category={category?.name}
                  categoryIcon={typeof category?.icon === 'string' ? category.icon : undefined}
                  amountMinor={transaction.amountMinor}
                  currency={transaction.currency}
                  type={transaction.type}
                  semanticType={transaction.groupId ? 'split' : undefined}
                  date={new Date(transaction.occurredAt).toLocaleDateString()}
                  onPress={() => router.push(`/transaction/${transactionId}` as never)}
                />
              );
            })
          ) : (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 18,
                gap: 8,
              }}
            >
              <ReceiptText size={22} color={tokens.foregroundMuted} />
              <Typography variant="bodyLarge">No transactions yet</Typography>
              <Typography variant="small" style={{ textAlign: 'center', maxWidth: 290 }}>
                Record an expense or income to start your ledger.
              </Typography>
              <Button
                size="sm"
                variant="outline"
                onPress={() => router.push('/transaction/new' as never)}
              >
                Add transaction
              </Button>
            </View>
          )}
        </View>
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
