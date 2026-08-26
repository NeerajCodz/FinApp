import {
  createSplit,
  assertSplitVersion,
  type ParticipantAmount,
  type SplitLedger,
} from './domain';

export function createExpenseSplit(
  totalMinor: bigint,
  payers: readonly ParticipantAmount[],
  participants: readonly ParticipantAmount[],
): SplitLedger {
  return createSplit(totalMinor, payers, participants);
}

export function updateExpenseSplit(
  expectedVersion: number,
  current: SplitLedger,
  payers: readonly ParticipantAmount[],
  participants: readonly ParticipantAmount[],
): SplitLedger {
  assertSplitVersion(expectedVersion, current.version);
  return createSplit(current.totalMinor, payers, participants, current.version + 1);
}
