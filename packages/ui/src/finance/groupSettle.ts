import { allocateParticipants, simplifyDebts } from '@convex/splits/domain';

/**
 * Pure helpers behind the settle-up hub, group balances and late-joiner flows. They are shared
 * by the native and web screens so both platforms make identical decisions.
 */

export type BalanceMap = Record<string, bigint>;
export type SettleTransfer = { fromUserId: string; toUserId: string; amountMinor: bigint };
export type SettleDirection = 'pay' | 'receive';

/** Maximum length of an optional settlement note; mirrors the server limit. */
export const SETTLEMENT_NOTE_MAX = 280;

const abs = (value: bigint) => (value < 0n ? -value : value);
const min = (left: bigint, right: bigint) => (left < right ? left : right);

/**
 * The largest payment the server accepts between two members: the payer must still owe at
 * least that much and the payee must still be owed at least that much.
 */
export function bilateralLimit(balances: BalanceMap, fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) return 0n;
  const debt = -(balances[fromUserId] ?? 0n);
  const credit = balances[toUserId] ?? 0n;
  const limit = min(debt, credit);
  return limit > 0n ? limit : 0n;
}

/** Applies payments to a balance map (a payment moves the payer towards zero). */
export function applyTransfers(
  balances: BalanceMap,
  transfers: readonly SettleTransfer[],
): BalanceMap {
  const next: BalanceMap = { ...balances };
  for (const transfer of transfers) {
    next[transfer.fromUserId] = (next[transfer.fromUserId] ?? 0n) + transfer.amountMinor;
    next[transfer.toUserId] = (next[transfer.toUserId] ?? 0n) - transfer.amountMinor;
  }
  return next;
}

/** True when every payment would be accepted when recorded one after another. */
export function isValidTransferSequence(
  balances: BalanceMap,
  transfers: readonly SettleTransfer[],
): boolean {
  let current = balances;
  for (const transfer of transfers) {
    if (transfer.amountMinor <= 0n) return false;
    if (transfer.amountMinor > bilateralLimit(current, transfer.fromUserId, transfer.toUserId))
      return false;
    current = applyTransfers(current, [transfer]);
  }
  return true;
}

export type SettleCounterpart = {
  userId: string;
  direction: SettleDirection;
  /** Largest amount you can record with this member right now. */
  maxAmountMinor: bigint;
  /** Amount the suggested plan would move between you; 0 if not in the plan. */
  suggestedMinor: bigint;
};

export type SettleUpPlan = {
  myBalanceMinor: bigint;
  direction: SettleDirection | 'settled';
  /** Minimal set of transfers that clears the whole group. */
  transfers: SettleTransfer[];
  /** The suggested transfers you take part in. */
  mine: SettleTransfer[];
  /** Everyone you can record a payment with, suggested people first. */
  counterparts: SettleCounterpart[];
  totalSuggestedMinor: bigint;
};

/**
 * Builds the settle-up view for one member: their net position, the simplified transfers and
 * every member they can record a (partial) payment with.
 */
export function settleUpPlan(balances: BalanceMap, userId: string): SettleUpPlan {
  const myBalanceMinor = balances[userId] ?? 0n;
  const transfers = simplifyDebts(balances);
  const mine = transfers.filter(
    (transfer) => transfer.fromUserId === userId || transfer.toUserId === userId,
  );
  const direction: SettleUpPlan['direction'] =
    myBalanceMinor < 0n ? 'pay' : myBalanceMinor > 0n ? 'receive' : 'settled';
  const suggested = new Map<string, bigint>();
  for (const transfer of mine) {
    const other = transfer.fromUserId === userId ? transfer.toUserId : transfer.fromUserId;
    suggested.set(other, (suggested.get(other) ?? 0n) + transfer.amountMinor);
  }
  const counterparts: SettleCounterpart[] = [];
  if (direction !== 'settled')
    for (const [otherId, amount] of Object.entries(balances)) {
      if (otherId === userId) continue;
      if (direction === 'pay' ? amount <= 0n : amount >= 0n) continue;
      const maxAmountMinor =
        direction === 'pay'
          ? bilateralLimit(balances, userId, otherId)
          : bilateralLimit(balances, otherId, userId);
      if (maxAmountMinor <= 0n) continue;
      counterparts.push({
        userId: otherId,
        direction,
        maxAmountMinor,
        suggestedMinor: suggested.get(otherId) ?? 0n,
      });
    }
  counterparts.sort((left, right) =>
    left.suggestedMinor !== right.suggestedMinor
      ? left.suggestedMinor > right.suggestedMinor
        ? -1
        : 1
      : left.maxAmountMinor !== right.maxAmountMinor
        ? left.maxAmountMinor > right.maxAmountMinor
          ? -1
          : 1
        : left.userId < right.userId
          ? -1
          : 1,
  );
  return {
    myBalanceMinor,
    direction,
    transfers,
    mine,
    counterparts,
    totalSuggestedMinor: mine.reduce((sum, transfer) => sum + transfer.amountMinor, 0n),
  };
}

/**
 * "Settle all mine": the suggested transfers you are part of, in an order the server accepts
 * when they are recorded one after another. Empty when you are settled.
 */
export function settleAllMine(balances: BalanceMap, userId: string): SettleTransfer[] {
  const { mine } = settleUpPlan(balances, userId);
  return isValidTransferSequence(balances, mine) ? mine : [];
}

/** Turns a chosen counterpart and amount into the payment record's direction. */
export function transferWith(
  userId: string,
  counterpartId: string,
  direction: SettleDirection,
  amountMinor: bigint,
): SettleTransfer {
  return direction === 'pay'
    ? { fromUserId: userId, toUserId: counterpartId, amountMinor }
    : { fromUserId: counterpartId, toUserId: userId, amountMinor };
}

/** Width (0–1) of each member's balance bar, relative to the largest open balance. */
export function balanceBarRatios(balances: BalanceMap): Record<string, number> {
  const largest = Object.values(balances).reduce(
    (max, value) => (abs(value) > max ? abs(value) : max),
    0n,
  );
  const ratios: Record<string, number> = {};
  for (const [userId, value] of Object.entries(balances))
    ratios[userId] = largest === 0n ? 0 : Number((abs(value) * 1000n) / largest) / 1000;
  return ratios;
}

// ---------------------------------------------------------------------------------------------
// Membership guard (leave / remove)

export type OutstandingBalance = { balanceMinor: bigint; currency: string };

/** Non-zero local balance for a member, or null when they may leave. */
export function outstandingBalance(
  balances: BalanceMap | null | undefined,
  memberId: string,
  currency: string,
): OutstandingBalance | null {
  const balanceMinor = balances?.[memberId] ?? 0n;
  return balanceMinor === 0n ? null : { balanceMinor, currency };
}

/** Reads the server's ConvexError { code: 'OUTSTANDING_BALANCE', balanceMinor, currency }. */
export function outstandingBalanceFromError(error: unknown): OutstandingBalance | null {
  const data =
    typeof error === 'object' && error !== null && 'data' in error
      ? (error as { data?: unknown }).data
      : undefined;
  if (typeof data !== 'object' || data === null) return null;
  const record = data as { code?: unknown; balanceMinor?: unknown; currency?: unknown };
  if (record.code !== 'OUTSTANDING_BALANCE') return null;
  if (typeof record.balanceMinor !== 'string' || !/^-?\d+$/.test(record.balanceMinor)) return null;
  return {
    balanceMinor: BigInt(record.balanceMinor),
    currency: typeof record.currency === 'string' ? record.currency : '',
  };
}

/** Best person to settle with first so a member can leave: their largest suggested transfer. */
export function settleFirstCounterpart(
  balances: BalanceMap | null | undefined,
  memberId: string,
): string | undefined {
  if (!balances) return undefined;
  const { mine } = settleUpPlan(balances, memberId);
  const [first] = [...mine].sort((left, right) =>
    left.amountMinor === right.amountMinor ? 0 : left.amountMinor > right.amountMinor ? -1 : 1,
  );
  if (!first) return undefined;
  return first.fromUserId === memberId ? first.toUserId : first.fromUserId;
}

// ---------------------------------------------------------------------------------------------
// Friendly errors

const errorCopy: Record<string, string> = {
  SETTLEMENT_EXCEEDS_BALANCE:
    'That is more than is still open between you two. Balances may have changed, so lower the amount or refresh.',
  NOTE_TOO_LONG: `Keep the note under ${SETTLEMENT_NOTE_MAX} characters.`,
  ACCOUNT_UNAVAILABLE: 'Choose an active account in the group currency.',
  CURRENCY_MISMATCH: 'This account uses a different currency from the group.',
  NOT_MEMBER: 'Only current or former members of this group can settle here.',
  INSUFFICIENT_PERMISSION: 'You do not have permission to do that in this group.',
  GROUP_UNAVAILABLE: 'This group is archived or no longer available.',
  MANUAL_SPLIT_REQUIRED:
    'Some expenses use exact or percentage splits. Edit those expenses manually.',
  OWNER_CANNOT_LEAVE:
    'The owner cannot leave. Make another member the owner in group settings, or archive the group.',
  OFFLINE: 'You are offline. Reconnect and try again.',
  SETTLEMENT_NOT_SYNCED: 'This payment has not synced yet. Try again in a moment.',
  LIMIT_EXCEEDED: 'Choose up to 50 expenses at a time.',
};

/** Maps backend error codes (plain or ConvexError) to readable copy. */
export function groupErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
  const data =
    typeof error === 'object' && error !== null && 'data' in error
      ? (error as { data?: unknown }).data
      : undefined;
  const dataCode =
    typeof data === 'string'
      ? data
      : typeof data === 'object' && data !== null && 'code' in data
        ? String((data as { code: unknown }).code)
        : undefined;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const code = dataCode ?? Object.keys(errorCopy).find((key) => message.includes(key)) ?? undefined;
  if (code && errorCopy[code]) return errorCopy[code];
  return message && !/^[A-Z_]+$/.test(message) && message.length < 160 ? message : fallback;
}

// ---------------------------------------------------------------------------------------------
// Expense timeline (date groups + "joined" markers)

export type TimelineJoin = { userId: string; name: string; joinedAt: number };
export type TimelineRow<T> =
  | { kind: 'day'; key: string; dayKey: string; at: number }
  | { kind: 'expense'; key: string; expense: T }
  | { kind: 'joined'; key: string; members: TimelineJoin[]; at: number };

/** Local calendar day, e.g. "2026-11-23". */
export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Today", "Yesterday", or a short date. */
export function dayLabel(timestamp: number, now = Date.now()): string {
  const key = localDayKey(timestamp);
  if (key === localDayKey(now)) return 'Today';
  if (key === localDayKey(now - 86_400_000)) return 'Yesterday';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** Short date for "Joined 3 Nov" / "Left 3 Nov" labels. */
export function shortDate(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}),
  });
}

/**
 * Orders expenses newest first, adds a header per day, and places a "joined" marker where a
 * member joined after earlier expenses: just above the newest expense that predates their join.
 * Members who joined before every listed expense get no marker.
 */
export function buildExpenseTimeline<T extends { id: string; occurredAt: number }>(
  expenses: readonly T[],
  joins: readonly TimelineJoin[],
): TimelineRow<T>[] {
  const sorted = [...expenses].sort(
    (left, right) => right.occurredAt - left.occurredAt || (left.id < right.id ? 1 : -1),
  );
  const oldest = sorted.at(-1)?.occurredAt;
  const pending = joins
    .filter((join) => oldest !== undefined && join.joinedAt > oldest)
    .sort((left, right) => right.joinedAt - left.joinedAt || (left.userId < right.userId ? -1 : 1));
  const rows: TimelineRow<T>[] = [];
  let currentDay = '';
  let joinIndex = 0;
  for (const expense of sorted) {
    const batch: TimelineJoin[] = [];
    while (joinIndex < pending.length && pending[joinIndex]!.joinedAt > expense.occurredAt) {
      batch.push(pending[joinIndex]!);
      joinIndex += 1;
    }
    if (batch.length) {
      const members = [...batch].sort((left, right) => left.joinedAt - right.joinedAt);
      rows.push({
        kind: 'joined',
        key: `joined:${members.map((join) => join.userId).join(',')}`,
        members,
        at: members[0]!.joinedAt,
      });
    }
    const day = localDayKey(expense.occurredAt);
    if (day !== currentDay) {
      currentDay = day;
      rows.push({ kind: 'day', key: `day:${day}`, dayKey: day, at: expense.occurredAt });
    }
    rows.push({ kind: 'expense', key: `expense:${expense.id}`, expense });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Late joiners

export type LateJoinerMember = { userId: string; name: string; joinedAt?: number };
export type LateJoinerExpense = {
  id: string;
  occurredAt: number;
  participantIds: readonly string[];
};
export type LateJoiner = LateJoinerMember & { joinedAt: number; missedExpenseIds: string[] };

/** Members who joined after expenses they are not part of, newest join first. */
export function findLateJoiners(
  members: readonly LateJoinerMember[],
  expenses: readonly LateJoinerExpense[],
): LateJoiner[] {
  const result: LateJoiner[] = [];
  for (const member of members) {
    if (member.joinedAt === undefined) continue;
    const joinedAt = member.joinedAt;
    const missedExpenseIds = expenses
      .filter(
        (expense) =>
          expense.occurredAt < joinedAt && !expense.participantIds.includes(member.userId),
      )
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .map((expense) => expense.id);
    if (missedExpenseIds.length) result.push({ ...member, joinedAt, missedExpenseIds });
  }
  return result.sort((left, right) => right.joinedAt - left.joinedAt);
}

export type InclusionParticipant = {
  userId: string;
  amountMinor: bigint;
  method?: string;
  basisValue?: string;
};

export type InclusionPreview =
  | {
      eligible: true;
      /** Share per person before and after; for share-based splits, the newcomer's share. */
      beforeMinor: bigint;
      afterMinor: bigint;
      participantCount: number;
    }
  | { eligible: false; reason: 'manual' | 'empty' | 'included' };

/**
 * Previews adding members to one expense with the same allocation the server uses. Exact and
 * percentage splits cannot be recomputed automatically and are marked as manual.
 */
export function previewInclusion(
  amountMinor: bigint,
  participants: readonly InclusionParticipant[],
  newUserIds: readonly string[],
): InclusionPreview {
  if (!participants.length) return { eligible: false, reason: 'empty' };
  const method = participants[0]!.method ?? 'equal';
  if (method !== 'equal' && method !== 'shares') return { eligible: false, reason: 'manual' };
  const newcomers = newUserIds.filter(
    (userId) => !participants.some((participant) => participant.userId === userId),
  );
  if (!newcomers.length) return { eligible: false, reason: 'included' };
  const userIds = [...participants.map((participant) => participant.userId), ...newcomers];
  const values =
    method === 'shares'
      ? [
          ...participants.map((participant) => BigInt(participant.basisValue ?? '1')),
          ...newcomers.map(() => 1n),
        ]
      : undefined;
  const allocation = allocateParticipants(amountMinor, userIds, method, values);
  const after = allocation.find((row) => row.userId === newcomers[0])?.amountMinor ?? 0n;
  const before = participants.reduce(
    (largest, participant) =>
      participant.amountMinor > largest ? participant.amountMinor : largest,
    0n,
  );
  return {
    eligible: true,
    beforeMinor: before,
    afterMinor: after,
    participantCount: userIds.length,
  };
}

export type IncludableExpense = {
  id: string;
  /** Server id used by addMembersToExpenses; missing until the expense has synced. */
  cloudId?: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: number;
  preview: InclusionPreview;
  /** False when you may not edit this expense (not admin, not its creator, or not synced). */
  editable: boolean;
};

export type PastExpenseCandidate = {
  id: string;
  cloudId?: string;
  title: string;
  amountMinor: bigint;
  occurredAt: number;
  ownerId?: string;
  participants: readonly InclusionParticipant[];
};

/**
 * Past expenses a late joiner missed, with a share preview and whether the current user may
 * add them (admins any expense, others only expenses they created).
 */
export function includablePastExpenses(
  joiner: Pick<LateJoiner, 'userId' | 'missedExpenseIds'>,
  expenses: readonly PastExpenseCandidate[],
  options: { meId: string; isAdmin: boolean; currency: string },
): IncludableExpense[] {
  return joiner.missedExpenseIds.flatMap((expenseId) => {
    const expense = expenses.find((candidate) => candidate.id === expenseId);
    if (!expense) return [];
    return [
      {
        id: expense.id,
        cloudId: expense.cloudId,
        title: expense.title,
        amountMinor: expense.amountMinor,
        currency: options.currency,
        occurredAt: expense.occurredAt,
        preview: previewInclusion(expense.amountMinor, expense.participants, [joiner.userId]),
        editable: Boolean(expense.cloudId) && (options.isAdmin || expense.ownerId === options.meId),
      },
    ];
  });
}
