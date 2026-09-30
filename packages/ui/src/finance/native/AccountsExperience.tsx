import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import {
  ArrowLeft,
  ArrowUpRight,
  Coins,
  Landmark,
  CalendarDays,
  CaretRight,
  Check,
  CurrencyDollar,
  ReceiptText,
  EyeOff,
  Plus,
  MagnifyingGlass,
  Wallet,
} from '@finapp/ui/icons/native';
import { Button, Input, Label, Sheet, Text, Typography, useTheme } from '@finapp/ui/native';
import { EntityIcon, EntityIconPicker } from './EntityIconPicker';
import { Money } from './Money';
import { TransactionRow } from './TransactionRow';
import type { SemanticType, TransactionType } from '../types';

export type AccountListEntry = {
  id: string;
  name: string;
  type: string;
  customType?: string;
  currency: string;
  balanceMinor: bigint;
  icon?: string;
  color?: string;
  isIncludedInTotal: boolean;
};

export type AccountCurrencyTotal = { currency: string; amountMinor: bigint };

export type AccountActivityEntry = {
  id: string;
  title: string;
  category?: string;
  categoryIcon?: string;
  date: string;
  status?: string;
  amountMinor: bigint;
  currency: string;
  type: TransactionType;
  semanticType?: SemanticType;
  occurredAt: number;
  cashFlowMinor: bigint;
};

export type AccountsIndexViewProps = {
  accounts: AccountListEntry[];
  totals: AccountCurrencyTotal[];
  loading: boolean;
  error?: string | null;
  topInset?: number;
  bottomInset?: number;
  onRetry: () => void;
  onAddAccount: () => void;
  onOpenAccount: (id: string) => void;
};

const filterOptions = [
  { id: 'all', title: 'All' },
  { id: 'bank', title: 'Bank' },
  { id: 'card', title: 'Card' },
  { id: 'wallet', title: 'Wallet' },
  { id: 'cash', title: 'Cash' },
  { id: 'custom', title: 'Custom' },
] as const;
type AccountFilter = (typeof filterOptions)[number]['id'];
const accountColors = [
  { name: 'Lime', value: '#B7FF4A' },
  { name: 'Sky', value: '#71B8FF' },
  { name: 'Coral', value: '#FF7777' },
  { name: 'Violet', value: '#BA8AFF' },
  { name: 'Amber', value: '#FFD44F' },
  { name: 'Orange', value: '#FF9C5B' },
  { name: 'Mint', value: '#54D6A1' },
  { name: 'Rose', value: '#FF80B6' },
] as const;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  pageContent: { paddingHorizontal: 18, gap: 18 },
  headerStack: { gap: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingBlock: { flex: 1, gap: 3 },
  search: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, minWidth: 0, padding: 0, fontSize: 15 },
  summaryStack: { gap: 9 },
  summaryPair: { flexDirection: 'row', gap: 9 },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
  },
  summaryCardCompact: { minHeight: 94, gap: 9, padding: 11 },
  summaryIcon: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  summaryIconCompact: { width: 39, height: 39 },
  summaryCopy: { flex: 1, minWidth: 0, gap: 3 },
  listPanel: { gap: 10, borderWidth: 1, borderRadius: 17, padding: 12 },
  listHeading: { gap: 11 },
  listHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  filters: { gap: 6 },
  filter: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
  },
  accountRows: { gap: 6 },
  accountRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  accountIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 13,
  },
  accountText: { flex: 1, minWidth: 0, gap: 3 },
  accountBalance: { alignItems: 'flex-end', gap: 5 },
  inclusion: { fontSize: 11 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  noteText: { flex: 1, gap: 3 },
  detailContent: { paddingHorizontal: 18, gap: 17 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailHeading: { gap: 12 },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  detailIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  detailTitle: { flex: 1, minWidth: 0, gap: 5 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  detailPanel: { gap: 13, borderWidth: 1, borderRadius: 16, padding: 15 },
  balancePanel: { gap: 7, borderWidth: 1, borderRadius: 16, padding: 16 },
  flowMetrics: { flexDirection: 'row', gap: 7, marginTop: 7 },
  chart: { height: 124, flexDirection: 'row', alignItems: 'stretch', gap: 2 },
  chartColumn: { flex: 1, position: 'relative', minWidth: 2 },
  chartZero: { position: 'absolute', top: '50%', right: 0, left: 0, height: 1 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  propertyPanel: { gap: 13, borderWidth: 1, borderRadius: 16, padding: 15 },
  propertyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  personalize: { gap: 11, borderWidth: 1, borderRadius: 13, padding: 12 },
  personalizeHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  colorSwatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  activityPanel: {
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  activityHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 2,
  },
  activityTitle: { gap: 3 },
  activityRows: { gap: 0 },
  separator: { height: StyleSheet.hairlineWidth },
});
function displayAccountType(account: AccountListEntry): string {
  return account.type === 'other' && account.customType
    ? account.customType
    : account.type.replace(/^./, (letter) => letter.toUpperCase());
}

function matchesAccountFilter(account: AccountListEntry, filter: AccountFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'custom') {
    return (
      account.type === 'other' ||
      account.type === 'loan' ||
      !['bank', 'card', 'wallet', 'cash'].includes(account.type)
    );
  }
  return account.type === filter;
}

export function AccountsIndexView({
  accounts,
  totals,
  loading,
  error,
  topInset = 0,
  bottomInset = 0,
  onRetry,
  onAddAccount,
  onOpenAccount,
}: AccountsIndexViewProps) {
  const { tokens } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AccountFilter>('all');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return accounts.filter((account) => {
      const matchesSearch =
        !query ||
        [account.name, account.type, account.customType, account.currency]
          .filter(Boolean)
          .some((part) => part!.toLocaleLowerCase().includes(query));
      return matchesAccountFilter(account, filter) && matchesSearch;
    });
  }, [accounts, filter, search]);
  const excludedCount = accounts.filter((account) => !account.isIncludedInTotal).length;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: tokens.background }]}
      contentContainerStyle={[
        styles.pageContent,
        { paddingTop: topInset + 10, paddingBottom: bottomInset + 30 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerStack}>
        <View style={styles.header}>
          <View style={styles.headingBlock}>
            <Typography variant="hero">Accounts</Typography>
            <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
              All your money, in one place.
            </Typography>
          </View>
          <Button onPress={onAddAccount}>
            <Plus size={17} color={tokens.background} /> Add
          </Button>
        </View>
        <View
          style={[
            styles.search,
            { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
          ]}
        >
          <MagnifyingGlass size={17} color={tokens.foregroundSubtle} />
          <TextInput
            accessibilityLabel="Search accounts"
            value={search}
            onChangeText={setSearch}
            placeholder="Search accounts…"
            placeholderTextColor={tokens.foregroundSubtle}
            returnKeyType="search"
            style={[styles.searchInput, { color: tokens.foreground }]}
          />
        </View>
      </View>

      {loading ? (
        <View
          accessibilityLabel="Loading accounts"
          accessibilityState={{ busy: true }}
          style={{ gap: 9 }}
        >
          {[0, 1, 2].map((key) => (
            <View
              key={key}
              style={{ height: 84, borderRadius: 16, backgroundColor: tokens.surfaceRaised }}
            />
          ))}
        </View>
      ) : error ? (
        <View
          accessibilityRole="alert"
          style={{
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            borderRadius: 16,
            padding: 24,
            backgroundColor: tokens.card,
          }}
        >
          <Typography variant="title">Accounts could not be opened</Typography>
          <Typography
            variant="small"
            style={{ textAlign: 'center', color: tokens.foregroundMuted }}
          >
            {error}
          </Typography>
          <Button variant="outline" onPress={onRetry}>
            Try again
          </Button>
        </View>
      ) : (
        <>
          <View style={styles.summaryStack}>
            <SummaryCard
              icon={<Wallet size={21} color={tokens.primary} />}
              title="Included balance"
              detail={`Across ${accounts.filter((account) => account.isIncludedInTotal).length} accounts`}
            >
              {totals.length ? (
                <View style={{ gap: 2 }}>
                  {totals.map(({ currency, amountMinor }) => (
                    <Money
                      key={currency}
                      amountMinor={amountMinor}
                      currency={currency}
                      size="display"
                    />
                  ))}
                </View>
              ) : (
                <Typography variant="bodyLarge">No included balance</Typography>
              )}
            </SummaryCard>
            <View style={styles.summaryPair}>
              <SummaryCard
                icon={<Landmark size={19} color={tokens.primary} />}
                title="Accounts"
                detail="active accounts"
                value={String(accounts.length)}
                compact
              />
              <SummaryCard
                icon={<EyeOff size={19} color={tokens.foregroundMuted} />}
                title="Excluded"
                detail={excludedCount === 1 ? 'account not in total' : 'accounts not in total'}
                value={String(excludedCount)}
                compact
              />
            </View>
          </View>

          {accounts.length === 0 ? (
            <View
              style={{
                alignItems: 'center',
                gap: 11,
                padding: 24,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                borderRadius: 16,
                backgroundColor: tokens.card,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 16,
                  backgroundColor: tokens.surfaceRaised,
                }}
              >
                <Wallet size={24} color={tokens.primary} />
              </View>
              <Typography variant="title">Start with an account</Typography>
              <Text style={{ maxWidth: 300, color: tokens.foregroundMuted, textAlign: 'center' }}>
                Add cash, a bank account, or a card to keep balances and activity in one place.
              </Text>
              <Button onPress={onAddAccount}>
                <Plus size={16} color={tokens.background} /> Add your first account
              </Button>
            </View>
          ) : (
            <View
              style={[
                styles.listPanel,
                { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
              ]}
            >
              <View style={styles.listHeading}>
                <View style={styles.listHeadingRow}>
                  <Typography variant="title">Your accounts</Typography>
                  <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                    {filtered.length} shown
                  </Typography>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {filterOptions.map((option) => {
                    const selected = filter === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Filter accounts: ${option.title}`}
                        accessibilityState={{ selected }}
                        onPress={() => setFilter(option.id)}
                        activeOpacity={0.72}
                        style={[
                          styles.filter,
                          {
                            borderColor: selected ? tokens.foreground : tokens.borderSubtle,
                            backgroundColor: selected ? tokens.foreground : tokens.card,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: selected ? tokens.background : tokens.foregroundMuted,
                            fontSize: 13,
                            fontWeight: selected ? '600' : '400',
                          }}
                        >
                          {option.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              {filtered.length === 0 ? (
                <View style={{ alignItems: 'center', gap: 7, paddingVertical: 23 }}>
                  <MagnifyingGlass size={20} color={tokens.foregroundSubtle} />
                  <Typography variant="bodyLarge">No accounts match this search</Typography>
                  <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
                    Try another name or account type.
                  </Typography>
                </View>
              ) : (
                <View style={styles.accountRows}>
                  {filtered.map((account) => {
                    const color = account.color?.trim() || tokens.primary;
                    const typeIcon =
                      account.type === 'cash'
                        ? Coins
                        : account.type === 'bank'
                          ? Landmark
                          : account.type === 'card'
                            ? ReceiptText
                            : account.type === 'loan'
                              ? CurrencyDollar
                              : account.type === 'wallet'
                                ? Wallet
                                : Landmark;
                    const TypeIcon = typeIcon;
                    return (
                      <TouchableOpacity
                        key={account.id}
                        accessibilityRole="link"
                        accessibilityLabel={`Open ${account.name} account`}
                        onPress={() => onOpenAccount(account.id)}
                        activeOpacity={0.74}
                        style={[
                          styles.accountRow,
                          { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
                        ]}
                      >
                        <View
                          style={[
                            styles.accountIcon,
                            { borderColor: `${color}99`, backgroundColor: `${color}22` },
                          ]}
                        >
                          {account.icon ? (
                            <EntityIcon value={account.icon} size={21} color={color} />
                          ) : (
                            <TypeIcon size={21} color={color} />
                          )}
                        </View>
                        <View style={styles.accountText}>
                          <Typography variant="bodyLarge" numberOfLines={1}>
                            {account.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            numberOfLines={1}
                            style={{ color: tokens.foregroundMuted }}
                          >
                            {displayAccountType(account)} · {account.currency}
                          </Typography>
                        </View>
                        <View style={styles.accountBalance}>
                          <Money amountMinor={account.balanceMinor} currency={account.currency} />
                          <Text
                            style={{
                              fontSize: 11,
                              color: account.isIncludedInTotal
                                ? tokens.income
                                : tokens.foregroundMuted,
                            }}
                          >
                            {account.isIncludedInTotal ? 'In total' : 'Excluded'}
                          </Text>
                        </View>
                        <CaretRight size={16} color={tokens.foregroundSubtle} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
          <View
            style={[
              styles.note,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <CurrencyDollar size={23} color={tokens.primary} />
            <View style={styles.noteText}>
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                Included balances
              </Typography>
              {totals.length ? (
                totals.map(({ currency, amountMinor }) => (
                  <Money key={currency} amountMinor={amountMinor} currency={currency} size="body" />
                ))
              ) : (
                <Typography variant="small">
                  No accounts are included in your overall balance.
                </Typography>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SummaryCard({
  icon,
  title,
  detail,
  value,
  compact = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  value?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.summaryCard,
        compact && styles.summaryCardCompact,
        { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
      ]}
    >
      <View
        style={[
          styles.summaryIcon,
          compact && styles.summaryIconCompact,
          { backgroundColor: tokens.surfaceRaised },
        ]}
      >
        {icon}
      </View>
      <View style={styles.summaryCopy}>
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
          {title}
        </Typography>
        {value ? <Typography variant="heading">{value}</Typography> : children}
        <Typography variant="caption" numberOfLines={1} style={{ color: tokens.foregroundMuted }}>
          {detail}
        </Typography>
      </View>
    </View>
  );
}

export type AccountDetailViewProps = {
  account: AccountListEntry & { createdAt?: number; archivedAt?: number };
  activity: AccountActivityEntry[];
  flowActivity: { occurredAt: number; cashFlowMinor: bigint }[];
  isBusy: boolean;
  error?: string | null;
  rangeNotice?: string | null;
  topInset?: number;
  bottomInset?: number;
  onRename: (name: string) => Promise<boolean>;
  onArchive: () => Promise<boolean>;
  onSetIcon: (icon: string | null) => void;
  onSetColor: (color: string | null) => void;
  onAddTransaction: () => void;
  onOpenTransaction: (id: string) => void;
  onBack: () => void;
};

export function AccountDetailView({
  account,
  activity,
  flowActivity,
  isBusy,
  error,
  rangeNotice,
  topInset = 0,
  bottomInset = 0,
  onRename,
  onArchive,
  onSetIcon,
  onSetColor,
  onAddTransaction,
  onBack,
  onOpenTransaction,
}: AccountDetailViewProps) {
  const { tokens } = useTheme();
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(account.name);
  const isArchived = account.archivedAt !== undefined;
  const accountKind = displayAccountType(account);
  const chartDays = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    const days: { date: Date; amount: bigint }[] = [];
    for (let offset = 0; offset < 30; offset += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      days.push({ date, amount: 0n });
    }
    const byKey = new Map<string, number>();
    days.forEach((day, index) =>
      byKey.set(`${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`, index),
    );
    for (const transaction of flowActivity) {
      const date = new Date(transaction.occurredAt);
      const index = byKey.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      if (index !== undefined) {
        const day = days[index];
        if (day) day.amount += transaction.cashFlowMinor;
      }
    }
    return days;
  }, [flowActivity]);
  const incoming = flowActivity.reduce(
    (total, transaction) =>
      total + (transaction.cashFlowMinor > 0n ? transaction.cashFlowMinor : 0n),
    0n,
  );
  const outgoing = flowActivity.reduce(
    (total, transaction) =>
      total + (transaction.cashFlowMinor < 0n ? -transaction.cashFlowMinor : 0n),
    0n,
  );
  const net = incoming - outgoing;
  const maxBar = chartDays.reduce((maximum, day) => {
    const magnitude = day.amount < 0n ? -day.amount : day.amount;
    return magnitude > maximum ? magnitude : maximum;
  }, 0n);

  async function submitRename() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    if (await onRename(trimmed)) setRenameOpen(false);
  }

  const color = account.color?.trim() || tokens.primary;

  return (
    <>
      <ScrollView
        style={[styles.scroll, { backgroundColor: tokens.background }]}
        contentContainerStyle={[
          styles.detailContent,
          { paddingTop: topInset + 10, paddingBottom: bottomInset + 32 },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel="Back to accounts"
          onPress={onBack}
          style={styles.breadcrumb}
        >
          <ArrowLeft size={16} color={tokens.foregroundMuted} />
          <Text style={{ color: tokens.foregroundMuted }}>Accounts</Text>
          <CaretRight size={14} color={tokens.foregroundSubtle} />
          <Text numberOfLines={1} style={{ flex: 1, color: tokens.foreground }}>
            {account.name}
          </Text>
        </TouchableOpacity>

        <View style={styles.detailHeading}>
          <View style={styles.detailTitleRow}>
            <View
              style={[
                styles.detailIcon,
                { borderColor: `${color}99`, backgroundColor: `${color}22` },
              ]}
            >
              {account.icon ? (
                <EntityIcon value={account.icon} size={26} color={color} />
              ) : (
                <Landmark size={26} color={color} />
              )}
            </View>
            <View style={styles.detailTitle}>
              <Typography variant="heading" numberOfLines={1}>
                {account.name}
              </Typography>
              <View style={styles.detailMeta}>
                <Text style={{ color: tokens.foregroundMuted, fontSize: 13 }}>
                  {accountKind} · {account.currency}
                </Text>
                <Text
                  style={{
                    borderRadius: 99,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    overflow: 'hidden',
                    backgroundColor: account.isIncludedInTotal
                      ? `${tokens.income}22`
                      : tokens.surfaceRaised,
                    color: account.isIncludedInTotal ? tokens.income : tokens.foregroundMuted,
                    fontSize: 11,
                  }}
                >
                  {account.isIncludedInTotal ? 'In total' : 'Excluded'}
                </Text>
              </View>
            </View>
          </View>
          {!isArchived && (
            <View style={styles.detailActions}>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setNameDraft(account.name);
                  setRenameOpen(true);
                }}
              >
                Rename
              </Button>
              <Button size="sm" variant="outline" onPress={onAddTransaction}>
                <Plus size={15} color={tokens.foreground} /> Add transaction
              </Button>
              <Button size="sm" variant="destructive" onPress={() => setArchiveOpen(true)}>
                Archive
              </Button>
            </View>
          )}
        </View>

        <View style={{ gap: 13 }}>
          <View
            style={[
              styles.balancePanel,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
              Current balance
            </Typography>
            <Money amountMinor={account.balanceMinor} currency={account.currency} size="hero" />
            <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
              {accountKind} · {account.currency}
            </Typography>
            <View style={styles.flowMetrics}>
              <FlowMetric
                title="Money in"
                amountMinor={incoming}
                currency={account.currency}
                icon={<ArrowUpRight size={15} color={tokens.income} />}
                tint={tokens.income}
              />
              <FlowMetric
                title="Money out"
                amountMinor={outgoing}
                currency={account.currency}
                icon={<ArrowUpRight size={15} color={tokens.expense} />}
                tint={tokens.expense}
              />
              <FlowMetric
                title="Net change"
                amountMinor={net}
                currency={account.currency}
                icon={<CurrencyDollar size={15} color={tokens.primary} />}
                tint={tokens.primary}
                signed
              />
            </View>
          </View>

          <View
            style={[
              styles.detailPanel,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <View style={{ gap: 3 }}>
              <Typography variant="title">Account cash flow</Typography>
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                Last 30 days · {flowActivity.length} posted transactions
              </Typography>
            </View>
            <View
              accessibilityRole="image"
              accessibilityLabel={`Daily net account cash flow for the last 30 days. Net change ${net >= 0n ? 'positive' : 'negative'}.`}
              style={styles.chart}
            >
              {chartDays.map(({ date, amount }) => {
                const magnitude = amount < 0n ? -amount : amount;
                const height = maxBar === 0n ? 0 : Math.max(2, Number((magnitude * 46n) / maxBar));
                return (
                  <View
                    key={date.toISOString()}
                    accessibilityLabel={`${date.toLocaleDateString()}: ${amount >= 0n ? 'in' : 'out'} ${magnitude} minor units`}
                    style={styles.chartColumn}
                  >
                    <View style={[styles.chartZero, { backgroundColor: tokens.borderSubtle }]} />
                    {amount !== 0n ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: amount > 0n ? `${50 - height}%` : '50%',
                          height: `${height}%`,
                          borderRadius: 3,
                          backgroundColor: amount > 0n ? tokens.income : tokens.expense,
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View style={styles.chartLabels}>
              <Typography variant="caption" style={{ color: tokens.foregroundSubtle }}>
                {chartDays[0]?.date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Typography>
              <Typography variant="caption" style={{ color: tokens.foregroundSubtle }}>
                Today
              </Typography>
            </View>
            <View style={styles.chartLegend}>
              <LegendDot color={tokens.income} label="Money in" />
              <LegendDot color={tokens.expense} label="Money out" />
              <Text style={{ color: tokens.foregroundSubtle, fontSize: 11 }}>
                Bars show daily net
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.propertyPanel,
            { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
          ]}
        >
          <View style={{ gap: 3 }}>
            <Typography variant="title">Account details</Typography>
            <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
              Settings and identity
            </Typography>
          </View>
          <View style={styles.propertyGrid}>
            <Property
              icon={<Landmark size={17} color={tokens.primary} />}
              title="Type"
              value={accountKind}
            />
            <Property
              icon={<CurrencyDollar size={17} color={tokens.primary} />}
              title="Currency"
              value={account.currency}
            />
            <Property
              icon={<Check size={17} color={tokens.primary} />}
              title="Included in total"
              value={
                account.isIncludedInTotal ? 'Counts in total balance' : 'Not counted in balance'
              }
            />
            <Property
              icon={<CalendarDays size={17} color={tokens.primary} />}
              title="Added on"
              value={
                account.createdAt
                  ? new Date(account.createdAt).toLocaleDateString()
                  : 'Date unavailable'
              }
            />
          </View>
          {!isArchived && (
            <View style={[styles.personalize, { borderColor: tokens.borderSubtle }]}>
              <View style={styles.personalizeHeading}>
                <View
                  style={{
                    width: 37,
                    height: 37,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: `${color}99`,
                    backgroundColor: `${color}22`,
                  }}
                >
                  {account.icon ? (
                    <EntityIcon value={account.icon} size={21} color={color} />
                  ) : (
                    <Landmark size={21} color={color} />
                  )}
                </View>
                <View style={{ gap: 2 }}>
                  <Typography variant="bodyLarge">Personalize account</Typography>
                  <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                    Choose a color and icon
                  </Typography>
                </View>
              </View>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Account color"
                style={styles.colorSwatches}
              >
                <ColorSwatch
                  name="Default"
                  value={null}
                  selected={!account.color}
                  disabled={isBusy}
                  onPress={() => onSetColor(null)}
                />
                {accountColors.map((colorOption) => (
                  <ColorSwatch
                    key={colorOption.value}
                    name={colorOption.name}
                    value={colorOption.value}
                    selected={account.color?.toLowerCase() === colorOption.value.toLowerCase()}
                    disabled={isBusy}
                    onPress={() => onSetColor(colorOption.value)}
                  />
                ))}
              </View>
              <View pointerEvents={isBusy ? 'none' : 'auto'} style={{ opacity: isBusy ? 0.55 : 1 }}>
                <EntityIconPicker
                  mode="lucide"
                  value={account.icon}
                  onChange={(icon) => onSetIcon(icon ?? null)}
                  label="Change account icon"
                  compact
                />
              </View>
            </View>
          )}
        </View>

        {!!error && (
          <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {error}
          </Typography>
        )}
        {!!rangeNotice && (
          <Typography accessibilityLiveRegion="polite" style={{ color: tokens.foregroundMuted }}>
            {rangeNotice}
          </Typography>
        )}
        {isArchived && (
          <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
            Archived accounts remain available for reference and cannot receive new transactions.
          </Typography>
        )}

        <View
          style={[
            styles.activityPanel,
            { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
          ]}
        >
          <View style={styles.activityHeading}>
            <View style={{ gap: 3 }}>
              <Typography variant="title">Recent activity</Typography>
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                Last 30 days · {flowActivity.length} posted transactions
              </Typography>
            </View>
            {!isArchived && (
              <Button size="sm" variant="outline" onPress={onAddTransaction}>
                <Plus size={14} color={tokens.foreground} /> Add
              </Button>
            )}
          </View>
          {activity.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 9, paddingVertical: 23 }}>
              <Typography variant="bodyLarge">No posted activity yet</Typography>
              <Typography
                variant="small"
                style={{ color: tokens.foregroundMuted, textAlign: 'center' }}
              >
                Record a transaction to see it here.
              </Typography>
              {!isArchived && (
                <Button size="sm" variant="outline" onPress={onAddTransaction}>
                  Add transaction
                </Button>
              )}
            </View>
          ) : (
            <View style={styles.activityRows}>
              {activity.map((transaction, index) => (
                <React.Fragment key={transaction.id}>
                  <TransactionRow
                    title={transaction.title}
                    category={transaction.category}
                    categoryIcon={transaction.categoryIcon}
                    date={transaction.date}
                    status={transaction.status}
                    amountMinor={transaction.amountMinor}
                    currency={transaction.currency}
                    type={transaction.type}
                    semanticType={transaction.semanticType}
                    onPress={() => onOpenTransaction(transaction.id)}
                  />
                  {index < activity.length - 1 ? (
                    <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Sheet visible={renameOpen} title="Rename account" onClose={() => setRenameOpen(false)}>
        <View style={{ gap: 12 }}>
          <Label>Account name</Label>
          <Input
            accessibilityLabel="Account name"
            value={nameDraft}
            onChangeText={setNameDraft}
            maxLength={80}
            autoFocus
          />
          {!!error && (
            <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
              {error}
            </Typography>
          )}
          <Button disabled={isBusy || !nameDraft.trim()} onPress={() => void submitRename()}>
            {isBusy ? 'Saving…' : 'Save name'}
          </Button>
          <Button variant="outline" onPress={() => setRenameOpen(false)}>
            Cancel
          </Button>
        </View>
      </Sheet>
      <Sheet visible={archiveOpen} title="Archive account?" onClose={() => setArchiveOpen(false)}>
        <View style={{ gap: 12 }}>
          <Typography variant="small">
            Past transactions and balances remain in your history. This account will no longer be
            available for new activity.
          </Typography>
          {!!error && (
            <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
              {error}
            </Typography>
          )}
          <Button variant="destructive" disabled={isBusy} onPress={() => void onArchive()}>
            {isBusy ? 'Archiving…' : `Archive ${account.name}`}
          </Button>
          <Button variant="outline" onPress={() => setArchiveOpen(false)}>
            Cancel
          </Button>
        </View>
      </Sheet>
    </>
  );
}

function FlowMetric({
  title,
  amountMinor,
  currency,
  icon,
  tint,
  signed = false,
}: {
  title: string;
  amountMinor: bigint;
  currency: string;
  icon: React.ReactNode;
  tint: string;
  signed?: boolean;
}) {
  const absolute = amountMinor < 0n ? -amountMinor : amountMinor;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        gap: 5,
        borderRadius: 11,
        padding: 9,
        backgroundColor: `${tint}12`,
      }}
    >
      {icon}
      <Typography variant="caption" style={{ color: tint }} numberOfLines={1}>
        {title}
      </Typography>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {signed ? (
          <Text style={{ color: tint, fontWeight: '600' }}>{amountMinor >= 0n ? '+' : '−'}</Text>
        ) : null}
        <Money amountMinor={absolute} currency={currency} size="body" />
      </View>
    </View>
  );
}

function Property({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{ width: '47%', minWidth: 130, flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View
        style={{
          width: 31,
          height: 31,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 50,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
          {title}
        </Typography>
        <Typography variant="small" numberOfLines={2}>
          {value}
        </Typography>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function ColorSwatch({
  name,
  value,
  selected,
  disabled,
  onPress,
}: {
  name: string;
  value: string | null;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityLabel={`${name} account color`}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.74}
      style={{
        width: 31,
        height: 31,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? tokens.foreground : tokens.borderSubtle,
        borderRadius: 50,
        padding: 3,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 50,
          backgroundColor: value ?? tokens.surfaceRaised,
        }}
      />
    </TouchableOpacity>
  );
}
