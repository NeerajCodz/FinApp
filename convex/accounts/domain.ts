export type BalanceEntry = {
  type: 'income' | 'expense' | 'refund' | 'adjustment' | 'transfer-in' | 'transfer-out';
  amountMinor: bigint;
};

export function deriveBalance(
  openingBalanceMinor: bigint,
  entries: readonly BalanceEntry[],
): bigint {
  return entries.reduce((balance, entry) => {
    if (entry.amountMinor < 0n) throw new Error('INVALID_AMOUNT');
    if (entry.type === 'expense' || entry.type === 'transfer-out')
      return balance - entry.amountMinor;
    return balance + entry.amountMinor;
  }, openingBalanceMinor);
}
