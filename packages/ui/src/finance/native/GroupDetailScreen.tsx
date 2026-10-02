import { FinanceEmptyState } from './FinanceEmptyState';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Empty, Typography, useTheme } from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '@convex/shared/money';
import { GroupChatScreen, type GroupChatScreenProps } from './GroupChatScreen';
import {
  GroupAvatar,
  GroupHeading,
  GroupMetadataSummary,
  GroupMetric,
  GroupPanel,
  GroupTile,
  type GroupMetadata,
} from './GroupPrimitives';
import { Money } from './Money';

export type GroupDetailMember = {
  id: string;
  name: string;
  username?: string;
  avatarId?: string;
  avatarUrl?: string | null;
  role?: string;
};
export type GroupDetailActivity = {
  id: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  date: string;
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
  memberBalances?: readonly { id: string; name: string; amount: string; meaning: string }[];
  groupOptions?: readonly { id: string; name: string }[];
  currentGroupId?: string;
  onSelectGroup?: (id: string) => void;
  members: readonly GroupDetailMember[];
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
  onSettle: () => void;
  onAddExpense: () => void;
  onOpenActivity: (id: string) => void;
  onRetry: () => void;
};

export function GroupDetailScreen(p: GroupDetailScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const ready = p.balanceStatus === 'ready' && !p.balanceError;
  const unavailable = p.balanceStatus === 'loading' ? 'Loading…' : 'Unavailable';
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
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 28,
        gap: 16,
      }}
    >
      <GroupHeading title={p.group?.name ?? 'Group'} onBack={p.onBack} />
      {p.groupOptions?.length && p.onSelectGroup ? (
        <GroupPanel>
          <Typography variant="label">Switch group</Typography>
          {p.groupOptions.map((option, index) => {
            const duplicate =
              p.groupOptions!.filter((item) => item.name === option.name).length > 1;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${option.name}${duplicate ? `, group ${index + 1}` : ''}${option.id === p.currentGroupId ? ', current group' : ''}`}
                accessibilityState={{ selected: option.id === p.currentGroupId }}
                onPress={() => p.onSelectGroup?.(option.id)}
                style={{ paddingVertical: 9 }}
              >
                <Typography variant="small">
                  {option.id === p.currentGroupId ? '✓ ' : ''}
                  {option.name}
                  {duplicate ? ` (${index + 1})` : ''}
                </Typography>
              </Pressable>
            );
          })}
        </GroupPanel>
      ) : null}
      {p.loading ? (
        <Typography>Loading group details…</Typography>
      ) : !p.group ? (
        <Empty
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
          <GroupPanel>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <GroupTile icon={p.group.icon} color={p.group.color} size={80} />
              <View style={{ flex: 1, gap: 6 }}>
                <Typography variant="heading">{p.group.name}</Typography>
                <Typography variant="caption">Shared expenses · {p.group.currency}</Typography>
                <View style={{ flexDirection: 'row' }}>
                  {p.members.slice(0, 5).map((member, index) => (
                    <View key={member.id} style={{ marginLeft: index ? -7 : 0 }}>
                      <GroupAvatar name={member.name} avatarId={member.avatarId} avatarUrl={member.avatarUrl} size={28} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <GroupMetadataSummary group={p.group} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button style={{ flex: 1 }} size="sm" variant="outline" onPress={p.onOpenSettings}>
                Edit group
              </Button>
              <Button style={{ flex: 1 }} size="sm" variant="outline" onPress={p.onOpenChat}>
                Open chat
              </Button>
            </View>
            <Button onPress={p.onAddExpense}>+ Add expense</Button>
          </GroupPanel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <GroupMetric
              title="Total group spend"
              value={ready ? (p.totalSpend ?? 'Unavailable') : unavailable}
              detail="Complete history only"
              icon="phosphor:Wallet"
              color={tokens.income}
            />
            <GroupMetric
              title="You are owed"
              value={
                ready
                  ? (p.owed ??
                    formatMinor(p.balanceMinor > 0n ? p.balanceMinor : 0n, p.balanceCurrency))
                  : unavailable
              }
              detail="Your net group balance"
              icon="phosphor:ArrowDownLeft"
              color={tokens.income}
            />
            <GroupMetric
              title="You owe"
              value={
                ready
                  ? (p.owing ??
                    formatMinor(p.balanceMinor < 0n ? -p.balanceMinor : 0n, p.balanceCurrency))
                  : unavailable
              }
              detail="Your net group balance"
              icon="phosphor:ArrowUpRight"
              color={tokens.expense}
            />
            <GroupMetric
              title="Unsettled members"
              value={
                ready && p.memberBalances
                  ? String(p.memberBalances.filter((member) => member.meaning !== 'Settled').length)
                  : unavailable
              }
              detail="Group balances, not scheduled payments"
              icon="phosphor:Receipt"
              color={tokens.warning}
            />
            <GroupMetric
              title="Members"
              value={String(p.members.length)}
              detail="Saved membership"
              icon="phosphor:UsersThree"
              color={tokens.split}
            />
          </View>
          {!ready && (
            <GroupPanel>
              <Typography accessibilityRole={p.balanceError ? 'alert' : undefined} variant="small">
                {p.balanceStatus === 'loading'
                  ? 'Loading complete group history…'
                  : 'Complete group balances are unavailable. No partial all-time value is shown.'}{' '}
                {p.balanceError}
              </Typography>
              {p.balanceError && (
                <Button variant="outline" onPress={p.onRetry}>
                  Retry
                </Button>
              )}
            </GroupPanel>
          )}
          <GroupPanel>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="heading">Members ({p.members.length})</Typography>
              <Button size="sm" variant="outline" onPress={p.onOpenSettings}>
                Manage
              </Button>
            </View>
            {p.members.length ? (
              p.members.map((member) => (
                <View
                  key={member.id}
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'center',
                    paddingVertical: 5,
                  }}
                >
                  <GroupAvatar name={member.name} avatarId={member.avatarId} avatarUrl={member.avatarUrl} size={38} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Typography variant="label">{member.name}</Typography>
                    {member.username && (
                      <Typography variant="caption">
                        @{member.username.replace(/^@+/, '')}
                      </Typography>
                    )}
                  </View>
                  <Typography
                    variant="caption"
                    style={{
                      color:
                        member.role === 'owner' || member.role === 'admin'
                          ? tokens.primary
                          : tokens.foregroundMuted,
                    }}
                  >
                    {member.role ?? 'Member'}
                  </Typography>
                </View>
              ))
            ) : (
              <Typography variant="small">No members are saved on this device yet.</Typography>
            )}
          </GroupPanel>
          <GroupPanel>
            <Typography variant="heading">Recent group expenses</Typography>
            <Typography variant="caption">
              Loaded expenses · {p.activities.length} records. This list is not an all-time total.
            </Typography>
            {p.activities.length ? (
              p.activities.map((activity) => (
                <Pressable
                  key={activity.id}
                  accessibilityRole="button"
                  onPress={() => p.onOpenActivity(activity.id)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderColor: tokens.borderSubtle,
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'center',
                  })}
                >
                  <GroupTile
                    icon={activity.icon ?? 'phosphor:Receipt'}
                    color={activity.color ?? tokens.warning}
                    size={36}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Typography variant="label">{activity.title}</Typography>
                    <Typography variant="caption">
                      {activity.category ?? 'Category unavailable'} ·{' '}
                      {activity.account ?? 'Account unavailable'}
                    </Typography>
                    <Typography variant="caption">{activity.date}</Typography>
                  </View>
                  <Money
                    amountMinor={activity.amountMinor}
                    currency={activity.currency}
                    size="body"
                  />
                </Pressable>
              ))
            ) : (
              <FinanceEmptyState
                kind="activity"
                title="Your group history starts with an expense."
                description="Add a shared expense to keep the group ledger up to date."
                compact
                action={
                  <Button variant="outline" onPress={p.onAddExpense}>
                    Add expense
                  </Button>
                }
              />
            )}
          </GroupPanel>
          <GroupPanel>
            <Typography variant="heading">Balances & settlements</Typography>
            {ready ? (
              <>
                <Typography variant="caption">Your net balance · {p.balanceMeaning}</Typography>
                <Money amountMinor={p.balanceMinor} currency={p.balanceCurrency} size="body" />
                {p.memberBalances?.length ? (
                  p.memberBalances.map((member) => (
                    <View
                      key={member.id}
                      style={{
                        flexDirection: 'row',
                        gap: 10,
                        alignItems: 'center',
                        paddingVertical: 7,
                      }}
                    >
                      <GroupAvatar
                        name={member.name}
                        avatarUrl={p.members.find((person) => person.id === member.id)?.avatarUrl}
                        avatarId={p.members.find((person) => person.id === member.id)?.avatarId}
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Typography variant="label">{member.name}</Typography>
                        <Typography variant="caption">{member.meaning}</Typography>
                      </View>
                      <Typography variant="label">{member.amount}</Typography>
                    </View>
                  ))
                ) : (
                  <Typography variant="caption">
                    Open balances to view available member balances.
                  </Typography>
                )}
                <Button variant="outline" onPress={p.onOpenBalances}>
                  View member balances
                </Button>
                {p.canSettle && <Button onPress={p.onSettle}>Record a settlement</Button>}
              </>
            ) : (
              <Typography variant="small">
                Member balances need a complete ledger. No partial balances are displayed.
              </Typography>
            )}
            <Typography variant="label">Recent recorded settlements</Typography>
            {p.settlementsError ? (
              <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
                {p.settlementsError}
              </Typography>
            ) : p.settlementsLoading ? (
              <Typography variant="small">Loading settlements…</Typography>
            ) : p.settlements.length ? (
              p.settlements.map((settlement) => (
                <View key={settlement.id} style={{ paddingVertical: 8, gap: 4 }}>
                  <Typography variant="label">{settlement.description}</Typography>
                  <Money
                    amountMinor={settlement.amountMinor}
                    currency={settlement.currency}
                    size="body"
                  />
                  {settlement.date && <Typography variant="caption">{settlement.date}</Typography>}
                </View>
              ))
            ) : (
              <FinanceEmptyState
                kind="activity"
                title="No settlements recorded yet."
                description="Settlements you record for this group will appear here."
                compact
              />
            )}
          </GroupPanel>
          <GroupPanel>
            <Typography variant="heading">Split insights</Typography>
            <Typography variant="caption">
              By category · loaded expenses only, separated by currency.
            </Typography>
            {insights.length ? (
              insights.map((insight) => (
                <View
                  key={`${insight.currency}:${insight.category}`}
                  style={{ gap: 7, paddingVertical: 5 }}
                >
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <GroupTile
                      icon={insight.icon ?? 'phosphor:ChartPie'}
                      color={insight.color ?? tokens.split}
                      size={28}
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
              ))
            ) : (
              <Typography variant="small">
                Category insights appear when expenses are available.
              </Typography>
            )}
            <Button variant="outline" onPress={p.onOpenAnalytics}>
              View group analytics
            </Button>
          </GroupPanel>
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
