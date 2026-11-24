import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Button,
  IconButton,
  ListSkeleton,
  StatTile,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  ChartLineUp,
  Gear,
  Plus,
  Wallet,
} from '@finapp/ui/icons/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '@convex/shared/money';
import { layoutTokens, space } from '../../tokens';
import { simplifyDebts } from '@convex/splits/domain';
import type { BalanceMap, TimelineJoin } from '../groupSettle';
import { GroupChatScreen, type GroupChatScreenProps } from './GroupChatScreen';
import { GroupTile, type GroupMetadata } from './GroupPrimitives';
import {
  GroupExpenseTimeline,
  IllustratedState,
  LateJoinerBanner,
  MemberBalanceBars,
  NetPositionHero,
  SectionTitle,
  SettleCard,
  SettlementHistoryRow,
  SuggestedTransfers,
  type SettlePerson,
} from './GroupSettleParts';

export type GroupDetailMember = {
  id: string;
  name: string;
  username?: string;
  avatarId?: string;
  avatarUrl?: string | null;
  role?: string;
  joinedAt?: number;
};
export type GroupDetailFormerMember = {
  id: string;
  name: string;
  avatarId?: string;
  leftAt: number;
};
export type GroupDetailActivity = {
  id: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  date: string;
  occurredAt?: number;
  category?: string;
  account?: string;
  icon?: string;
  color?: string;
};
export type GroupDetailSettlement = {
  id: string;
  description: string;
  amountMinor: bigint;
  currency: string;
  date?: string;
  note?: string;
};
export type GroupDetailScreenProps = {
  group?: GroupMetadata & { name: string; currency: string; icon?: string; color?: string };
  loading: boolean;
  balanceStatus: 'loading' | 'unavailable' | 'ready';
  balanceMinor: bigint;
  balanceCurrency: string;
  balanceMeaning: string;
  balanceError?: string;
  canSettle: boolean;
  totalSpend?: string;
  owed?: string;
  owing?: string;
  /** Every member's net balance (positive: owed to them). */
  balances?: BalanceMap;
  meId?: string | null;
  members: readonly GroupDetailMember[];
  formerMembers?: readonly GroupDetailFormerMember[];
  /** Members who joined after earlier expenses, for the timeline markers. */
  joins?: readonly TimelineJoin[];
  /** Admin prompt: members who missed past expenses. */
  lateJoiners?: readonly { userId: string; name: string; missedCount: number }[];
  onIncludeLateJoiner?: (userId: string) => void;
  onDismissLateJoiner?: (userId: string) => void;
  activities: readonly GroupDetailActivity[];
  settlements: readonly GroupDetailSettlement[];
  settlementsLoading: boolean;
  settlementsError?: string;
  chat: GroupChatScreenProps;
  onBack: () => void;
  onOpenChat: () => void;
  onOpenAnalytics: () => void;
  onOpenSettings: () => void;
  onOpenBalances: () => void;
  onOpenExpenses?: () => void;
  onSettle: () => void;
  onSettleWith?: (memberId: string) => void;
  /** Sends a payment reminder to a member who owes you. */
  onRemind?: (memberId: string) => void;
  onAddExpense: () => void;
  onOpenActivity: (id: string) => void;
  onRetry: () => void;
};

export function GroupDetailScreen(p: GroupDetailScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const ready = p.balanceStatus === 'ready' && !p.balanceError;
  const people: SettlePerson[] = useMemo(
    () => [
      ...p.members.map((member) => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.avatarUrl,
        avatarId: member.avatarId,
      })),
      ...(p.formerMembers ?? [])
        .filter((former) => !p.members.some((member) => member.id === former.id))
        .map((former) => ({ ...former })),
    ],
    [p.formerMembers, p.members],
  );
  const transfers = useMemo(() => (p.balances ? simplifyDebts(p.balances) : []), [p.balances]);
  const allSettled =
    ready && !!p.balances && Object.values(p.balances).every((value) => value === 0n);
  const insights = useMemo(() => {
    const totals = new Map<string, bigint>();
    const categories = new Map<
      string,
      { category: string; currency: string; amount: bigint; icon?: string; color?: string }
    >();
    for (const item of p.activities) {
      const amount = item.amountMinor < 0n ? -item.amountMinor : item.amountMinor;
      const category = item.category ?? 'Uncategorized';
      const key = `${item.currency}:${category}`;
      totals.set(item.currency, (totals.get(item.currency) ?? 0n) + amount);
      const previous = categories.get(key);
      if (previous) previous.amount += amount;
      else
        categories.set(key, {
          category,
          currency: item.currency,
          amount,
          icon: item.icon,
          color: item.color,
        });
    }
    return Array.from(categories.values()).map((category) => ({
      ...category,
      percentage: totals.get(category.currency)
        ? Number((category.amount * 100n) / totals.get(category.currency)!)
        : 0,
    }));
  }, [p.activities]);
  const pending = p.balanceStatus === 'loading' ? 'Loading…' : '—';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: layoutTokens.screenX,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 28,
        gap: space.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <IconButton label="Go back" variant="ghost" onPress={p.onBack}>
          <ArrowLeft size={20} color={tokens.foreground} />
        </IconButton>
        {p.group ? <GroupTile icon={p.group.icon} color={p.group.color} size={36} /> : null}
        <View style={{ flex: 1 }}>
          <Typography variant="heading" numberOfLines={1}>
            {p.group?.name ?? 'Group'}
          </Typography>
          {p.group ? (
            <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
              {p.members.length} member{p.members.length === 1 ? '' : 's'} · {p.group.currency}
            </Typography>
          ) : null}
        </View>
        {p.group ? (
          <IconButton label="Group settings" variant="ghost" onPress={p.onOpenSettings}>
            <Gear size={20} color={tokens.foreground} />
          </IconButton>
        ) : null}
      </View>
      {p.loading ? (
        <SettleCard>
          <ListSkeleton rows={4} />
        </SettleCard>
      ) : !p.group ? (
        <IllustratedState
          scene="error"
          title="Group unavailable"
          description="This group is not saved on this device."
          action={
            <Button variant="outline" onPress={p.onRetry}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          {ready ? (
            <NetPositionHero
              balanceMinor={p.balanceMinor}
              currency={p.balanceCurrency}
              title={p.balanceMeaning}
              people={p.members}
            >
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {p.canSettle ? (
                  <Button style={{ flex: 1 }} onPress={p.onSettle}>
                    Settle up
                  </Button>
                ) : null}
                <Button
                  style={{ flex: 1 }}
                  variant={p.canSettle ? 'outline' : 'primary'}
                  onPress={p.onAddExpense}
                >
                  <Plus
                    size={16}
                    color={p.canSettle ? tokens.foreground : tokens.primaryForeground}
                  />{' '}
                  Add expense
                </Button>
              </View>
            </NetPositionHero>
          ) : (
            <SettleCard>
              {p.balanceStatus === 'loading' ? (
                <ListSkeleton rows={2} avatar={false} />
              ) : (
                <IllustratedState
                  scene="offline"
                  title="Balances unavailable"
                  description={`Complete group balances could not be loaded, so no partial value is shown.${p.balanceError ? ` ${p.balanceError}` : ''}`}
                  action={
                    <Button variant="outline" onPress={p.onRetry}>
                      Retry
                    </Button>
                  }
                />
              )}
              <Button variant="outline" onPress={p.onAddExpense}>
                + Add expense
              </Button>
            </SettleCard>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            <StatTile
              label="Total spend"
              value={ready ? (p.totalSpend ?? '—') : pending}
              icon={<Wallet size={16} color={tokens.primary} />}
              tone="accent"
              style={{ minWidth: '100%' }}
            />
            <StatTile
              label="You owe"
              value={
                ready
                  ? (p.owing ??
                    formatMinor(p.balanceMinor < 0n ? -p.balanceMinor : 0n, p.balanceCurrency))
                  : pending
              }
              icon={<ArrowUpRight size={16} color={tokens.expense} />}
              tone="expense"
              style={{ minWidth: 140 }}
            />
            <StatTile
              label="Owed to you"
              value={
                ready
                  ? (p.owed ??
                    formatMinor(p.balanceMinor > 0n ? p.balanceMinor : 0n, p.balanceCurrency))
                  : pending
              }
              icon={<ArrowDownRight size={16} color={tokens.income} />}
              tone="income"
              style={{ minWidth: 140 }}
            />
          </View>
          {p.lateJoiners?.map((joiner) => (
            <LateJoinerBanner
              key={joiner.userId}
              name={joiner.name}
              missedCount={joiner.missedCount}
              onInclude={() => p.onIncludeLateJoiner?.(joiner.userId)}
              onDismiss={
                p.onDismissLateJoiner ? () => p.onDismissLateJoiner?.(joiner.userId) : undefined
              }
            />
          ))}
          <SettleCard>
            <SectionTitle
              title="Balances"
              caption="Who gets back and who owes, across all time."
              action={
                <Button size="sm" variant="ghost" onPress={p.onOpenBalances}>
                  View all
                </Button>
              }
            />
            {!ready ? (
              <ListSkeleton rows={3} />
            ) : allSettled ? (
              <IllustratedState
                scene="allSettled"
                title="Everyone is settled up"
                description="New shared expenses will show up here."
              />
            ) : p.balances ? (
              <>
                <MemberBalanceBars
                  balances={p.balances}
                  currency={p.balanceCurrency}
                  people={people}
                  meId={p.meId}
                  onPressMember={p.onSettleWith}
                />
                {transfers.length > 0 && (
                  <View style={{ gap: space.sm }}>
                    <Typography variant="label">Suggested transfers</Typography>
                    <SuggestedTransfers
                      transfers={transfers}
                      currency={p.balanceCurrency}
                      people={people}
                      meId={p.meId}
                      limit={3}
                      onRemind={
                        p.onRemind ? (transfer) => p.onRemind?.(transfer.fromUserId) : undefined
                      }
                      onSettle={
                        p.onSettleWith
                          ? (transfer) =>
                              p.onSettleWith?.(
                                transfer.fromUserId === p.meId
                                  ? transfer.toUserId
                                  : transfer.fromUserId,
                              )
                          : undefined
                      }
                    />
                  </View>
                )}
              </>
            ) : null}
          </SettleCard>
          <SettleCard>
            <SectionTitle
              title="Recent expenses"
              action={
                p.onOpenExpenses ? (
                  <Button size="sm" variant="ghost" onPress={p.onOpenExpenses}>
                    See all
                  </Button>
                ) : undefined
              }
            />
            {p.activities.length ? (
              <GroupExpenseTimeline
                expenses={p.activities.map((activity) => ({
                  ...activity,
                  occurredAt: activity.occurredAt ?? 0,
                  detail: [activity.category, activity.account].filter(Boolean).join(' · '),
                }))}
                joins={p.joins}
                onOpen={p.onOpenActivity}
              />
            ) : (
              <IllustratedState
                scene="splitBill"
                title="Your group history starts with an expense"
                description="Add a shared expense and choose who was part of it."
                action={
                  <Button variant="outline" onPress={p.onAddExpense}>
                    Add expense
                  </Button>
                }
              />
            )}
          </SettleCard>
          <SettleCard>
            <SectionTitle title="Recent settlements" />
            {p.settlementsError ? (
              <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
                {p.settlementsError}
              </Typography>
            ) : p.settlementsLoading ? (
              <ListSkeleton rows={2} />
            ) : p.settlements.length ? (
              p.settlements.map((settlement) => (
                <SettlementHistoryRow
                  key={settlement.id}
                  description={settlement.description}
                  amountMinor={settlement.amountMinor}
                  currency={settlement.currency}
                  date={settlement.date}
                  note={settlement.note}
                />
              ))
            ) : (
              <IllustratedState
                scene="history"
                title="No payments yet"
                description="Payments you record between members will appear here."
              />
            )}
          </SettleCard>
          {insights.length > 0 && (
            <SettleCard>
              <SectionTitle
                title="Where it goes"
                caption="By category · recent expenses"
                action={
                  <Button size="sm" variant="ghost" onPress={p.onOpenAnalytics}>
                    <ChartLineUp size={16} color={tokens.foreground} />
                  </Button>
                }
              />
              {insights.map((insight) => (
                <View key={`${insight.currency}:${insight.category}`} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                    <GroupTile
                      icon={insight.icon ?? 'phosphor:ChartPie'}
                      color={insight.color ?? tokens.split}
                      size={26}
                    />
                    <Typography variant="small" style={{ flex: 1 }}>
                      {insight.category}
                    </Typography>
                    <Typography variant="caption">
                      {formatMinor(insight.amount, insight.currency)} · {insight.percentage}%
                    </Typography>
                  </View>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: tokens.surfaceRaised,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${insight.percentage}%`,
                        height: 6,
                        backgroundColor: insight.color ?? tokens.primary,
                      }}
                    />
                  </View>
                </View>
              ))}
            </SettleCard>
          )}
          <GroupChatScreen
            {...p.chat}
            group={p.group}
            members={p.members.map((member) => ({
              ...member,
              avatarUrl: member.avatarUrl ?? undefined,
            }))}
            embedded
            onOpenGroup={p.onOpenBalances}
            onAddExpense={p.onAddExpense}
            onOpenSettings={p.onOpenSettings}
          />
        </>
      )}
    </ScrollView>
  );
}
