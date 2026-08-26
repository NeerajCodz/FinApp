import { allocateSplit, type SplitMethod } from '../shared/money';
import { DomainError } from '../shared/errors';

export type ParticipantAmount = { userId: string; amountMinor: bigint };
export type SplitLedger = {
  payers: ParticipantAmount[];
  participants: ParticipantAmount[];
  totalMinor: bigint;
  version: number;
};

function sum(items: readonly ParticipantAmount[]): bigint {
  return items.reduce((total, item) => total + item.amountMinor, 0n);
}

export function createSplit(
  totalMinor: bigint,
  payers: readonly ParticipantAmount[],
  participants: readonly ParticipantAmount[],
  version = 1,
): SplitLedger {
  if (
    totalMinor <= 0n ||
    payers.length === 0 ||
    participants.length === 0 ||
    payers.some((item) => item.amountMinor < 0n) ||
    participants.some((item) => item.amountMinor < 0n) ||
    sum(payers) !== totalMinor ||
    sum(participants) !== totalMinor
  )
    throw new DomainError('INVALID_SPLIT');
  const users = new Set([...payers, ...participants].map((item) => item.userId));
  if (users.size !== payers.length + participants.length && [...users].some((userId) => !userId))
    throw new DomainError('INVALID_SPLIT');
  return { payers: [...payers], participants: [...participants], totalMinor, version };
}

export function allocateParticipants(
  totalMinor: bigint,
  userIds: readonly string[],
  method: SplitMethod,
  values?: readonly (bigint | number)[],
): ParticipantAmount[] {
  return Object.entries(allocateSplit(totalMinor, userIds, { method, values })).map(
    ([userId, amountMinor]) => ({ userId, amountMinor }),
  );
}

export function assertSplitVersion(expectedVersion: number, currentVersion: number): void {
  if (expectedVersion !== currentVersion) throw new DomainError('TRANSACTION_CHANGED');
}

export function calculateNetBalances(
  payers: readonly ParticipantAmount[],
  participants: readonly ParticipantAmount[],
  settlements: readonly { fromUserId: string; toUserId: string; amountMinor: bigint }[],
): Record<string, bigint> {
  const balances: Record<string, bigint> = {};
  for (const item of payers)
    balances[item.userId] = (balances[item.userId] ?? 0n) + item.amountMinor;
  for (const item of participants)
    balances[item.userId] = (balances[item.userId] ?? 0n) - item.amountMinor;
  for (const settlement of settlements) {
    balances[settlement.fromUserId] =
      (balances[settlement.fromUserId] ?? 0n) + settlement.amountMinor;
    balances[settlement.toUserId] = (balances[settlement.toUserId] ?? 0n) - settlement.amountMinor;
  }
  return balances;
}
