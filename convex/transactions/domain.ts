export type ProcessedMutation = { clientMutationId: string; resultEntityId?: string };

export function assertMutationAvailable(
  processed: ProcessedMutation | null,
  clientMutationId: string,
): void {
  if (processed?.clientMutationId === clientMutationId) throw new Error('DUPLICATE_MUTATION');
}

export function transactionSignedAmount(
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment',
  amountMinor: bigint,
): bigint {
  if (amountMinor <= 0n) throw new Error('INVALID_AMOUNT');
  return type === 'expense' ? -amountMinor : amountMinor;
}
