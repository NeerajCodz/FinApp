export type TransactionComparison = {
  label: string;
  tone: 'positive' | 'negative' | 'neutral';
};

export function compareTransactionAmounts(
  current: bigint,
  previous: bigint | undefined,
  lowerIsBetter: boolean,
): TransactionComparison | null {
  if (previous === undefined) return null;
  if (previous === 0n)
    return current === 0n
      ? { label: 'No change from last month', tone: 'neutral' }
      : { label: 'New this month', tone: lowerIsBetter ? 'negative' : 'positive' };

  const difference = current - previous;
  if (difference === 0n) return { label: 'No change from last month', tone: 'neutral' };
  const magnitude = difference < 0n ? -difference : difference;
  const percent = (magnitude * 100n + previous / 2n) / previous;
  return {
    label: `${difference > 0n ? '↑' : '↓'} ${percent}% from last month`,
    tone: difference > 0n === lowerIsBetter ? 'negative' : 'positive',
  };
}
