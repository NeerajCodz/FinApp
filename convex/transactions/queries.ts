import { requireOwner } from '../shared/permissions';

export type TransactionRecord = {
  ownerId: string;
  occurredAt: number;
  status: 'pending' | 'posted' | 'voided';
  [key: string]: unknown;
};

export function visibleTransactions(
  actorId: string,
  ownerId: string,
  transactions: readonly TransactionRecord[],
): TransactionRecord[] {
  requireOwner(actorId, ownerId);
  return transactions
    .filter((transaction) => transaction.status !== 'voided')
    .sort((left, right) => right.occurredAt - left.occurredAt);
}
