import React from 'react';
import { Pressable, View } from 'react-native';
import {
  AlertDialog,
  AvatarStack,
  Button,
  CountUp,
  FadeIn,
  HeroCard,
  IconTile,
  PressableScale,
  Sheet,
  StatusPill,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import {
  ArrowRight,
  Check,
  ClockCounterClockwise,
  ReceiptText,
  UsersThree,
} from '@finapp/ui/icons/native';
import { Illustration } from '../../illustrations/native';
import { layoutTokens, space, withAlpha } from '../../tokens';
import { formatMinor } from '../money';
import {
  balanceBarRatios,
  buildExpenseTimeline,
  dayLabel,
  shortDate,
  type BalanceMap,
  type IncludableExpense,
  type OutstandingBalance,
  type SettleTransfer,
  type TimelineJoin,
} from '../groupSettle';
import { EntityIcon } from './EntityIconPicker';
import { GroupAvatar } from './GroupPrimitives';

export type SettlePerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarId?: string;
  /** Set for members who left or were removed. */
  leftAt?: number;
};

const nameOf = (people: readonly SettlePerson[], id: string) =>
  people.find((person) => person.id === id)?.name ?? `Member ${id.slice(-6)}`;
const personOf = (people: readonly SettlePerson[], id: string): SettlePerson =>
  people.find((person) => person.id === id) ?? { id, name: nameOf(people, id) };

/** Minor units → a number for animation; precise enough for display only. */
const animatable = (value: bigint) => Number(value);

/** Section title with an optional trailing action. */
export function SectionTitle({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="heading">{title}</Typography>
        {!!caption && (
          <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
            {caption}
          </Typography>
        )}
      </View>
      {action}
    </View>
  );
}

/** Rounded card surface used by the group screens. */
export function SettleCard({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'income' | 'expense' | 'settlement' | 'split';
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        gap: space.md,
        padding: space.lg,
        borderRadius: layoutTokens.radiusCard,
        borderWidth: 1,
        borderColor: tone ? withAlpha(tokens[tone], 0.3) : tokens.borderSubtle,
        backgroundColor: tone ? withAlpha(tokens[tone], 0.06) : tokens.card,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Your net position in a group: animated amount, tone and an illustration for owe / owed /
 * settled. Children render below (usually actions).
 */
export function NetPositionHero({
  balanceMinor,
  currency,
  title,
  people,
  children,
}: {
  balanceMinor: bigint;
  currency: string;
  title?: string;
  people?: readonly SettlePerson[];
  children?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const tone = balanceMinor > 0n ? 'income' : balanceMinor < 0n ? 'expense' : 'settlement';
  const scene = balanceMinor > 0n ? 'owedToYou' : balanceMinor < 0n ? 'youOwe' : 'allSettled';
  const magnitude = balanceMinor < 0n ? -balanceMinor : balanceMinor;
  const color = tone === 'settlement' ? tokens.settlement : tokens[tone];
  return (
    <HeroCard tone={tone}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: space.xs }}>
          {!!title && (
            <Typography variant="label" numberOfLines={1}>
              {title}
            </Typography>
          )}
          <StatusPill
            tone={tone}
            label={
              balanceMinor > 0n ? 'You are owed' : balanceMinor < 0n ? 'You owe' : 'All settled'
            }
          />
          <CountUp
            value={animatable(magnitude)}
            format={(value) => formatMinor(BigInt(Math.round(value)), currency)}
            style={{
              color,
              fontSize: 34,
              lineHeight: 40,
              fontFamily: 'SpaceGrotesk_700Bold',
              fontVariant: ['tabular-nums'],
            }}
          />
          {!!people?.length && <AvatarStack people={people} max={5} size={26} />}
        </View>
        <Illustration scene={scene} size={120} />
      </View>
      {children}
    </HeroCard>
  );
}

/** Per-member balance bars; positive balances use the income tone, negative the expense tone. */
export function MemberBalanceBars({
  balances,
  currency,
  people,
  meId,
  onPressMember,
}: {
  balances: BalanceMap;
  currency: string;
  people: readonly SettlePerson[];
  meId?: string | null;
  onPressMember?: (memberId: string) => void;
}) {
  const { tokens } = useTheme();
  const ratios = balanceBarRatios(balances);
  const myBalance = (meId ? balances[meId] : undefined) ?? 0n;
  const entries = Object.entries(balances).sort(([, left], [, right]) =>
    left === right ? 0 : left > right ? -1 : 1,
  );
  return (
    <View style={{ gap: space.md }}>
      {entries.map(([memberId, amount], index) => {
        const person = personOf(people, memberId);
        const color = amount > 0n ? tokens.income : amount < 0n ? tokens.expense : tokens.border;
        const label =
          amount > 0n ? 'gets back' : amount < 0n ? 'owes' : person.leftAt ? 'left' : 'settled';
        // Only members you can actually settle with: one owes and the other is owed.
        const pressable =
          !!onPressMember &&
          memberId !== meId &&
          ((amount < 0n && myBalance > 0n) || (amount > 0n && myBalance < 0n));
        const body = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <GroupAvatar
              name={person.name}
              avatarUrl={person.avatarUrl}
              avatarId={person.avatarId}
              size={38}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Typography variant="label" numberOfLines={1} style={{ flex: 1 }}>
                  {memberId === meId ? 'You' : person.name}
                  {person.leftAt ? ` · Left ${shortDate(person.leftAt)}` : ''}
                </Typography>
                {amount === 0n ? (
                  <StatusPill tone="settlement" label="Settled" />
                ) : (
                  <Text
                    style={{
                      color,
                      fontSize: 14,
                      fontFamily: 'SpaceGrotesk_600SemiBold',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {label} {formatMinor(amount < 0n ? -amount : amount, currency)}
                  </Text>
                )}
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  overflow: 'hidden',
                  backgroundColor: tokens.surfaceRaised,
                }}
              >
                <View
                  style={{
                    width: `${Math.max(amount === 0n ? 0 : 4, (ratios[memberId] ?? 0) * 100)}%`,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: color,
                  }}
                />
              </View>
            </View>
          </View>
        );
        return (
          <FadeIn key={memberId} index={index}>
            {pressable ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Settle with ${person.name}`}
                onPress={() => onPressMember(memberId)}
              >
                {body}
              </PressableScale>
            ) : (
              body
            )}
          </FadeIn>
        );
      })}
    </View>
  );
}

/** Suggested transfers (simplified debts) with an optional one-tap settle per row. */
export function SuggestedTransfers({
  transfers,
  currency,
  people,
  meId,
  busy,
  limit,
  onSettle,
  onRemind,
}: {
  transfers: readonly SettleTransfer[];
  currency: string;
  people: readonly SettlePerson[];
  meId?: string | null;
  busy?: boolean;
  limit?: number;
  /** Called for transfers you take part in. */
  onSettle?: (transfer: SettleTransfer) => void;
  /** Sends a payment reminder for transfers someone owes you. */
  onRemind?: (transfer: SettleTransfer) => void;
}) {
  const { tokens } = useTheme();
  const shown = limit ? transfers.slice(0, limit) : transfers;
  return (
    <View style={{ gap: space.sm }}>
      {shown.map((transfer, index) => {
        const from = personOf(people, transfer.fromUserId);
        const to = personOf(people, transfer.toUserId);
        const mine = transfer.fromUserId === meId || transfer.toUserId === meId;
        return (
          <FadeIn key={`${transfer.fromUserId}:${transfer.toUserId}`} index={index}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                padding: space.md,
                borderRadius: layoutTokens.radiusControl,
                backgroundColor: mine ? withAlpha(tokens.settlement, 0.08) : tokens.surfaceSubtle,
                borderWidth: 1,
                borderColor: mine ? withAlpha(tokens.settlement, 0.3) : tokens.borderSubtle,
              }}
            >
              <GroupAvatar
                name={from.name}
                avatarUrl={from.avatarUrl}
                avatarId={from.avatarId}
                size={30}
              />
              <ArrowRight size={16} color={tokens.foregroundMuted} />
              <GroupAvatar
                name={to.name}
                avatarUrl={to.avatarUrl}
                avatarId={to.avatarId}
                size={30}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="small" numberOfLines={1}>
                  {transfer.fromUserId === meId ? 'You' : from.name} pay
                  {transfer.fromUserId === meId ? '' : 's'}{' '}
                  {transfer.toUserId === meId ? 'you' : to.name}
                </Typography>
                <Text
                  style={{
                    color: tokens.foreground,
                    fontFamily: 'SpaceGrotesk_600SemiBold',
                    fontSize: 15,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatMinor(transfer.amountMinor, currency)}
                </Text>
              </View>
              {transfer.toUserId === meId && onRemind ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onPress={() => onRemind(transfer)}
                >
                  Remind
                </Button>
              ) : null}
              {mine && onSettle ? (
                <Button size="sm" disabled={busy} onPress={() => onSettle(transfer)}>
                  Settle
                </Button>
              ) : null}
            </View>
          </FadeIn>
        );
      })}
      {limit && transfers.length > limit ? (
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
          +{transfers.length - limit} more suggested
        </Typography>
      ) : null}
    </View>
  );
}

export type TimelineExpense = {
  id: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: number;
  category?: string;
  icon?: string;
  color?: string;
  /** e.g. "Paid by Ana · your share ₹120" */
  detail?: string;
};

/** Marker shown where members joined after earlier expenses. */
export function JoinedMarker({ members }: { members: readonly TimelineJoin[] }) {
  const { tokens } = useTheme();
  const names =
    members.length > 2
      ? `${members[0]!.name}, ${members[1]!.name} and ${members.length - 2} more`
      : members.map((member) => member.name).join(' and ');
  return (
    <View
      accessibilityRole="text"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: withAlpha(tokens.split, 0.35) }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: space.sm + 2,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: withAlpha(tokens.split, 0.12),
        }}
      >
        <UsersThree size={13} color={tokens.split} />
        <Text style={{ color: tokens.split, fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold' }}>
          {names} joined {shortDate(members[0]!.joinedAt)}
        </Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: withAlpha(tokens.split, 0.35) }} />
    </View>
  );
}

/** Expenses grouped by day with category tiles and late-joiner markers. */
export function GroupExpenseTimeline({
  expenses,
  joins = [],
  onOpen,
}: {
  expenses: readonly TimelineExpense[];
  joins?: readonly TimelineJoin[];
  onOpen?: (id: string) => void;
}) {
  const { tokens } = useTheme();
  const rows = buildExpenseTimeline(expenses, joins);
  let index = 0;
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((row) => {
        if (row.kind === 'day')
          return (
            <Typography
              key={row.key}
              variant="overline"
              style={{ color: tokens.foregroundMuted, marginTop: space.sm }}
            >
              {dayLabel(row.at)}
            </Typography>
          );
        if (row.kind === 'joined') return <JoinedMarker key={row.key} members={row.members} />;
        const expense = row.expense;
        const color = expense.color ?? tokens.split;
        index += 1;
        return (
          <FadeIn key={row.key} index={index}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${expense.title}, ${formatMinor(expense.amountMinor, expense.currency)}`}
              disabled={!onOpen}
              onPress={() => onOpen?.(expense.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.md,
                borderRadius: layoutTokens.radiusControl,
                backgroundColor: tokens.card,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
              }}
            >
              <IconTile color={color} size={42}>
                {expense.icon ? (
                  <EntityIcon value={expense.icon} size={20} color={color} />
                ) : (
                  <ReceiptText size={20} color={color} />
                )}
              </IconTile>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="label" numberOfLines={1}>
                  {expense.title}
                </Typography>
                <Typography
                  variant="caption"
                  numberOfLines={1}
                  style={{ color: tokens.foregroundMuted }}
                >
                  {expense.detail ?? expense.category ?? 'Shared expense'}
                </Typography>
              </View>
              <Text
                style={{
                  color: tokens.foreground,
                  fontFamily: 'SpaceGrotesk_600SemiBold',
                  fontSize: 15,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatMinor(expense.amountMinor, expense.currency)}
              </Text>
            </PressableScale>
          </FadeIn>
        );
      })}
    </View>
  );
}

/** Illustrated empty / all-settled state. */
export function IllustratedState({
  scene,
  title,
  description,
  action,
}: {
  scene: React.ComponentProps<typeof Illustration>['scene'];
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
      <Illustration scene={scene} size={168} />
      <Typography variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Typography>
      {!!description && (
        <Typography
          variant="small"
          style={{ textAlign: 'center', color: tokens.foregroundMuted, maxWidth: 320 }}
        >
          {description}
        </Typography>
      )}
      {action}
    </View>
  );
}

/** Admin banner: "{Name} joined after N expenses — Include in past expenses". */
export function LateJoinerBanner({
  name,
  missedCount,
  onInclude,
  onDismiss,
}: {
  name: string;
  missedCount: number;
  onInclude: () => void;
  onDismiss?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: layoutTokens.radiusCard,
        borderWidth: 1,
        borderColor: withAlpha(tokens.split, 0.35),
        backgroundColor: withAlpha(tokens.split, 0.08),
      }}
    >
      <Illustration scene="memberJoined" size={72} backdrop={false} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Typography variant="label">
          {name} joined after {missedCount} expense{missedCount === 1 ? '' : 's'}
        </Typography>
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
          They are not part of earlier expenses unless you add them.
        </Typography>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
          <Button size="sm" onPress={onInclude}>
            Include in past expenses
          </Button>
          {onDismiss ? (
            <Button size="sm" variant="ghost" onPress={onDismiss}>
              Not now
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export type { IncludableExpense };

/** Sheet to pick past expenses for a late joiner, with a per-person share preview. */
export function IncludePastExpensesSheet({
  visible,
  memberName,
  expenses,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  memberName: string;
  expenses: readonly IncludableExpense[];
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (expenseIds: string[]) => void;
}) {
  const { tokens } = useTheme();
  const selectable = expenses.filter((expense) => expense.preview.eligible && expense.editable);
  const [selected, setSelected] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (visible) setSelected(selectable.map((expense) => expense.id));
    // Reset the selection each time the sheet opens.
  }, [visible]);
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  return (
    <Sheet visible={visible} onClose={onClose} title={`Include ${memberName}`}>
      <View style={{ gap: space.md }}>
        <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
          Choose past expenses to split with {memberName}. Everyone’s share is recomputed.
        </Typography>
        {expenses.map((expense) => {
          const disabled = !expense.preview.eligible || !expense.editable;
          const checked = selected.includes(expense.id);
          const note = !expense.editable
            ? 'Only admins or the creator can change this'
            : expense.preview.eligible
              ? `Share ${formatMinor(expense.preview.beforeMinor, expense.currency)} → ${formatMinor(expense.preview.afterMinor, expense.currency)} · ${expense.preview.participantCount} people`
              : expense.preview.reason === 'manual'
                ? 'Exact or percentage split, edit manually'
                : 'Already included';
          return (
            <Pressable
              key={expense.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled }}
              disabled={disabled || busy}
              onPress={() => toggle(expense.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.md,
                borderRadius: layoutTokens.radiusControl,
                borderWidth: 1,
                borderColor: checked ? tokens.split : tokens.borderSubtle,
                backgroundColor: checked ? withAlpha(tokens.split, 0.08) : tokens.card,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <IconTile tone={checked ? 'split' : 'neutral'} size={34} solid={checked}>
                {checked ? (
                  <Check size={16} color={tokens.primaryForeground} />
                ) : (
                  <ReceiptText size={16} color={tokens.foregroundMuted} />
                )}
              </IconTile>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="label" numberOfLines={1}>
                  {expense.title} · {formatMinor(expense.amountMinor, expense.currency)}
                </Typography>
                <Typography
                  variant="caption"
                  style={{ color: disabled ? tokens.warning : tokens.foregroundMuted }}
                >
                  {dayLabel(expense.occurredAt)} · {note}
                </Typography>
              </View>
            </Pressable>
          );
        })}
        {!!error && (
          <Typography
            accessibilityRole="alert"
            variant="small"
            style={{ color: tokens.destructive }}
          >
            {error}
          </Typography>
        )}
        <Button disabled={busy || !selected.length} onPress={() => onConfirm(selected)}>
          {busy
            ? 'Updating…'
            : `Include in ${selected.length} expense${selected.length === 1 ? '' : 's'}`}
        </Button>
      </View>
    </Sheet>
  );
}

/**
 * Explains an open balance that blocks leaving or removal, with a "Settle first" action.
 */
export function OutstandingBalanceDialog({
  visible,
  memberName,
  self,
  balance,
  onClose,
  onSettleFirst,
}: {
  visible: boolean;
  memberName: string;
  /** True when you are the one leaving. */
  self: boolean;
  balance: OutstandingBalance | null;
  onClose: () => void;
  onSettleFirst: () => void;
}) {
  const { tokens } = useTheme();
  const amount = balance
    ? formatMinor(
        balance.balanceMinor < 0n ? -balance.balanceMinor : balance.balanceMinor,
        balance.currency,
      )
    : '';
  const owes = (balance?.balanceMinor ?? 0n) < 0n;
  return (
    <AlertDialog
      visible={visible}
      onClose={onClose}
      title={self ? 'Settle up before leaving' : `${memberName} has an open balance`}
      confirmLabel="Settle first"
      cancelLabel="Not now"
      onConfirm={onSettleFirst}
    >
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Illustration scene={owes ? 'youOwe' : 'owedToYou'} size={140} />
        <Typography variant="small" style={{ textAlign: 'center', color: tokens.foregroundMuted }}>
          {self
            ? owes
              ? `You still owe ${amount} in this group.`
              : `You are still owed ${amount} in this group.`
            : owes
              ? `${memberName} still owes ${amount}.`
              : `${memberName} is still owed ${amount}.`}{' '}
          Members can only leave once their balance is zero, so nobody loses track of money.
        </Typography>
      </View>
    </AlertDialog>
  );
}

/** Success state after recording payments. */
export function SettleSuccess({
  title,
  description,
  onDone,
  onAnother,
}: {
  title: string;
  description: string;
  onDone: () => void;
  onAnother?: () => void;
}) {
  return (
    <FadeIn>
      <SettleCard tone="settlement">
        <IllustratedState
          scene="success"
          title={title}
          description={description}
          action={
            <View style={{ width: '100%', gap: space.sm, marginTop: space.sm }}>
              <Button onPress={onDone}>Back to group</Button>
              {onAnother ? (
                <Button variant="outline" onPress={onAnother}>
                  Record another payment
                </Button>
              ) : null}
            </View>
          }
        />
      </SettleCard>
    </FadeIn>
  );
}

/** Small "history" tile used for settlement rows. */
export function SettlementHistoryRow({
  description,
  amountMinor,
  currency,
  date,
  note,
}: {
  description: string;
  amountMinor: bigint;
  currency: string;
  date?: string;
  note?: string;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <IconTile tone="settlement" size={38}>
        <ClockCounterClockwise size={18} color={tokens.settlement} />
      </IconTile>
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="label" numberOfLines={1}>
          {description}
        </Typography>
        <Typography variant="caption" numberOfLines={1} style={{ color: tokens.foregroundMuted }}>
          {[date, note ? `“${note}”` : undefined].filter(Boolean).join(' · ')}
        </Typography>
      </View>
      <Text
        style={{
          color: tokens.settlement,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 15,
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatMinor(amountMinor, currency)}
      </Text>
    </View>
  );
}
