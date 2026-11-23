import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  IconButton,
  IconTile,
  ListSkeleton,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { ArrowLeft, Check, Wallet } from '@finapp/ui/icons/native';
import { layoutTokens, space, withAlpha } from '../../tokens';
import { formatMinor } from '../money';
import {
  settleAllMine,
  settleUpPlan,
  transferWith,
  type BalanceMap,
  type SettleTransfer,
} from '../groupSettle';
import { GroupAvatar, GroupTile } from './GroupPrimitives';
import {
  IllustratedState,
  NetPositionHero,
  SectionTitle,
  SettleCard,
  SettleSuccess,
  SuggestedTransfers,
  type SettlePerson,
} from './GroupSettleParts';
import { SettlementEditor } from './SettlementEditor';

export type SettleUpHubProps = {
  groups: readonly { id: string; name: string; currency: string; icon?: string; color?: string }[];
  selectedGroupId?: string;
  onSelectGroup: (id: string) => void;
  accounts: readonly { id: string; name: string }[];
  selectedAccountId?: string;
  onSelectAccount: (id: string) => void;
  status: 'loading' | 'ready' | 'unavailable' | 'no-group';
  statusMessage?: string;
  onRetry?: () => void;
  meId: string | null;
  currency: string;
  balances: BalanceMap;
  people: readonly SettlePerson[];
  /** Member to pre-select, e.g. from a "Settle first" deep link. */
  initialMemberId?: string;
  /** Why recording is blocked right now (e.g. no matching account). */
  blockedReason?: string;
  saving: boolean;
  error?: string;
  onRecord: (transfers: SettleTransfer[], note?: string) => void;
  success?: { title: string; description: string } | null;
  onDone: () => void;
  onAnother: () => void;
  onBack: () => void;
};

export function SettleUpHub(p: SettleUpHubProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const plan = p.meId ? settleUpPlan(p.balances, p.meId) : null;
  const [chosenMemberId, setChosenMemberId] = React.useState<string | undefined>(p.initialMemberId);
  React.useEffect(() => setChosenMemberId(p.initialMemberId), [p.initialMemberId]);
  const selected =
    plan?.counterparts.find((item) => item.userId === chosenMemberId) ??
    (plan?.counterparts.length === 1 ? plan.counterparts[0] : undefined);
  const nameOf = (id: string) =>
    p.people.find((person) => person.id === id)?.name ?? `Member ${id.slice(-6)}`;
  const selectedGroup = p.groups.find((group) => group.id === p.selectedGroupId);
  const allMine = p.meId ? settleAllMine(p.balances, p.meId) : [];
  const blocked = !!p.blockedReason || p.saving;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: layoutTokens.screenX,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: space.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={p.onBack}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Settle up</Typography>
      </View>
      {p.success ? (
        <SettleSuccess
          title={p.success.title}
          description={p.success.description}
          onDone={p.onDone}
          onAnother={p.onAnother}
        />
      ) : (
        <>
          {p.groups.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm }}
            >
              {p.groups.map((group) => {
                const active = group.id === p.selectedGroupId;
                return (
                  <Pressable
                    key={group.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Select ${group.name}`}
                    onPress={() => {
                      setChosenMemberId(undefined);
                      p.onSelectGroup(group.id);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      paddingVertical: space.sm,
                      paddingLeft: space.sm,
                      paddingRight: space.md,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? tokens.settlement : tokens.borderSubtle,
                      backgroundColor: active ? withAlpha(tokens.settlement, 0.1) : tokens.card,
                    }}
                  >
                    <GroupTile icon={group.icon} color={group.color} size={28} />
                    <Typography variant="label">{group.name}</Typography>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {p.status === 'no-group' ? (
            <IllustratedState
              scene="group"
              title={p.groups.length ? 'Pick a group' : 'No groups yet'}
              description={
                p.statusMessage ??
                (p.groups.length
                  ? 'Choose the group you want to settle up in.'
                  : 'Create or join a group to split and settle expenses.')
              }
            />
          ) : p.status === 'loading' ? (
            <SettleCard>
              <ListSkeleton rows={3} />
            </SettleCard>
          ) : p.status === 'unavailable' || !plan ? (
            <IllustratedState
              scene="offline"
              title="Balances unavailable"
              description={
                p.statusMessage ??
                'The full group ledger could not be loaded, so no partial balance is shown.'
              }
              action={
                p.onRetry ? (
                  <Button variant="outline" onPress={p.onRetry}>
                    Retry
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <NetPositionHero
                balanceMinor={plan.myBalanceMinor}
                currency={p.currency}
                title={selectedGroup?.name}
                people={p.people.filter((person) => !person.leftAt)}
              >
                {allMine.length > 0 && (
                  <Button
                    disabled={blocked}
                    onPress={() => p.onRecord(allMine)}
                    accessibilityLabel={
                      plan.direction === 'pay' ? 'Settle all I owe' : 'Mark all as received'
                    }
                  >
                    {plan.direction === 'pay'
                      ? `Settle all mine · ${formatMinor(plan.totalSuggestedMinor, p.currency)}`
                      : `Mark all received · ${formatMinor(plan.totalSuggestedMinor, p.currency)}`}
                  </Button>
                )}
              </NetPositionHero>
              {plan.direction === 'settled' ? (
                <IllustratedState
                  scene="allSettled"
                  title="You’re all square"
                  description={
                    plan.transfers.length
                      ? 'You have nothing to settle. Others in the group still have open balances.'
                      : 'Everyone in this group is settled up.'
                  }
                />
              ) : (
                <SettleCard tone={plan.direction === 'pay' ? 'expense' : 'income'}>
                  <SectionTitle
                    title={plan.direction === 'pay' ? 'You owe' : 'Owed to you'}
                    caption="Tap a person to record a full or partial payment."
                  />
                  {plan.counterparts.map((item) => {
                    const active = selected?.userId === item.userId;
                    const person = p.people.find((entry) => entry.id === item.userId);
                    const tone = item.direction === 'pay' ? tokens.expense : tokens.income;
                    return (
                      <Pressable
                        key={item.userId}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Settle with ${nameOf(item.userId)}`}
                        onPress={() => setChosenMemberId(item.userId)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.md,
                          padding: space.md,
                          borderRadius: layoutTokens.radiusControl,
                          borderWidth: 1,
                          borderColor: active ? tone : tokens.borderSubtle,
                          backgroundColor: active ? withAlpha(tone, 0.1) : tokens.card,
                        }}
                      >
                        <GroupAvatar
                          name={nameOf(item.userId)}
                          avatarUrl={person?.avatarUrl}
                          avatarId={person?.avatarId}
                          size={40}
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Typography variant="label" numberOfLines={1}>
                            {nameOf(item.userId)}
                          </Typography>
                          <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                            {item.suggestedMinor > 0n
                              ? `Suggested ${formatMinor(item.suggestedMinor, p.currency)}`
                              : `Up to ${formatMinor(item.maxAmountMinor, p.currency)}`}
                          </Typography>
                        </View>
                        <Text
                          style={{
                            color: tone,
                            fontFamily: 'SpaceGrotesk_600SemiBold',
                            fontSize: 15,
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {formatMinor(item.maxAmountMinor, p.currency)}
                        </Text>
                        {active ? <Check size={18} color={tone} /> : null}
                      </Pressable>
                    );
                  })}
                </SettleCard>
              )}
              {plan.transfers.length > 0 && (
                <View style={{ gap: space.md }}>
                  <SectionTitle
                    title="Suggested transfers"
                    caption="The fewest payments that settle the whole group."
                  />
                  <SuggestedTransfers
                    transfers={plan.transfers}
                    currency={p.currency}
                    people={p.people}
                    meId={p.meId}
                    busy={blocked}
                    onSettle={(transfer) => p.onRecord([transfer])}
                  />
                </View>
              )}
              {plan.direction !== 'settled' && (
                <View style={{ gap: space.sm }}>
                  <Typography variant="label">RECORD IN ACCOUNT · {p.currency}</Typography>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {p.accounts.map((account) => {
                      const active = account.id === p.selectedAccountId;
                      return (
                        <Pressable
                          key={account.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Select account ${account.name}`}
                          onPress={() => p.onSelectAccount(account.id)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: space.sm,
                            padding: space.sm,
                            paddingRight: space.md,
                            borderRadius: layoutTokens.radiusControl,
                            borderWidth: 1,
                            borderColor: active ? tokens.primary : tokens.borderSubtle,
                            backgroundColor: active ? withAlpha(tokens.primary, 0.08) : tokens.card,
                          }}
                        >
                          <IconTile tone={active ? 'accent' : 'neutral'} size={28}>
                            <Wallet
                              size={15}
                              color={active ? tokens.primary : tokens.foregroundMuted}
                            />
                          </IconTile>
                          <Typography variant="small">{account.name}</Typography>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                    For your records only. No money moves from this account.
                  </Typography>
                </View>
              )}
              {selected && p.meId && (
                <SettleCard>
                  <SettlementEditor
                    key={`${p.selectedGroupId ?? ''}:${selected.userId}`}
                    memberName={nameOf(selected.userId)}
                    currency={p.currency}
                    direction={selected.direction}
                    maxAmountMinor={selected.maxAmountMinor}
                    suggestedMinor={selected.suggestedMinor}
                    disabledReason={p.blockedReason}
                    saving={p.saving}
                    error={p.error}
                    onSave={(amountMinor, note) =>
                      p.onRecord(
                        [transferWith(p.meId!, selected.userId, selected.direction, amountMinor)],
                        note,
                      )
                    }
                  />
                </SettleCard>
              )}
              {!selected && (!!p.blockedReason || !!p.error) && (
                <Typography
                  accessibilityRole="alert"
                  variant="small"
                  style={{ color: p.error ? tokens.destructive : tokens.foregroundMuted }}
                >
                  {p.error ?? p.blockedReason}
                </Typography>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
