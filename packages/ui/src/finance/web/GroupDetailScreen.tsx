'use client';
import React from 'react';
import { Button, ListSkeleton, StatTile } from '@finapp/ui/web';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChartBar,
  ChatCircle,
  Gear,
  Plus,
  Wallet,
} from '@phosphor-icons/react';
import { formatMinor } from '@convex/shared/money';
import { simplifyDebts } from '@convex/splits/domain';
import type { GroupChatScreenProps } from './GroupChatScreen';
import { GroupPage, Crumb, Tile, PersonAvatar, s } from './GroupUI';
import { chartPalette } from '../../tokens';
import type { BalanceMap, TimelineJoin } from '../groupSettle';
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
  settleStyles,
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
  group: { name: string; currency: string; icon?: string; color?: string };
  canSettle: boolean;
  balanceStatus: 'loading' | 'unavailable' | 'ready';
  balanceMinor: bigint;
  balanceMeaning: string;
  balanceError?: string;
  /** Every member's net balance (positive: owed to them). */
  balances?: BalanceMap;
  meId?: string | null;
  members: readonly GroupDetailMember[];
  formerMembers?: readonly GroupDetailFormerMember[];
  joins?: readonly TimelineJoin[];
  lateJoiners?: readonly { userId: string; name: string; missedCount: number }[];
  onIncludeLateJoiner?: (userId: string) => void;
  onDismissLateJoiner?: (userId: string) => void;
  activities: readonly GroupDetailActivity[];
  activitiesLoading?: boolean;
  settlements: readonly GroupDetailSettlement[];
  chat: GroupChatScreenProps;
  totalSpend?: string;
  owed?: string;
  owing?: string;
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
  onOpenPerson: (username: string) => void;
  onOpenActivity: (id: string) => void;
  onRetry?: () => void;
};
const colors = [
  chartPalette.volt,
  chartPalette.yellow,
  chartPalette.blue,
  chartPalette.violet,
  chartPalette.pink,
];
export function GroupDetailScreen(p: GroupDetailScreenProps) {
  const ready = p.balanceStatus === 'ready' && !p.balanceError;
  const pending = p.balanceStatus === 'loading' ? 'Loading…' : '—';
  const currency = p.group.currency;
  const people: SettlePerson[] = [
    ...p.members.map((member) => ({
      id: member.id,
      name: member.name,
      avatarUrl: member.avatarUrl,
      avatarId: member.avatarId,
    })),
    ...(p.formerMembers ?? []).filter(
      (former) => !p.members.some((member) => member.id === former.id),
    ),
  ];
  const transfers = p.balances ? simplifyDebts(p.balances) : [];
  const allSettled =
    ready && !!p.balances && Object.values(p.balances).every((value) => value === 0n);
  const categoryTotals = new Map<string, bigint>();
  for (const activity of p.activities) {
    const category = activity.category ?? 'Shared expenses';
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0n) + activity.amountMinor);
  }
  const categories = [...categoryTotals.entries()];
  const shownTotal = categories.reduce((sum, [, amount]) => sum + amount, 0n);
  let angle = 0;
  const stops = categories.map(([, amount], index) => {
    const start = angle;
    angle += shownTotal > 0n ? Number((amount * 10000n) / shownTotal) / 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${angle}%`;
  });
  const messages = p.chat.items.filter((item) => item.kind === 'message').slice(-4);
  return (
    <GroupPage>
      <Crumb onBack={p.onBack} current={p.group.name} />
      <header className={settleStyles.heading}>
        <Tile icon={p.group.icon} color={p.group.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{p.group.name}</h1>
          <p className={settleStyles.muted}>
            {p.members.length} member{p.members.length === 1 ? '' : 's'} · {currency}
          </p>
        </div>
        <div className={settleStyles.actions}>
          <Button variant="outline" size="sm" onPress={p.onOpenChat}>
            <ChatCircle size={16} /> Chat
          </Button>
          <Button variant="outline" size="sm" onPress={p.onOpenSettings}>
            <Gear size={16} /> Settings
          </Button>
        </div>
      </header>
      <div className={settleStyles.grid}>
        <div className={settleStyles.stack}>
          {ready ? (
            <NetPositionHero
              balanceMinor={p.balanceMinor}
              currency={currency}
              title={p.balanceMeaning}
              people={p.members}
            >
              {p.canSettle ? <Button onPress={p.onSettle}>Settle up</Button> : null}
              <Button variant={p.canSettle ? 'outline' : 'primary'} onPress={p.onAddExpense}>
                <Plus size={16} /> Add expense
              </Button>
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
                    p.onRetry ? (
                      <Button variant="outline" onPress={p.onRetry}>
                        Retry
                      </Button>
                    ) : undefined
                  }
                />
              )}
              <div className={settleStyles.actions}>
                <Button variant="outline" onPress={p.onAddExpense}>
                  <Plus size={16} /> Add expense
                </Button>
              </div>
            </SettleCard>
          )}
          <section className={settleStyles.stats}>
            <StatTile
              label="Total spend"
              value={ready ? (p.totalSpend ?? '—') : pending}
              icon={<Wallet size={16} />}
              tone="accent"
            />
            <StatTile
              label="You owe"
              value={ready ? (p.owing ?? '—') : pending}
              icon={<ArrowUpRight size={16} />}
              tone="expense"
            />
            <StatTile
              label="Owed to you"
              value={ready ? (p.owed ?? '—') : pending}
              icon={<ArrowDownLeft size={16} />}
              tone="income"
            />
          </section>
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
              title="Recent expenses"
              action={
                p.onOpenExpenses ? (
                  <Button size="sm" variant="ghost" onPress={p.onOpenExpenses}>
                    See all →
                  </Button>
                ) : undefined
              }
            />
            {p.activitiesLoading ? (
              <ListSkeleton rows={4} />
            ) : p.activities.length ? (
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
        </div>
        <aside className={settleStyles.stack}>
          <SettleCard>
            <SectionTitle
              level={3}
              title="Balances"
              action={
                <Button size="sm" variant="ghost" onPress={p.onOpenBalances}>
                  View all →
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
                  currency={currency}
                  people={people}
                  meId={p.meId}
                  onPressMember={p.onSettleWith}
                />
                {transfers.length > 0 && (
                  <>
                    <strong style={{ fontSize: 13 }}>Suggested transfers</strong>
                    <SuggestedTransfers
                      transfers={transfers}
                      currency={currency}
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
                  </>
                )}
              </>
            ) : null}
          </SettleCard>
          <SettleCard>
            <SectionTitle level={3} title="Recent settlements" />
            {p.settlements.length ? (
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
                description="Payments between group members will appear here."
              />
            )}
          </SettleCard>
          {shownTotal > 0n && (
            <SettleCard>
              <SectionTitle
                level={3}
                title="Where it goes"
                caption="By category · recent expenses"
                action={
                  <Button size="sm" variant="ghost" onPress={p.onOpenAnalytics}>
                    <ChartBar size={16} />
                  </Button>
                }
              />
              <div className={s.donutLayout}>
                <div
                  className={s.donut}
                  style={{ background: `conic-gradient(${stops.join(',')})` }}
                >
                  <span>
                    {formatMinor(shownTotal, currency)}
                    <br />
                    <small className={s.muted}>Shown spend</small>
                  </span>
                </div>
                <div className={s.legend}>
                  {categories.map(([name, amount], index) => (
                    <div key={name} className={s.legendRow}>
                      <span
                        className={s.dot}
                        style={{ background: colors[index % colors.length] }}
                      />
                      <span>{name}</span>
                      <strong>{formatMinor(amount, currency)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </SettleCard>
          )}
          <SettleCard>
            <SectionTitle
              level={3}
              title="Recent messages"
              action={
                <Button variant="ghost" size="sm" onPress={p.onOpenChat}>
                  Open chat →
                </Button>
              }
            />
            {messages.map((item) => (
              <div className={s.activity} key={item.id}>
                <PersonAvatar
                  name={item.ownMessage ? 'You' : (item.sender ?? 'Member')}
                  url={item.senderAvatarUrl}
                  avatarId={item.senderAvatarId}
                  size={28}
                />
                <div className={s.activityCopy}>
                  <strong>{item.sender ?? 'You'}</strong>
                  <small>
                    {item.text ??
                      (item.attachmentUrl
                        ? 'Shared a bill image'
                        : 'Bill image no longer available')}
                  </small>
                </div>
                <small className={s.muted}>{item.date}</small>
              </div>
            ))}
            {!messages.length &&
              (p.chat.loading ? (
                <ListSkeleton rows={2} />
              ) : p.chat.error ? (
                <p className={settleStyles.muted} role="alert">
                  {p.chat.error}
                </p>
              ) : (
                <IllustratedState
                  scene={p.chat.canSend ? 'group' : 'offline'}
                  title={p.chat.canSend ? 'No messages yet' : 'Chat is offline'}
                  description={
                    p.chat.canSend
                      ? 'Start the conversation with your group.'
                      : 'Connect and sync the group to load messages.'
                  }
                />
              ))}
          </SettleCard>
          {p.members.some((member) => member.username) && (
            <SettleCard>
              <SectionTitle level={3} title="People" />
              <div className={settleStyles.chips}>
                {p.members
                  .filter((member) => member.username)
                  .map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className={settleStyles.chip}
                      onClick={() => p.onOpenPerson(member.username!)}
                    >
                      <PersonAvatar
                        name={member.name}
                        url={member.avatarUrl}
                        avatarId={member.avatarId}
                        size={26}
                      />
                      {member.name}
                    </button>
                  ))}
              </div>
            </SettleCard>
          )}
        </aside>
      </div>
    </GroupPage>
  );
}
