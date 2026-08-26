import { DomainError } from '../shared/errors';

export type ReceiptMetadata = {
  transactionId: string;
  ownerId: string;
  storageId: string;
  mimeType: string;
  size: number;
  createdAt: number;
};

export function authorizeReceiptAccess(
  actorId: string,
  receipt: ReceiptMetadata,
  transactionOwnerId: string,
  groupMember: boolean,
): void {
  if (actorId !== transactionOwnerId && !groupMember && actorId !== receipt.ownerId)
    throw new DomainError('INSUFFICIENT_PERMISSION');
}

export function validateReceiptSize(size: number, mimeType: string): void {
  if (
    size <= 0 ||
    size > 10_000_000 ||
    !['image/jpeg', 'image/png', 'application/pdf'].includes(mimeType)
  )
    throw new Error('INVALID_RECEIPT');
}
