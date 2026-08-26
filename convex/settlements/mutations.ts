import { requireSettlementParticipant } from '../shared/permissions';
import { createSettlement, type Settlement } from './domain';

export function createSettlementRecord(
  actorId: string,
  fromUserId: string,
  toUserId: string,
  amountMinor: bigint,
): Settlement {
  requireSettlementParticipant(actorId, fromUserId, toUserId);
  return createSettlement(fromUserId, toUserId, amountMinor);
}
