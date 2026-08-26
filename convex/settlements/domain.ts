import { DomainError } from '../shared/errors';

export type Settlement = {
  fromUserId: string;
  toUserId: string;
  amountMinor: bigint;
  createdAt: number;
};

export function createSettlement(
  fromUserId: string,
  toUserId: string,
  amountMinor: bigint,
): Settlement {
  if (!fromUserId || !toUserId || fromUserId === toUserId || amountMinor <= 0n)
    throw new DomainError('INVALID_SPLIT');
  return { fromUserId, toUserId, amountMinor, createdAt: Date.now() };
}
