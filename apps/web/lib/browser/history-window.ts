export type TransactionHistoryWindow = '7' | '30' | '90' | '180' | '365' | 'all';

const DAY_MS = 86_400_000;

export function transactionHistoryRange(window: TransactionHistoryWindow, now: number) {
  const endAt = now + 1;
  return {
    startAt: window === 'all' ? 0 : endAt - Number(window) * DAY_MS,
    endAt,
  };
}
