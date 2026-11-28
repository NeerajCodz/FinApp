'use client';

import React from 'react';
import { ArrowRight, Check, History, ReceiptText, UsersRound } from 'lucide-react';
import {
  AlertDialog,
  AvatarStack,
  Button,
  HeroCard,
  IconTile,
  Sheet,
  StatusPill,
} from '@finapp/ui/web';
import { Illustration } from '../../illustrations/web';
import type { IllustrationScene } from '../../illustrations/scenes';
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
import { PersonAvatar } from './GroupUI';
import styles from './GroupSettle.module.css';

export { styles as settleStyles };

export type SettlePerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarId?: string;
  leftAt?: number;
};

const personOf = (people: readonly SettlePerson[], id: string): SettlePerson =>
  people.find((person) => person.id === id) ?? { id, name: `Member ${id.slice(-6)}` };

/** Counts toward a value with requestAnimationFrame; instant under reduced motion. */
export function CountUp({
  value,
  format,
  duration = 600,
  className,
  tone,
}: {
  value: number;
  format: (value: number) => string;
  duration?: number;
  className?: string;
  tone?: string;
}) {
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(value);
  React.useEffect(() => {
    const start = from.current;
    const reduce =
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = start + (value - start) * eased;
      from.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);
  return (
    <span className={className} data-tone={tone} aria-label={format(value)}>
      {format(shown)}
    </span>
  );
}

export function SectionTitle({
  title,
  caption,
  action,
  level = 2,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.sectionTitle}>
      <div>
        <Heading>{title}</Heading>
        {caption ? <p className={styles.muted}>{caption}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SettleCard({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone?: 'income' | 'expense' | 'settlement';
  className?: string;
}) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(' ')} data-tone={tone}>
      {children}
    </section>
  );
}

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
  const tone = balanceMinor > 0n ? 'income' : balanceMinor < 0n ? 'expense' : 'settlement';
  const scene: IllustrationScene =
    balanceMinor > 0n ? 'owedToYou' : balanceMinor < 0n ? 'youOwe' : 'allSettled';
  const magnitude = balanceMinor < 0n ? -balanceMinor : balanceMinor;
  return (
    <HeroCard tone={tone}>
      <div className={styles.heroRow}>
        <div className={styles.heroCopy}>
          {title ? <strong>{title}</strong> : null}
          <StatusPill
            tone={tone}
            label={
              balanceMinor > 0n ? 'You are owed' : balanceMinor < 0n ? 'You owe' : 'All settled'
            }
          />
          <CountUp
            className={styles.heroAmount}
            tone={tone}
            value={Number(magnitude)}
            format={(value) => formatMinor(BigInt(Math.round(value)), currency)}
          />
          {people?.length ? <AvatarStack people={people} max={6} size={28} /> : null}
        </div>
        <Illustration scene={scene} size={150} />
      </div>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </HeroCard>
  );
}

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
  const ratios = balanceBarRatios(balances);
  const myBalance = (meId ? balances[meId] : undefined) ?? 0n;
  const entries = Object.entries(balances).sort(([, left], [, right]) =>
    left === right ? 0 : left > right ? -1 : 1,
  );
  return (
    <div className={styles.bars}>
      {entries.map(([memberId, amount]) => {
        const person = personOf(people, memberId);
        const tone = amount > 0n ? 'income' : amount < 0n ? 'expense' : undefined;
        // Only members you can actually settle with: one owes and the other is owed.
        const pressable =
          !!onPressMember &&
          memberId !== meId &&
          ((amount < 0n && myBalance > 0n) || (amount > 0n && myBalance < 0n));
        const body = (
          <>
            <PersonAvatar
              name={person.name}
              url={person.avatarUrl}
              avatarId={person.avatarId}
              size={38}
            />
            <span className={styles.barBody}>
              <span className={styles.barHead}>
                <strong>
                  {memberId === meId ? 'You' : person.name}
                  {person.leftAt ? ` · Left ${shortDate(person.leftAt)}` : ''}
                </strong>
                {amount === 0n ? (
                  <StatusPill tone="settlement" label="Settled" />
                ) : (
                  <span className={styles.amount} data-tone={tone}>
                    {amount > 0n ? 'gets back' : 'owes'}{' '}
                    {formatMinor(amount < 0n ? -amount : amount, currency)}
                  </span>
                )}
              </span>
              <span className={styles.track}>
                <span
                  className={styles.fill}
                  data-tone={tone}
                  style={{
                    display: 'block',
                    width: `${Math.max(amount === 0n ? 0 : 4, (ratios[memberId] ?? 0) * 100)}%`,
                  }}
                />
              </span>
            </span>
          </>
        );
        return pressable ? (
          <button
            key={memberId}
            type="button"
            className={styles.barRow}
            aria-label={`Settle with ${person.name}`}
            onClick={() => onPressMember(memberId)}
          >
            {body}
          </button>
        ) : (
          <div key={memberId} className={styles.barRow}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

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
  onSettle?: (transfer: SettleTransfer) => void;
  /** Sends a payment reminder for transfers someone owes you. */
  onRemind?: (transfer: SettleTransfer) => void;
}) {
  const ownTransfers = transfers.filter((t) => t.fromUserId === meId || t.toUserId === meId);
  const otherTransfers = transfers.filter((t) => t.fromUserId !== meId && t.toUserId !== meId);
  const unrelatedLimit = limit ? Math.max(0, limit - ownTransfers.length) : otherTransfers.length;
  const shown = [...ownTransfers, ...otherTransfers.slice(0, unrelatedLimit)];
  const hiddenCount = otherTransfers.length - Math.min(otherTransfers.length, unrelatedLimit);
  return (
    <div className={styles.timeline}>
      {shown.map((transfer) => {
        const from = personOf(people, transfer.fromUserId);
        const to = personOf(people, transfer.toUserId);
        const mine = transfer.fromUserId === meId || transfer.toUserId === meId;
        return (
          <div
            key={`${transfer.fromUserId}:${transfer.toUserId}`}
            className={styles.transfer}
            data-mine={mine || undefined}
          >
            <PersonAvatar
              name={from.name}
              url={from.avatarUrl}
              avatarId={from.avatarId}
              size={30}
            />
            <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />
            <PersonAvatar name={to.name} url={to.avatarUrl} avatarId={to.avatarId} size={30} />
            <span className={styles.transferCopy}>
              <span>
                {transfer.fromUserId === meId ? 'You pay' : `${from.name} pays`}{' '}
                {transfer.toUserId === meId ? 'you' : to.name}
              </span>
              <strong className={styles.amount}>
                {formatMinor(transfer.amountMinor, currency)}
              </strong>
            </span>
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
          </div>
        );
      })}
      {hiddenCount > 0 ? <p className={styles.muted}>+{hiddenCount} more suggested</p> : null}
    </div>
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
  detail?: string;
};

export function JoinedMarker({ members }: { members: readonly TimelineJoin[] }) {
  const names =
    members.length > 2
      ? `${members[0]!.name}, ${members[1]!.name} and ${members.length - 2} more`
      : members.map((member) => member.name).join(' and ');
  return (
    <div className={styles.joined} role="note">
      <span>
        <UsersRound size={13} aria-hidden="true" />
        {names} joined {shortDate(members[0]!.joinedAt)}
      </span>
    </div>
  );
}

export function GroupExpenseTimeline({
  expenses,
  joins = [],
  onOpen,
}: {
  expenses: readonly TimelineExpense[];
  joins?: readonly TimelineJoin[];
  onOpen?: (id: string) => void;
}) {
  const rows = buildExpenseTimeline(expenses, joins);
  let index = 0;
  return (
    <div className={styles.timeline}>
      {rows.map((row) => {
        if (row.kind === 'day')
          return (
            <h4 key={row.key} className={styles.day}>
              {dayLabel(row.at)}
            </h4>
          );
        if (row.kind === 'joined') return <JoinedMarker key={row.key} members={row.members} />;
        const expense = row.expense;
        index += 1;
        return (
          <button
            key={row.key}
            type="button"
            className={styles.expense}
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            onClick={() => onOpen?.(expense.id)}
          >
            <IconTile color={expense.color} tone="split" size={42}>
              {expense.icon ? (
                <EntityIcon value={expense.icon} size={20} color={expense.color} />
              ) : (
                <ReceiptText size={20} />
              )}
            </IconTile>
            <span className={styles.choiceCopy}>
              <strong>{expense.title}</strong>
              <small>{expense.detail ?? expense.category ?? 'Shared expense'}</small>
            </span>
            <strong className={styles.amount}>
              {formatMinor(expense.amountMinor, expense.currency)}
            </strong>
          </button>
        );
      })}
    </div>
  );
}

export function IllustratedState({
  scene,
  title,
  description,
  action,
}: {
  scene: IllustrationScene;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.state}>
      <Illustration scene={scene} size={176} />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className={styles.stateActions}>{action}</div> : null}
    </div>
  );
}

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
  return (
    <div className={styles.banner}>
      <Illustration scene="memberJoined" size={84} backdrop={false} />
      <div className={styles.bannerCopy}>
        <strong>
          {name} joined after {missedCount} expense{missedCount === 1 ? '' : 's'}
        </strong>
        <p className={styles.muted}>They are not part of earlier expenses unless you add them.</p>
        <div className={styles.actions}>
          <Button size="sm" onPress={onInclude}>
            Include in past expenses
          </Button>
          {onDismiss ? (
            <Button size="sm" variant="ghost" onPress={onDismiss}>
              Not now
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export type { IncludableExpense };

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
      <div style={{ display: 'grid', gap: 12 }}>
        <p className={styles.muted}>
          Choose past expenses to split with {memberName}. Everyone’s share is recomputed.
        </p>
        <div className={styles.sheetList}>
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
              <button
                key={expense.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                className={styles.choice}
                data-active={checked || undefined}
                data-tone="split"
                disabled={disabled || busy}
                onClick={() => toggle(expense.id)}
              >
                <IconTile tone={checked ? 'split' : 'neutral'} size={34} solid={checked}>
                  {checked ? <Check size={16} /> : <ReceiptText size={16} />}
                </IconTile>
                <span className={styles.choiceCopy}>
                  <strong>
                    {expense.title} · {formatMinor(expense.amountMinor, expense.currency)}
                  </strong>
                  <small data-warn={disabled || undefined}>
                    {dayLabel(expense.occurredAt)} · {note}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
        {error ? (
          <p className={styles.notice} data-tone="error" role="alert">
            {error}
          </p>
        ) : null}
        <Button disabled={busy || !selected.length} onPress={() => onConfirm(selected)}>
          {busy
            ? 'Updating…'
            : `Include in ${selected.length} expense${selected.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </Sheet>
  );
}

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
  self: boolean;
  balance: OutstandingBalance | null;
  onClose: () => void;
  /** Omitted when you can't record that settlement yourself (it isn't with you). */
  onSettleFirst?: () => void;
}) {
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
      confirmLabel={onSettleFirst ? 'Settle first' : 'Got it'}
      cancelLabel="Not now"
      onConfirm={onSettleFirst ?? onClose}
    >
      <div className={styles.dialogBody}>
        <Illustration scene={owes ? 'youOwe' : 'owedToYou'} size={150} />
        <p>
          {self
            ? owes
              ? `You still owe ${amount} in this group.`
              : `You are still owed ${amount} in this group.`
            : owes
              ? `${memberName} still owes ${amount}.`
              : `${memberName} is still owed ${amount}.`}{' '}
          Members can only leave once their balance is zero, so nobody loses track of money.{' '}
          {!self && !onSettleFirst
            ? `${memberName} needs to settle with the members involved before they can be removed.`
            : null}
        </p>
      </div>
    </AlertDialog>
  );
}

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
    <SettleCard tone="settlement">
      <IllustratedState
        scene="success"
        title={title}
        description={description}
        action={
          <>
            <Button onPress={onDone}>Back to group</Button>
            {onAnother ? (
              <Button variant="outline" onPress={onAnother}>
                Record another payment
              </Button>
            ) : null}
          </>
        }
      />
    </SettleCard>
  );
}

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
  return (
    <div className={styles.history}>
      <IconTile tone="settlement" size={38}>
        <History size={18} />
      </IconTile>
      <span className={styles.choiceCopy}>
        <strong>{description}</strong>
        <small>{[date, note ? `“${note}”` : undefined].filter(Boolean).join(' · ')}</small>
      </span>
      <strong className={styles.amount} data-tone="settlement">
        {formatMinor(amountMinor, currency)}
      </strong>
    </div>
  );
}
