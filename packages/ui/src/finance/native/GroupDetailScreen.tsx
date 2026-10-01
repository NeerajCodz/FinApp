import React from 'react';
import { ScrollView, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { ArrowLeft, ChartLineUp, Gear, Plus, UsersThree } from '@finapp/ui/icons/native';
import {
  Button,
  Empty,
  IconButton,
  SectionHeader,
  Separator,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntityIcon } from './EntityIconPicker';
import { GroupChatScreen, type GroupChatScreenProps } from './GroupChatScreen';
import { Money } from './Money';
import { TransactionRow } from './TransactionRow';

export type GroupDetailMember = {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
};
export type GroupDetailActivity = {
  id: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  date: string;
};
export type GroupDetailSettlement = {
  id: string;
  description: string;
  amountMinor: bigint;
  currency: string;
  date?: string;
};
export type GroupDetailScreenProps = {
  group?: { name: string; currency: string; icon?: string; color?: string };
  loading: boolean;
  balanceStatus: 'loading' | 'unavailable' | 'ready';
  balanceMinor: bigint;
  balanceCurrency: string;
  balanceMeaning: string;
  balanceError?: string;
  canSettle: boolean;
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

export function GroupDetailScreen({
  group,
  balanceStatus,
  balanceMinor,
  balanceCurrency,
  balanceMeaning,
  balanceError,
  canSettle,
  members,
  activities,
  settlements,
  settlementsLoading,
  settlementsError,
  loading,
  chat,
  onBack,
  onOpenChat,
  onOpenAnalytics,
  onOpenSettings,
  onOpenBalances,
  onSettle,
  onAddExpense,
  onOpenActivity,
  onRetry,
}: GroupDetailScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 24,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back to groups" variant="ghost" onPress={onBack}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <EntityIcon
          value={group?.icon ?? 'phosphor:UsersThree'}
          size={23}
          color={group?.color ?? tokens.primary}
        />
        <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {group?.name ?? 'Group'}
        </Typography>
        <IconButton label="Open group chat" variant="ghost" onPress={onOpenChat}>
          <MessageCircle size={20} color={tokens.foreground} />
        </IconButton>
        <IconButton label="Group analytics" variant="ghost" onPress={onOpenAnalytics}>
          <ChartLineUp size={20} color={tokens.foreground} />
        </IconButton>
        <IconButton label="Edit group" variant="ghost" onPress={onOpenSettings}>
          <Gear size={20} color={tokens.foreground} />
        </IconButton>
      </View>
      {loading ? (
        <Typography variant="small">Loading group details…</Typography>
      ) : !group ? (
        <Empty
          title="Group unavailable"
          description="This group is not saved on this device."
          action={
            <Button variant="outline" onPress={onRetry}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <View
            style={{
              padding: 20,
              gap: 9,
              borderRadius: 22,
              backgroundColor: tokens.surfaceSubtle,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <Typography variant="label">Your balance</Typography>
            {balanceError ? (
              <View style={{ gap: 10 }} accessibilityRole="alert">
                <Typography variant="small">
                  Complete group balances are unavailable. No partial value is shown. {balanceError}
                </Typography>
                <Button onPress={onRetry}>Retry</Button>
              </View>
            ) : balanceStatus === 'loading' ? (
              <Typography variant="small">Loading all-time balance…</Typography>
            ) : balanceStatus === 'unavailable' ? (
              <Typography variant="small">
                Complete group balances are unavailable. No partial value is shown.
              </Typography>
            ) : (
              <>
                <Money amountMinor={balanceMinor} currency={balanceCurrency} size="display" />
                <Typography variant="caption">{balanceMeaning}</Typography>
                <Button variant="outline" onPress={onOpenBalances}>
                  View member balances
                </Button>
                {canSettle && (
                  <Button variant="outline" onPress={onSettle}>
                    Record a settlement
                  </Button>
                )}
              </>
            )}
          </View>
          <Button size="lg" onPress={onAddExpense}>
            <Plus size={18} color={tokens.primaryForeground} />
            <Typography variant="bodyLarge" style={{ marginLeft: 8 }}>
              Add expense
            </Typography>
          </Button>
          <GroupChatScreen {...chat} />
          <View style={{ gap: 12 }}>
            <SectionHeader title="People" />
            {members.length ? (
              members.map((member) => (
                <View
                  key={member.id}
                  style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: tokens.surfaceRaised,
                    }}
                  >
                    <Typography variant="bodyLarge">
                      {member.name
                        .split(/\s+/)
                        .map((part) => part[0] ?? '')
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Typography>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodyLarge">{member.name}</Typography>
                    <Typography variant="caption">
                      {member.username ? `@${member.username.replace(/^@+/, '')}` : 'Group member'}
                    </Typography>
                  </View>
                </View>
              ))
            ) : (
              <Empty
                title="No members saved"
                description="Members invited to this group will appear here."
                icon={<UsersThree size={26} color={tokens.foregroundMuted} />}
              />
            )}
          </View>
          <Separator />
          <View style={{ gap: 12 }}>
            <SectionHeader title="Recent" />
            {activities.length ? (
              activities.map((activity) => (
                <TransactionRow
                  key={activity.id}
                  title={activity.title}
                  category="Group expense"
                  account={group.name}
                  amountMinor={activity.amountMinor}
                  currency={activity.currency}
                  type="expense"
                  semanticType="split"
                  date={activity.date}
                  onPress={() => onOpenActivity(activity.id)}
                />
              ))
            ) : (
              <Empty
                title="No shared expenses"
                description="Add an expense to start your group history."
                action={
                  <Button variant="outline" onPress={onAddExpense}>
                    Add expense
                  </Button>
                }
              />
            )}
          </View>
          <Separator />
          <View style={{ gap: 12 }}>
            <SectionHeader title="Recent settlements" />
            {settlementsError ? (
              <Typography variant="small" accessibilityRole="alert">
                {settlementsError}
              </Typography>
            ) : settlementsLoading ? (
              <Typography variant="small">Loading settlements…</Typography>
            ) : settlements.length ? (
              settlements.map((settlement) => (
                <View
                  key={settlement.id}
                  style={{
                    gap: 8,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                >
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
              <Typography variant="small">No settlements recorded for this group yet.</Typography>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
